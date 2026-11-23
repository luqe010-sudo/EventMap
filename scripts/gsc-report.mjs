import { sign } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const sitesEndpoint = "https://www.googleapis.com/webmasters/v3/sites";
const scope = "https://www.googleapis.com/auth/webmasters.readonly";
const defaultSite = "sc-domain:mapaimprez.pl";
const help = `npm run seo:gsc -- [opcje]

  --site IDENTYFIKATOR   Usługa Search Console (domyślnie ${defaultSite})
  --country POL|all      Kod kraju ISO alpha-3 (domyślnie POL) lub wszystkie kraje
  --end-date RRRR-MM-DD   Koniec ostatnich 28 dni, w strefie PT (domyślnie dziś minus 4 dni)
  --limit N             Maks. stron i zapytań w raporcie, 1–25000 (domyślnie 25)
  --json                JSON na stdout (z npm uruchom przez npm run --silent seo:gsc)
  --help                Pomoc

Ustaw GSC_ACCESS_TOKEN z krótkotrwałym tokenem OAuth lub
GOOGLE_APPLICATION_CREDENTIALS z pełną ścieżką do JSON konta serwisowego poza repozytorium.
`;

class ReportError extends Error {}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function todayInPacificTime() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const { year, month, day } = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${year}-${month}-${day}`;
}

function parseOptions() {
  try {
    return parseArgs({
      options: {
        site: { type: "string", default: defaultSite },
        country: { type: "string", default: "POL" },
        "end-date": { type: "string" },
        limit: { type: "string", default: "25" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    }).values;
  } catch {
    throw new ReportError("Niepoprawne opcje. Użyj --help.");
  }
}

function validateOptions(options) {
  const { site } = options;
  const prefix = URL.canParse(site) ? new URL(site) : null;
  const validDomain = /^sc-domain:[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(site);
  const validPrefix = /^https?:\/\//.test(site) && prefix && !prefix.username && !prefix.password
    && !site.includes("?") && !site.includes("#") && !/\s/.test(site);
  if (!validDomain && !validPrefix) {
    throw new ReportError("Podaj dokładny identyfikator usługi Search Console w --site.");
  }
  const country = options.country.toUpperCase();
  if (country !== "ALL" && !/^[A-Z]{3}$/.test(country)) {
    throw new ReportError("Opcja --country wymaga trzyznakowego kodu kraju lub all.");
  }
  const limit = Number(options.limit);
  if (!/^\d+$/.test(options.limit) || limit < 1 || limit > 25000) {
    throw new ReportError("Opcja --limit wymaga liczby całkowitej od 1 do 25000.");
  }
  const today = todayInPacificTime();
  const endDate = options["end-date"] ?? shiftDate(today, -4);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(Date.parse(endDate))
    || shiftDate(endDate, 0) !== endDate || endDate >= today) {
    throw new ReportError("Opcja --end-date wymaga prawidłowej daty wcześniejszej niż dzisiaj (PT).");
  }
  return { site, country: country === "ALL" ? null : country, limit, endDate };
}

async function requestJson(url, operation, init) {
  let response;
  try {
    response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new ReportError(`${operation} nie powiodło się. Sprawdź połączenie z Google.`);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details = body?.error?.details;
    if (Array.isArray(details) && details.some(detail => detail?.reason === "SERVICE_DISABLED")) {
      throw new ReportError("Włącz Search Console API (searchconsole.googleapis.com) w projekcie Google Cloud.");
    }
    const hint = {
      401: " Sprawdź ważność i zakres tokenu.",
      403: " Sprawdź rolę w Search Console, zakres tokenu i aktywację API.",
      429: " Odczekaj przed ponownym odczytem.",
    }[response.status] ?? "";
    throw new ReportError(`${operation} zwróciło HTTP ${response.status}.${hint}`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReportError(`${operation} zwróciło nieprawidłową odpowiedź.`);
  }
  return body;
}

async function accessToken() {
  const suppliedToken = process.env.GSC_ACCESS_TOKEN?.trim();
  if (suppliedToken) return suppliedToken;

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath || !isAbsolute(credentialsPath)) {
    throw new ReportError("Ustaw GSC_ACCESS_TOKEN lub pełną ścieżkę GOOGLE_APPLICATION_CREDENTIALS.");
  }

  let credentials;
  try {
    const [file, repo] = await Promise.all([
      realpath(credentialsPath), realpath(fileURLToPath(new URL("..", import.meta.url))),
    ]);
    const fromRepo = relative(repo, file);
    if (!fromRepo || (!isAbsolute(fromRepo) && !fromRepo.startsWith(`..${sep}`))) {
      throw new ReportError("Umieść plik konta serwisowego poza repozytorium.");
    }
    credentials = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error instanceof ReportError) throw error;
    throw new ReportError("Nie udało się odczytać pliku JSON konta serwisowego.");
  }
  if (credentials?.type !== "service_account" || typeof credentials.client_email !== "string"
    || typeof credentials.private_key !== "string") {
    throw new ReportError("GOOGLE_APPLICATION_CREDENTIALS musi wskazywać klucz JSON konta serwisowego.");
  }

  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", typ: "JWT", kid: credentials.private_key_id });
  const claims = encode({ iss: credentials.client_email, scope, aud: tokenEndpoint, iat, exp: iat + 3600 });
  const assertion = `${header}.${claims}`;
  let signature;
  try {
    signature = sign("RSA-SHA256", Buffer.from(assertion), credentials.private_key).toString("base64url");
  } catch {
    throw new ReportError("Nie udało się podpisać żądania. Sprawdź plik klucza konta serwisowego.");
  }
  const token = await requestJson(tokenEndpoint, "Pobranie tokenu OAuth", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${assertion}.${signature}`,
    }),
  });
  if (typeof token.access_token !== "string" || !token.access_token) {
    throw new ReportError("Google nie zwrócił tokenu OAuth.");
  }
  return token.access_token;
}

function metrics(row) {
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.impressions ? row.ctr : null,
    position: row?.impressions ? row.position : null,
  };
}

async function fetchReport({ site, country, limit, endDate }, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const { siteEntry = [] } = await requestJson(sitesEndpoint, "Sprawdzenie dostępu do usługi", { headers });
  const permission = siteEntry.find(entry => entry.siteUrl === site)?.permissionLevel;
  if (!["siteRestrictedUser", "siteFullUser", "siteOwner"].includes(permission)) {
    throw new ReportError("Konto nie ma dostępu do wskazanej usługi. Sprawdź uprawnienia i dokładną wartość --site.");
  }

  const current = { startDate: shiftDate(endDate, -27), endDate };
  const previous = { startDate: shiftDate(endDate, -55), endDate: shiftDate(endDate, -28) };
  const filters = country ? [{ groupType: "and", filters: [
    { dimension: "country", operator: "equals", expression: country },
  ] }] : [];
  const endpoint = `${sitesEndpoint}/${encodeURIComponent(site)}/searchAnalytics/query`;
  async function query(period, dimensions, rowLimit) {
    const body = await requestJson(endpoint, "Odczyt statystyk wyszukiwania", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...period, dimensions, rowLimit, type: "web", dataState: "final", dimensionFilterGroups: filters }),
    });
    return body.rows ?? [];
  }

  const [currentTotals, previousTotals, dates, pages, queries] = await Promise.all([
    query(current, [], 1), query(previous, [], 1),
    query({ startDate: previous.startDate, endDate }, ["date"], 56),
    query(current, ["page"], limit), query(current, ["query"], limit),
  ]);
  return {
    site, permission, country, type: "web", dataState: "final", timeZone: "America/Los_Angeles",
    current: { ...current, totals: metrics(currentTotals[0]) },
    previous: { ...previous, totals: metrics(previousTotals[0]) },
    daily: dates.map(row => ({ date: row.keys[0], ...metrics(row) })),
    pages: pages.map(row => ({ page: row.keys[0], ...metrics(row) })),
    queries: queries.map(row => ({ query: row.keys[0], ...metrics(row) })),
  };
}

function printReport(report) {
  const { current, previous } = report;
  console.log(`${report.site} · Google Web · ${report.country ?? "wszystkie kraje"} · daty PT`);
  console.table([current, previous].map(({ startDate, endDate, totals }) => ({ startDate, endDate, ...totals })));
  console.log(`Zmiana kliknięć: ${current.totals.clicks - previous.totals.clicks}`);
  console.log(`Dni z danymi: ${report.daily.length}/56`);
  console.log("Najczęściej klikane strony:");
  console.table(report.pages);
  console.log("Najczęściej klikane zapytania:");
  console.table(report.queries);
  console.log("Wiersze szczegółowe mogą być niepełne. CTR to udział kliknięć (0–1).");
}

try {
  const options = parseOptions();
  if (options.help) {
    console.log(help);
  } else {
    const settings = validateOptions(options);
    const report = await fetchReport(settings, await accessToken());
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
  }
} catch (error) {
  console.error(error instanceof ReportError ? error.message : "Nie udało się przygotować raportu Search Console.");
  process.exitCode = 1;
}
