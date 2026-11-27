// Legal Compliance rules. A source is blocked by default. It can be accepted
// automatically only by a rule the owner has approved beforehand (meta
// `legal_rules`). Anything ambiguous goes to the owner's decision queue.
//
// What every accepted source is allowed to give us: facts about public events
// (title, date, place, price, link). Never descriptions, images or posters;
// our descriptions are written from facts. Each published record links back
// to the organiser's page and can be retracted per source.

export const LEGAL_RULES_VERSION = "2026-11-26.v1";

export type LegalRuleId = "L4_open_license" | "L5_organizer_own_channel" | "L6_public_sector";

export const LEGAL_RULES: Record<LegalRuleId, { title: string; description: string }> = {
  L4_open_license: {
    title: "Otwarta licencja zbioru",
    description: "Źródło deklaruje licencję CC0, CC BY, CC BY-SA, PDDL lub domenę publiczną dla danych wydarzeń. Zapisujemy licencję i atrybucję; zakazy z regulaminu mają pierwszeństwo."
  },
  L5_organizer_own_channel: {
    title: "Własny kanał organizatora",
    description: "Organizator/obiekt publikuje własne wydarzenia na własnej domenie (ICS, RSS, schema.org Event, publiczne API kalendarza WordPress). robots.txt pozwala, regulamin nie zakazuje automatycznego pobierania, brak zastrzeżenia TDM. Pobieramy wyłącznie fakty, linkujemy do organizatora, opis piszemy sami, bez zdjęć."
  },
  L6_public_sector: {
    title: "Informacja sektora publicznego",
    description: "Jednostka publiczna (gmina, powiat, instytucja kultury samorządu, domena gov.pl) publikuje kalendarz wydarzeń. Ponowne wykorzystanie zgodnie z ustawą z 11.08.2021 o otwartych danych i ponownym wykorzystywaniu ISP, o ile strona nie określa warunków ograniczających. Tylko fakty, bez zdjęć i cudzych opisów."
  }
};

/** Domains we never harvest: ticket sellers, competitor aggregators, social networks behind login walls. */
export const BLOCKED_DOMAINS = [
  "biletyna.pl", "ebilet.pl", "going.pl", "goingapp.pl", "eventim.pl", "ticketmaster.pl", "kupbilecik.pl", "bilety24.pl",
  "biletin.pl", "biletomat.pl", "evenea.pl", "ticketos.pl", "eventbrite.com", "eventbrite.pl", "allevents.in", "goout.net",
  "facebook.com", "fb.com", "fb.me", "instagram.com", "tiktok.com", "x.com", "twitter.com", "youtube.com", "linkedin.com",
  "naszemiasto.pl", "trojmiasto.pl", "kulturalnie.waw.pl", "kiedy-gdzie.pl", "bilety.pl", "abilet.pl", "ticketswap.pl"
];

export function isBlockedDomain(domain: string): boolean {
  const host = domain.toLowerCase().replace(/^www\./, "");
  return BLOCKED_DOMAINS.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

const PROHIBITION_PATTERNS = [
  /zakaz(?:uje\s+si[eę]|ane\s+jest)?\s+(?:automatycznego\s+)?(?:kopiowania|pobierania|powielania|wykorzystywania|przetwarzania)/i,
  /zabrania\s+si[eę]\s+(?:kopiowania|pobierania|powielania|automatycznego)/i,
  /(?:scrap(?:ing|owania)|web\s*scraping|crawl(?:ing|er)|robot[óoy]w?\s+indeksuj)/i,
  /eksploracj[aię]\s+tekst[óo]w\s+i\s+danych/i,
  /text\s+and\s+data\s+mining/i,
  /bez\s+(?:pisemnej\s+)?zgody\s+(?:wydawcy|administratora|właściciela)\s+(?:zabronione|zakazane)/i,
  /all\s+rights\s+reserved.*(?:database|baza)/i
];

const OPEN_LICENSE_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "CC0-1.0", re: /creativecommons\.org\/publicdomain\/zero|\bCC0\b/i },
  { id: "CC-BY-4.0", re: /creativecommons\.org\/licenses\/by\/|\bCC[\s-]BY(?![\s-](?:NC|ND|SA))\b/i },
  { id: "CC-BY-SA-4.0", re: /creativecommons\.org\/licenses\/by-sa\/|\bCC[\s-]BY[\s-]SA\b/i },
  { id: "PDDL", re: /opendatacommons\.org\/licenses\/pddl/i }
];

export type LegalObservation = {
  domain: string;
  kind: string; // organizer | institution | municipality | venue | aggregator | api | unknown
  integration: string; // ics | rss | jsonld | json_api | unknown
  robotsAllowsHome: boolean;
  robotsAllowsFeed: boolean | null;
  tdmReserved: boolean;
  termsTexts: string[];
  pageText: string;
  isPublicSector: boolean;
  ownerDecision: "approved" | "rejected" | null;
};

export type LegalVerdict = {
  outcome: "approved" | "blocked" | "needs_owner";
  rule: LegalRuleId | "L0_blocklist" | "L1_owner" | "L2_robots" | "L3_terms" | "none";
  /** The rule that would accept the source once approved by the owner. */
  wouldApproveBy: LegalRuleId | null;
  basis: string;
  license: string | null;
  evidence: string[];
};

export function detectLicense(text: string): string | null {
  // Ignore NC/ND: they do not allow commercial reuse or adaptation.
  if (/creativecommons\.org\/licenses\/by-(?:nc|nd)|\bCC[\s-]BY[\s-](?:NC|ND)\b/i.test(text)) return null;
  return OPEN_LICENSE_PATTERNS.find(pattern => pattern.re.test(text))?.id ?? null;
}

export function findProhibitions(texts: string[]): string[] {
  const hits: string[] = [];
  for (const text of texts) {
    for (const pattern of PROHIBITION_PATTERNS) {
      const match = pattern.exec(text);
      if (match) hits.push(text.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80).replace(/\s+/g, " ").trim());
    }
  }
  return [...new Set(hits)].slice(0, 5);
}

export function evaluateSource(observation: LegalObservation, approvedRules: ReadonlySet<string>): LegalVerdict {
  const base = { license: null as string | null, evidence: [] as string[], wouldApproveBy: null as LegalRuleId | null };
  if (observation.ownerDecision === "approved") return { ...base, outcome: "approved", rule: "L1_owner", basis: "Decyzja właściciela." };
  if (observation.ownerDecision === "rejected") return { ...base, outcome: "blocked", rule: "L1_owner", basis: "Odrzucone przez właściciela." };
  if (isBlockedDomain(observation.domain) || observation.kind === "aggregator") {
    return { ...base, outcome: "blocked", rule: "L0_blocklist", basis: "Serwis biletowy, agregator lub sieć społecznościowa — nie pobieramy hurtowo cudzych baz." };
  }
  if (!observation.robotsAllowsHome || observation.robotsAllowsFeed === false) {
    return { ...base, outcome: "blocked", rule: "L2_robots", basis: "robots.txt nie pozwala na pobieranie." };
  }
  const prohibitions = findProhibitions(observation.termsTexts);
  if (observation.tdmReserved || prohibitions.length) {
    return {
      ...base, outcome: "needs_owner", rule: "L3_terms",
      basis: observation.tdmReserved ? "Strona zastrzega eksplorację tekstu i danych (TDM)." : "Regulamin może zakazywać pobierania/kopiowania.",
      evidence: prohibitions
    };
  }
  const license = detectLicense(observation.pageText + "\n" + observation.termsTexts.join("\n"));
  let candidate: LegalRuleId | null = null;
  let basis = "";
  if (license) { candidate = "L4_open_license"; basis = `Licencja ${license}.`; }
  else if (observation.isPublicSector && observation.integration !== "unknown") { candidate = "L6_public_sector"; basis = "Informacja sektora publicznego, brak warunków ograniczających."; }
  else if (["organizer", "institution", "venue", "municipality"].includes(observation.kind) && ["ics", "rss", "jsonld", "json_api"].includes(observation.integration)) {
    candidate = "L5_organizer_own_channel"; basis = "Własny kanał organizatora, brak zakazu w regulaminie, robots.txt pozwala.";
  }
  if (!candidate) return { ...base, outcome: "needs_owner", rule: "none", basis: "Brak jednoznacznej podstawy — wymaga decyzji właściciela.", license };
  if (!approvedRules.has(candidate)) {
    return { ...base, outcome: "needs_owner", rule: "none", wouldApproveBy: candidate, license, basis: `${basis} Reguła ${candidate} czeka na zatwierdzenie właściciela.` };
  }
  return { ...base, outcome: "approved", rule: candidate, wouldApproveBy: candidate, license, basis };
}

export function isPublicSectorDomain(domain: string, kind: string): boolean {
  const host = domain.toLowerCase();
  return host.endsWith(".gov.pl") || /(^|\.)(um|ug|ugm|gmina|powiat|starostwo|bip)[.-]/.test(host) || /\.(gmina|powiat)\.pl$/.test(host) || kind === "municipality";
}
