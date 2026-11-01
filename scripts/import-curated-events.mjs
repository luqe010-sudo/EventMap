import { createHash } from "node:crypto";
import { mkdirSync, openSync, closeSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const MAX_ROWS = 50000;
const TIMEZONE = "Europe/Warsaw";
const OWNER_PREFIX = "EventMap curated import v1; key=";

export function normalizeText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pl-PL").replaceAll("ł", "l")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalSourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Źródło musi być adresem HTTPS bez danych logowania.");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export function localDay(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function eventKey(title, city, startAt) {
  return createHash("sha256").update([normalizeText(title), normalizeText(city), new Date(startAt).toISOString()].join("|"))
    .digest("hex");
}

function requiredText(value, name, limit = 1000) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit) throw new Error(`Nieprawidłowe ${name}.`);
  return value.trim();
}

function explicitDate(value, name) {
  const text = requiredText(value, name, 40);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match || !Number.isFinite(Date.parse(text))) throw new Error(`${name} wymaga poprawnej daty ISO z jawnym offsetem.`);
  const [year, month, day] = match[1].split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== match[1]) throw new Error(`Nieistniejący dzień w ${name}.`);
  return new Date(text).toISOString();
}

export function validateBatch(batch, now = new Date()) {
  if (!batch || typeof batch !== "object") throw new Error("Nieprawidłowa paczka JSON.");
  const checkedAt = explicitDate(batch.checked_at, "checked_at");
  const checkedAge = now.getTime() - Date.parse(checkedAt);
  if (checkedAge < -5 * 60000 || checkedAge > 48 * 3600000) throw new Error("Źródła muszą być sprawdzone w ciągu ostatnich 48 godzin.");
  if (!Array.isArray(batch.events) || !batch.events.length || batch.events.length > 50) throw new Error("Paczka musi zawierać od 1 do 50 wydarzeń.");
  const keys = new Set();
  const events = batch.events.map((raw, index) => {
    const label = `events[${index}]`;
    const title = requiredText(raw?.title, `${label}.title`, 300);
    const categorySlug = requiredText(raw.category_slug, `${label}.category_slug`, 100);
    const startAt = explicitDate(raw.start_at, `${label}.start_at`);
    if (Date.parse(startAt) <= now.getTime()) throw new Error(`${label}: wydarzenie już się rozpoczęło.`);
    const endAt = raw.end_at == null ? null : explicitDate(raw.end_at, `${label}.end_at`);
    if (endAt && Date.parse(endAt) <= Date.parse(startAt)) throw new Error(`${label}: koniec musi być późniejszy od początku.`);
    const latest = new Date(now);
    latest.setUTCFullYear(latest.getUTCFullYear() + 3);
    if ([startAt, endAt].some(value => value && Date.parse(value) > latest.getTime())) throw new Error(`${label}: data przekracza horyzont 3 lat.`);
    const city = requiredText(raw.location?.city, `${label}.location.city`, 200);
    const location = {
      name: requiredText(raw.location?.name, `${label}.location.name`, 300),
      address: requiredText(raw.location?.address, `${label}.location.address`, 400),
      city,
      city_slug: raw.location.city_slug == null ? null : requiredText(raw.location.city_slug, `${label}.location.city_slug`, 200),
      latitude: raw.location.latitude ?? null,
      longitude: raw.location.longitude ?? null
    };
    for (const [field, max] of [["latitude", 90], ["longitude", 180]]) {
      if (location[field] !== null && (typeof location[field] !== "number" || !Number.isFinite(location[field]) || Math.abs(location[field]) > max)) {
        throw new Error(`${label}: nieprawidłowa współrzędna ${field}.`);
      }
    }
    if ((location.latitude === null) !== (location.longitude === null)) throw new Error(`${label}: wymagane obie współrzędne albo żadna.`);
    const sourceUrl = canonicalSourceUrl(requiredText(raw.source_url, `${label}.source_url`, 2000));
    const key = eventKey(title, city, startAt);
    if (keys.has(key)) throw new Error(`${label}: duplikat w paczce.`);
    keys.add(key);
    const priceType = raw.price_type;
    if (!["free", "paid", "unknown"].includes(priceType)) throw new Error(`${label}: price_type musi być free, paid albo unknown.`);
    let priceMin = raw.price_min ?? null;
    let priceMax = raw.price_max ?? null;
    for (const price of [priceMin, priceMax]) {
      if (price !== null && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) throw new Error(`${label}: nieprawidłowa cena.`);
    }
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) throw new Error(`${label}: odwrócony zakres ceny.`);
    if (priceType === "unknown" && (priceMin !== null || priceMax !== null)) throw new Error(`${label}: nieznana cena wymaga pustych kwot.`);
    if (priceType === "free") {
      if ((priceMin ?? 0) !== 0 || (priceMax ?? 0) !== 0) throw new Error(`${label}: wydarzenie bezpłatne nie może mieć dodatniej ceny.`);
      priceMin = 0; priceMax = 0;
    }
    if (priceType === "paid" && priceMin === null && priceMax === null) throw new Error(`${label}: cena paid wymaga potwierdzonej kwoty; inaczej użyj unknown i opisz zasady wstępu.`);
    const currency = raw.currency ?? "PLN";
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`${label}: nieprawidłowa waluta.`);
    if (raw.is_all_day !== undefined && typeof raw.is_all_day !== "boolean") throw new Error(`${label}: is_all_day musi być boolean.`);
    const slugBase = normalizeText(`${title} ${city} ${localDay(startAt)}`).replaceAll(" ", "-").slice(0, 150).replace(/-+$/, "");
    return {
      title, category_slug: categorySlug, start_at: startAt, end_at: endAt,
      short_description: requiredText(raw.short_description, `${label}.short_description`, 500),
      description: requiredText(raw.description, `${label}.description`, 30000),
      location, source_name: requiredText(raw.source_name, `${label}.source_name`, 300), source_url: sourceUrl,
      price_type: priceType, price_min: priceMin, price_max: priceMax, currency,
      is_all_day: raw.is_all_day ?? false, key, slug: `curated-${slugBase}-${key.slice(0, 12)}`,
      marker: `${OWNER_PREFIX}${key}; source=${sourceUrl}`, checked_at: checkedAt
    };
  });
  return { checked_at: checkedAt, events };
}

function relation(value) { return Array.isArray(value) ? value[0] : value; }

function cityName(event) { return relation(relation(event.location)?.city)?.name ?? ""; }

export function sameOccurrence(existing, candidate) {
  return normalizeText(existing.title) === normalizeText(candidate.title)
    && localDay(existing.start_at) === localDay(candidate.start_at)
    && normalizeText(cityName(existing)) === normalizeText(candidate.location.city);
}

async function readAll(client, table, select) {
  const rows = [];
  let total;
  do {
    const result = await client.from(table).select(select, { count: "exact" }).order("id").range(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error) throw new Error(`Odczyt ${table}: ${result.error.message}`);
    if (total === undefined) total = result.count;
    if (!Number.isSafeInteger(total) || total < 0 || total > MAX_ROWS || total !== result.count) throw new Error(`Nie można potwierdzić kompletnego odczytu ${table}. Ponów import.`);
    if (!result.data?.length && rows.length < total) throw new Error(`Niekompletny odczyt ${table}.`);
    rows.push(...result.data);
  } while (rows.length < total);
  if (rows.length !== total || new Set(rows.map(row => row.id)).size !== total) throw new Error(`Niespójna paginacja ${table}.`);
  return rows;
}

function sourceMatches(source, event, catalog) {
  if (source.external_id === `curated:${event.key}`) return true;
  try {
    if (canonicalSourceUrl(source.source_url) !== event.source_url) return false;
    // Calendar pages legitimately describe several different occurrences.
    const existing = catalog.events.find(row => row.id === source.event_id);
    return existing && sameOccurrence(existing, event)
      && new Date(existing.start_at).toISOString() === event.start_at;
  } catch { return false; }
}

export function assertOwnedSource(source, event, eventId) {
  let sameUrl = false;
  try { sameUrl = canonicalSourceUrl(source?.source_url) === event.source_url; } catch { /* Invalid source fails the guard below. */ }
  if (!source?.id || source.event_id !== eventId || !sameUrl
    || source.external_id !== `curated:${event.key}` || source.source_type !== "manual" || source.is_active !== true) {
    throw new Error("Źródło importowanego rekordu zostało zmienione lub wyłączone; publikacja wymaga ręcznego sprawdzenia.");
  }
}

export function findDuplicate(catalog, event) {
  const sources = catalog.sources.filter(source => sourceMatches(source, event, catalog));
  const own = catalog.events.find(existing => existing.slug === event.slug && existing.review_note === event.marker);
  const conflictingSource = sources.find(source => source.event_id !== own?.id);
  const conflictingEvent = catalog.events.find(existing => existing.id !== own?.id && sameOccurrence(existing, event));
  return { own, duplicateId: conflictingSource?.event_id ?? conflictingEvent?.id ?? null };
}

async function readCatalog(client) {
  const specs = [
    ["categories", "id,name,slug"], ["cities", "id,name,slug"],
    ["locations", "id,name,address,city_id,latitude,longitude"],
    ["events", "id,title,slug,start_at,status,visibility,is_cancelled,review_note,location:locations(city:cities(name))"],
    ["event_sources", "id,event_id,source_url,external_id,source_type,is_active"]
  ];
  const results = await Promise.allSettled(specs.map(([table, select]) => readAll(client, table, select)));
  const failed = results.find(result => result.status === "rejected");
  if (failed) throw failed.reason;
  return Object.fromEntries(specs.map(([table], index) => [table === "event_sources" ? "sources" : table, results[index].value]));
}

function prepare(catalog, event) {
  const category = catalog.categories.find(row => row.slug === event.category_slug);
  if (!category) throw new Error(`Nie istnieje kategoria ${event.category_slug}.`);
  const cities = catalog.cities.filter(row => event.location.city_slug ? row.slug === event.location.city_slug : normalizeText(row.name) === normalizeText(event.location.city));
  if (cities.length !== 1) throw new Error(`Miasto ${event.location.city} wymaga istniejącego jednoznacznego rekordu; podaj location.city_slug.`);
  const city = cities[0];
  const location = catalog.locations.find(row => row.city_id === city.id
    && normalizeText(row.name) === normalizeText(event.location.name)
    && normalizeText(row.address) === normalizeText(event.location.address));
  return { category, city, location, ...findDuplicate(catalog, event) };
}

function eventPayload(event, categoryId, locationId) {
  return {
    title: event.title, slug: event.slug, category_id: categoryId, location_id: locationId,
    start_at: event.start_at, end_at: event.end_at, timezone: TIMEZONE, is_all_day: event.is_all_day,
    short_description: event.short_description, description: event.description,
    price_type: event.price_type, price_min: event.price_min, price_max: event.price_max, currency: event.currency,
    organizer_id: null, submitted_by_organizer_id: null, status: "pending_review", visibility: "public",
    is_cancelled: false, is_featured: false, is_verified: false, published_at: null, review_note: event.marker
  };
}

export function assertUnchangedPending(existing, payload) {
  for (const [field, expected] of Object.entries(payload)) {
    const actual = ["start_at", "end_at"].includes(field) && existing[field] != null ? new Date(existing[field]).toISOString() : existing[field];
    if (actual !== expected) throw new Error(`Własny rekord pending_review został zmieniony (${field}); wymaga ręcznego sprawdzenia.`);
  }
}

async function writeOne(client, catalog, event, plan) {
  if (plan.duplicateId) return { outcome: "skipped_duplicate", event_id: plan.duplicateId };
  if (plan.own && plan.own.status !== "pending_review") {
    const publicWithSource = plan.own.status === "published" && plan.own.visibility === "public" && !plan.own.is_cancelled
      && catalog.sources.some(source => {
        try { assertOwnedSource(source, event, plan.own.id); return true; } catch { return false; }
      });
    return { outcome: publicWithSource ? "already_published" : "skipped_existing_state", event_id: plan.own.id, status: plan.own.status };
  }
  let location = plan.location;
  let eventId = plan.own?.id ?? null;
  let eventVersion = null;
  try {
    if (!location && !plan.own) {
      const { data, error } = await client.from("locations").insert({
        name: event.location.name, address: event.location.address, city_id: plan.city.id,
        latitude: event.location.latitude, longitude: event.location.longitude
      }).select("id,name,address,city_id,latitude,longitude").single();
      if (error) throw new Error(`Lokalizacja: ${error.message}`);
      location = data; catalog.locations.push(location);
    }
    if (!location) throw new Error("Nie można potwierdzić lokalizacji własnego oczekującego rekordu.");
    const payload = eventPayload(event, plan.category.id, location.id);
    if (plan.own) {
      const { data, error } = await client.from("events").select("*").eq("id", eventId).single();
      if (error) throw new Error(`Odczyt oczekującego rekordu: ${error.message}`);
      assertUnchangedPending(data, payload);
      eventVersion = data.updated_at;
    } else {
      const { data, error } = await client.from("events").insert(payload).select("id,updated_at").single();
      if (error) throw new Error(`Wydarzenie: ${error.message}`);
      eventId = data.id;
      eventVersion = data.updated_at;
      catalog.events.push({ ...payload, id: eventId, location: { city: { name: plan.city.name } } });
    }
    const eventSources = catalog.sources.filter(row => row.event_id === eventId);
    let source = eventSources.find(row => sourceMatches(row, event, catalog));
    if (!source) {
      if (eventSources.length) throw new Error("Własny oczekujący rekord ma zmienione źródło; nie dodano źródła zastępczego.");
      const { data, error } = await client.from("event_sources").insert({
        event_id: eventId, source_type: "manual", source_name: event.source_name, source_url: event.source_url,
        external_id: `curated:${event.key}`, raw_title: event.title, raw_date: event.start_at,
        raw_location: `${event.location.name}, ${event.location.address}, ${event.location.city}`,
        scraped_at: event.checked_at, last_seen_at: event.checked_at, is_active: true
      }).select("id,event_id,source_url,external_id,source_type,is_active").single();
      if (error) throw new Error(`Źródło: ${error.message}`);
      source = data; catalog.sources.push(source);
    }
    // A source must be readable before the event becomes public.
    const confirmed = await client.from("event_sources").select("id,event_id,source_url,external_id,source_type,is_active")
      .eq("id", source.id).eq("event_id", eventId).single();
    if (confirmed.error || !confirmed.data) throw new Error("Nie udało się potwierdzić źródła przed publikacją.");
    assertOwnedSource(confirmed.data, event, eventId);
    let publication = client.from("events").update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", eventId).eq("status", "pending_review").eq("review_note", event.marker)
      .eq("visibility", "public").eq("is_cancelled", false).is("organizer_id", null).is("submitted_by_organizer_id", null);
    publication = eventVersion == null ? publication.is("updated_at", null) : publication.eq("updated_at", eventVersion);
    const { data, error } = await publication.select("id,status,published_at").maybeSingle();
    if (error || !data || data.status !== "published" || !data.published_at) throw new Error(`Nie potwierdzono publikacji${error ? `: ${error.message}` : "."}`);
    const stored = catalog.events.find(row => row.id === eventId);
    if (stored) stored.status = "published";
    return { outcome: plan.own ? "recovered_and_published" : "inserted_and_published", event_id: eventId, slug: event.slug };
  } catch (error) {
    // Do not delete records or undo somebody else's edits. A failed read or response
    // does not prove that a preceding write failed, so report the observed state.
    let observedStatus = "unconfirmed";
    if (eventId) {
      const observed = await client.from("events").select("status").eq("id", eventId).maybeSingle();
      if (!observed.error) observedStatus = observed.data?.status ?? "missing";
    }
    return { outcome: "failed", event_id: eventId, observed_status: observedStatus, error: error.message };
  }
}

function parseArgs(args) {
  let file; let apply = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--file") file = args[++index];
    else if (args[index] === "--apply") apply = true;
    else throw new Error(`Nieznana opcja ${args[index]}. Użycie: --file <batch.json> [--apply]`);
  }
  if (!file) throw new Error("Wymagane --file <batch.json>.");
  return { file, apply };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const batch = validateBatch(JSON.parse(readFileSync(path.resolve(options.file), "utf8")));
  if (options.apply && process.env.EVENTMAP_IMPORT_WRITE !== "1") throw new Error("Zapis wymaga EVENTMAP_IMPORT_WRITE=1 oraz --apply.");
  const serviceKey = process.env.EVENTMAP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !serviceKey) throw new Error("Wymagane NEXT_PUBLIC_SUPABASE_URL i serwerowy EVENTMAP_SUPABASE_SERVICE_ROLE_KEY lub SUPABASE_SERVICE_ROLE_KEY.");
  const client = createClient(new URL(url).origin, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const lockPath = path.resolve("scratch/curated-import.lock");
  mkdirSync(path.dirname(lockPath), { recursive: true });
  let lock;
  try { lock = openSync(lockPath, "wx"); }
  catch (error) { if (error.code === "EEXIST") throw new Error("Istnieje scratch/curated-import.lock. Sprawdź aktywny proces importera przed usunięciem starej blokady."); throw error; }
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
    const catalog = await readCatalog(client);
    // Validate every category and city before the first write.
    batch.events.forEach(event => prepare(catalog, event));
    const report = { mode: options.apply ? "apply" : "dry-run", checked_at: batch.checked_at, results: [] };
    for (const event of batch.events) {
      const plan = prepare(catalog, event);
      const result = options.apply ? await writeOne(client, catalog, event, plan) : {
        outcome: plan.duplicateId ? "would_skip_duplicate" : plan.own ? `existing_${plan.own.status}` : "would_insert_and_publish",
        duplicate_id: plan.duplicateId, own_id: plan.own?.id ?? null,
        category_id: plan.category.id, city_id: plan.city.id, location_id: plan.location?.id ?? null,
        creates_location: !plan.location && !plan.own, slug: event.slug
      };
      report.results.push({ title: event.title, source_url: event.source_url, ...result });
      if (result.outcome === "failed") break;
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.results.some(result => result.outcome === "failed") || report.results.length !== batch.events.length) process.exitCode = 1;
  } finally { closeSync(lock); rmSync(lockPath); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
