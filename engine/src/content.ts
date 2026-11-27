// Content Agent core. Our own short descriptions written only from facts. The
// source's description is never read here, so nothing creative is copied and
// injected text from a page cannot reach the output.

import type { EventFacts } from "./facts.ts";

const CATEGORY_NOUN: Record<string, string> = {
  koncerty: "Koncert", kultura: "Wydarzenie kulturalne", rodzinne: "Wydarzenie rodzinne", targi: "Targi / jarmark",
  sport: "Wydarzenie sportowe", mecze: "Mecz", imprezy: "Impreza", festiwale: "Festiwal", charytatywne: "Wydarzenie charytatywne",
  "stand-up": "Stand-up", kabaret: "Kabaret", motoryzacja: "Wydarzenie motoryzacyjne", inne: "Wydarzenie"
};

const WEEKDAY_ACCUSATIVE: Record<string, string> = {
  poniedziałek: "w poniedziałek", wtorek: "we wtorek", środa: "w środę", czwartek: "w czwartek",
  piątek: "w piątek", sobota: "w sobotę", niedziela: "w niedzielę"
};

function parts(iso: string) {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(date);
  return { weekday, day, time };
}

/** Titles that already contain quotation marks are not wrapped again. */
function quoteTitle(title: string): string {
  const clean = title.replace(/[.\s]+$/, "");
  return /[„”"«»]/.test(clean) ? clean : `„${clean}”`;
}

/** 00:00 almost always means "time not given" — never print it as a start time. */
function showTime(time: string, allDay: boolean): boolean {
  return !allDay && time !== "00:00";
}

/** Label form: "sobota, 12 grudnia 2026, godz. 18:00". */
function formatWhen(facts: EventFacts): string {
  const { weekday, day, time } = parts(facts.startAt);
  return showTime(time, facts.isAllDay) ? `${weekday}, ${day}, godz. ${time}` : `${weekday}, ${day}`;
}

/** Sentence form: "w sobotę, 12 grudnia 2026 r., o godz. 18:00". */
function formatWhenSentence(iso: string, allDay: boolean): string {
  const { weekday, day, time } = parts(iso);
  const when = `${WEEKDAY_ACCUSATIVE[weekday] ?? weekday}, ${day} r.`;
  return showTime(time, allDay) ? `${when}, o godz. ${time}` : when;
}

/** End: same day → "Zakończenie: godz. 22:00."; another day → "Potrwa do 15 stycznia 2027 r." */
function formatEnd(facts: EventFacts): string | null {
  if (!facts.endAt) return null;
  const start = parts(facts.startAt);
  const end = parts(facts.endAt);
  if (start.day === end.day) return showTime(end.time, facts.isAllDay) ? `Zakończenie: godz. ${end.time}.` : null;
  return `Potrwa do ${end.day} r.`;
}

function formatPrice(facts: EventFacts): string {
  if (facts.priceType === "free") return "Wstęp wolny.";
  if (facts.priceType === "paid" && facts.priceMin !== null) {
    const fmt = (value: number) => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
    if (facts.priceMax !== null && facts.priceMax !== facts.priceMin) return `Bilety: ${fmt(facts.priceMin)}–${fmt(facts.priceMax)} ${facts.currency === "PLN" ? "zł" : facts.currency}.`;
    return `Bilety: ${fmt(facts.priceMin)} ${facts.currency === "PLN" ? "zł" : facts.currency}.`;
  }
  return "Informacje o biletach i zasadach wstępu podaje organizator.";
}

export function writeDescriptions(facts: EventFacts, categorySlug: string, cityName: string): { short: string; long: string } {
  const noun = CATEGORY_NOUN[categorySlug] ?? "Wydarzenie";
  const place = [facts.venueName, facts.address].filter(Boolean).join(", ");
  const where = place ? `${place}, ${cityName}` : cityName;
  const when = formatWhen(facts);
  const price = formatPrice(facts);
  const short = `${noun}: ${when}, ${where}. ${price}`.slice(0, 480);
  const sentences = [
    `${noun} ${quoteTitle(facts.title)} odbędzie się ${formatWhenSentence(facts.startAt, facts.isAllDay)}`.replace(/([^.])$/, "$1."),
    `Miejsce: ${where}.`,
    formatEnd(facts),
    facts.organizerName ? `Organizator: ${facts.organizerName}.` : null,
    price,
    "Informacje pochodzą ze strony organizatora. Przed wyjściem sprawdź aktualne szczegóły, ewentualne zmiany terminu i zasady wstępu u źródła."
  ].filter(Boolean);
  return { short, long: sentences.join(" ") };
}
