// Quality Agent core: deterministic validation, scoring and category
// classification. No language model is involved.

import { type EventFacts, localDay, normalizeText } from "./facts.ts";

export type QualityIssue = { code: string; blocking: boolean; message: string };

export const POLAND_BBOX = { minLat: 49.0, maxLat: 54.9, minLon: 14.1, maxLon: 24.2 };

export function inPoland(lat: number | null, lon: number | null): boolean {
  return lat !== null && lon !== null && lat >= POLAND_BBOX.minLat && lat <= POLAND_BBOX.maxLat && lon >= POLAND_BBOX.minLon && lon <= POLAND_BBOX.maxLon;
}

const NOT_PUBLIC = /(zamkni[eę]t[aeyi]\b|tylko\s+dla\s+(cz[lł]onk[oó]w|pracownik[oó]w|zaproszonych)|wydarzenie\s+prywatne|private\s+event|odwo[lł]an[aey]|cancelled)/i;
/** Announcements published in event calendars that are not events. */
const NOT_EVENT = /^(specjalne\s+ceny|zmiana\s+godzin|nieczynn|og[lł]oszenie|nab[oó]r\b|rekrutacja|komunikat|uwaga[:!]|przerwa\s+(techniczna|świąteczna))/i;
/** Venue outside Poland (border towns: Görlitz, Český Těšín, Frankfurt (Oder)…). */
const FOREIGN_VENUE = /\((de|cz|sk|lt|ua|by|ru)\)|\b(niemcy|germany|deutschland|czechy|czech republic|cesko|slowacja|slovakia|litwa|lithuania|ukraina|bialorus)\b/;

export type QualityContext = { now?: Date; cityId: string | null; categorySlug: string | null; categoryFromFallback?: boolean };

export function assessQuality(facts: EventFacts, context: QualityContext): { score: number; issues: QualityIssue[] } {
  const now = context.now ?? new Date();
  const issues: QualityIssue[] = [];
  const add = (code: string, blocking: boolean, message: string) => issues.push({ code, blocking, message });
  const start = Date.parse(facts.startAt);
  if (facts.title.length < 3 || facts.title.length > 300) add("title_length", true, "Tytuł ma nieprawidłową długość.");
  if (/^[^a-ząćęłńóśźż]*$/i.test(facts.title)) add("title_garbage", true, "Tytuł nie zawiera liter.");
  if (facts.title === facts.title.toUpperCase() && facts.title.length > 25) add("title_caps", false, "Tytuł wielkimi literami.");
  if (!Number.isFinite(start)) add("start_invalid", true, "Brak poprawnej daty rozpoczęcia.");
  else {
    if (start < now.getTime() + 30 * 60_000) add("start_past", true, "Wydarzenie już się rozpoczęło lub zaczyna za chwilę.");
    if (start > now.getTime() + 18 * 30 * 86400_000) add("start_far", true, "Data dalej niż 18 miesięcy.");
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(start);
    if (!facts.isAllDay && hm === "00:00") add("midnight_start", false, "Godzina 00:00 — prawdopodobnie brak godziny rozpoczęcia.");
  }
  if (facts.endAt) {
    const end = Date.parse(facts.endAt);
    if (!(end > start)) add("end_before_start", true, "Koniec przed początkiem.");
    else if (end - start > 120 * 86400_000) add("very_long", false, "Wydarzenie trwa ponad 120 dni.");
  }
  if (facts.status !== "scheduled") add(`status_${facts.status}`, true, facts.status === "cancelled" ? "Wydarzenie odwołane." : "Wydarzenie przełożone bez nowej daty.");
  // Note: venue tags like "Wynajem" mean an external organiser, not a private event.
  if (NOT_PUBLIC.test(facts.title) || facts.keywords.some(keyword => /^(impreza zamkni[eę]ta|wydarzenie prywatne)$/i.test(keyword.trim()))) {
    add("not_public", true, "Tytuł lub kategoria źródła sugeruje wydarzenie zamknięte lub odwołane.");
  }
  if (NOT_EVENT.test(facts.title.trim())) add("not_event", true, "Ogłoszenie, a nie wydarzenie.");
  if (FOREIGN_VENUE.test(` ${normalizeText([facts.venueName, facts.address, facts.city].filter(Boolean).join(" "))} `)
    || /\((DE|CZ|SK|LT|UA|BY|RU)\)/.test([facts.venueName, facts.address, facts.city].join(" "))) {
    add("foreign_venue", true, "Miejsce poza Polską.");
  }
  if (!facts.venueName && !facts.address) add("no_venue", true, "Brak nazwy miejsca i adresu.");
  if (!facts.address) add("no_address", false, "Brak adresu.");
  if (!context.cityId) add("city_unresolved", true, "Miasto nie występuje jednoznacznie w tabeli cities.");
  if (!inPoland(facts.latitude, facts.longitude)) add("coords_missing", true, "Brak wiarygodnych współrzędnych w Polsce.");
  if (!context.categorySlug) add("category_unresolved", true, "Nie przypisano kategorii.");
  else if (context.categorySlug === "inne") add("category_generic", false, "Kategoria ogólna „inne” — wymaga przeglądu przed publikacją.");
  else if (context.categoryFromFallback) add("category_default", false, "Kategoria domyślna źródła, nie z treści wydarzenia.");
  if (facts.priceType === "paid" && facts.priceMin === null && facts.priceMax === null) add("price_inconsistent", true, "Cena paid bez kwoty.");
  if (facts.priceMin !== null && facts.priceMax !== null && facts.priceMin > facts.priceMax) add("price_inverted", true, "Odwrócony zakres ceny.");
  try { const url = new URL(facts.url); if (!/^https?:$/.test(url.protocol)) add("url_scheme", true, "Nieprawidłowy URL źródła."); }
  catch { add("url_invalid", true, "Nieprawidłowy URL źródła."); }

  const weights: Record<string, number> = { title_caps: 0.05, midnight_start: 0.25, very_long: 0.1, no_address: 0.15, category_generic: 0.2, category_default: 0.1 };
  let score = 1;
  for (const issue of issues) score -= issue.blocking ? 1 : (weights[issue.code] ?? 0.1);
  // Structured data (ICS, schema.org) carries no penalty; looser channels do.
  if (facts.method === "rss") score -= 0.1;
  return { score: Math.max(0, Math.min(1, Number(score.toFixed(3)))), issues };
}

const CATEGORY_RULES: Array<{ slug: string; re: RegExp }> = [
  { slug: "mecze", re: /\b(mecz|liga\b|ekstraklas|derby|vs\b|puchar polski|siatkowk|koszykowk|pilka nozna|pilki recznej)/ },
  { slug: "stand-up", re: /\b(stand[\s-]?up|open mic)\b/ },
  { slug: "kabaret", re: /\bkabaret/ },
  { slug: "charytatywne", re: /\b(charytatywn|wo[sś]p|zbi[oó]rk|na rzecz|aukcj|licytacj)/ },
  { slug: "festiwale", re: /\b(festiwal|festival|fest\b|dni miasta|juwenalia)/ },
  { slug: "targi", re: /\b(targi|targ\b|jarmark|kiermasz|gield|bazar|expo\b|fair\b|market\b)/ },
  { slug: "motoryzacja", re: /\b(moto|samochod|zlot|rajd|auto\s?show|tuning)/ },
  { slug: "sport", re: /\b(bieg|maraton|p[oó][lł]maraton|parkrun|turniej|zawody|rower|triathlon|sportsevent|fitness|joga|yoga|nordic)/ },
  { slug: "rodzinne", re: /\b(dla dzieci|rodzin|dzieci[eę]c|bajk|childrensevent|warsztaty dla|mikolaj|teatrzyk|familijn|maluch|\d{1,2} \d{1,2} lat[a]?\b)/ },
  { slug: "koncerty", re: /\b(koncert|musicevent|recital|orkiestr|orchest|filharmoni|symfoni|kameraln|kwartet|jazz|rock|metal|hip[\s-]?hop|rap\b|disco polo|chor\b|chorow|tour\b|trasa|tenor|przeboj|piosen|wokal|koled|pastoral|gospel|muzyk)/ },
  { slug: "imprezy", re: /\b(impreza|party|dj\b|potanc|dyskotek|bal\b|sylwester|andrzejk|festyn|dozynk|piknik)/ },
  { slug: "kultura", re: /\b(spektakl|teatr|theaterevent|wystaw|exhibitionevent|wernisa[zż]|muzeum|kino|film|screeningevent|seans|spotkan|literaryevent|wyk[lł]ad|prelekcj|opera|balet|musical|danceevent|visualartsevent|konkurs|warsztat|retro|impro|komedi|przedstawien|gra miejska|spacer)/ }
];

/** Words that make an event something other than its venue's usual programme (no default category). */
const NON_PROGRAMME = /\b(gala|konferencj|ferencja|szkoleni|webinar|msza|uroczystosc|zebrani|sesja|dyzur|forum|kongres|spotkanie biznes)/;

/** Category signals a source name gives when its events lack them (e.g. a philharmonic's artist-only titles). */
const SOURCE_NAME_RULES: Array<{ slug: string; re: RegExp }> = [
  { slug: "koncerty", re: /\b(filharmoni|orkiestr|opera|klub muzyczny|jazz club)/ },
  { slug: "kultura", re: /\b(teatr|muzeum|galeria|bibliotek)/ }
];

export function classifyCategory(facts: EventFacts, available: ReadonlySet<string>): string | null {
  const text = ` ${normalizeText([facts.title, ...facts.keywords].join(" "))} `;
  for (const rule of CATEGORY_RULES) {
    if (available.has(rule.slug) && rule.re.test(text)) return rule.slug;
  }
  return available.has("inne") ? "inne" : null;
}

/**
 * Category when the event text says nothing specific: the source's dominant category from
 * curated history, else a hint from the source name. Never for conferences, galas etc.
 */
export function fallbackCategory(facts: EventFacts, sourceDefault: string | null, sourceName: string | null, available: ReadonlySet<string>): string | null {
  if (NON_PROGRAMME.test(` ${normalizeText(facts.title)} `)) return null;
  if (sourceDefault && available.has(sourceDefault)) return sourceDefault;
  const name = ` ${normalizeText(sourceName ?? "")} `;
  return SOURCE_NAME_RULES.find(rule => available.has(rule.slug) && rule.re.test(name))?.slug ?? null;
}

/** Same rule as the curated importer: title + local day + city. */
export function sameOccurrence(a: { title: string; startAt: string; city: string }, b: { title: string; startAt: string; city: string }): boolean {
  return normalizeText(a.title) === normalizeText(b.title) && localDay(a.startAt) === localDay(b.startAt) && normalizeText(a.city) === normalizeText(b.city);
}
