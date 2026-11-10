import type { EventItem } from "./events";
import { formatPolishDate } from "./date-format";
import { formatEventCardPrice } from "./event-presentation";
import { formatInCity } from "./slugs";

type SeoEvent = Pick<
  EventItem,
  | "title"
  | "city"
  | "startDate"
  | "is_all_day"
  | "address"
  | "location"
  | "short_description"
  | "description"
  | "price_type"
  | "price_min"
  | "price_max"
  | "currency"
  | "price"
>;

const BRAND_SUFFIX = " | MapaImprez";
const MAX_TITLE_LENGTH = 70;
const MAX_MAIN_TITLE_LENGTH = 52;
const MAX_DESCRIPTION_LENGTH = 160;

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLocaleLowerCase("pl-PL");
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isShouting(segment: string) {
  const letters = segment.replace(/[^\p{L}]/gu, "");
  return letters.length > 4 && letters === letters.toLocaleUpperCase("pl-PL") && letters !== letters.toLocaleLowerCase("pl-PL");
}

function toTitleCase(segment: string) {
  return segment.toLocaleLowerCase("pl-PL").replace(/(^|[\s\-/])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase("pl-PL"));
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/u, "")}…`;
}

/** Turns "ATB | FINAL CHAPTER | POLAND TOUR" into "ATB – Final Chapter Poland Tour". */
export function cleanEventTitle(title: string) {
  const segments = collapseWhitespace(title)
    .split(/\s*\|\s*/)
    .map((segment) => (isShouting(segment) ? toTitleCase(segment) : segment))
    .filter(Boolean);
  if (segments.length === 0) return collapseWhitespace(title);
  const [first, ...rest] = segments;
  return rest.length ? `${first} – ${rest.join(" ")}` : first;
}

function titleMentionsCity(title: string, city: string) {
  const foldedCity = fold(city.trim());
  if (!foldedCity) return true;
  // Match the city stem so inflected forms ("w Gdyni", "Wrocławiu") count as a mention.
  const stem = foldedCity.length > 5 ? foldedCity.slice(0, foldedCity.length - 2) : foldedCity;
  return fold(title).includes(stem);
}

function shortDate(event: Pick<SeoEvent, "startDate">) {
  return formatPolishDate(event.startDate, { day: "numeric", month: "numeric", year: "numeric" });
}

function venueName(event: Pick<SeoEvent, "city" | "address" | "location">) {
  const venue = event.location?.name?.trim() || event.address.split(",")[0]?.trim() || "";
  return venue && fold(venue) !== fold(event.city) ? venue : "";
}

export function buildEventSeoTitle(event: SeoEvent) {
  const main = truncateAtWord(cleanEventTitle(event.title), MAX_MAIN_TITLE_LENGTH);
  const city = event.city.trim();
  const date = shortDate(event);
  const place = city && !titleMentionsCity(main, city) ? ` ${formatInCity(city)}` : "";
  const base = `${main}${place}${date ? ` – ${date}` : ""}`;
  return base.length + BRAND_SUFFIX.length <= MAX_TITLE_LENGTH ? `${base}${BRAND_SUFFIX}` : base;
}

function priceLabel(event: SeoEvent) {
  const price = formatEventCardPrice(event).replace(/,00(?=\D|$)/g, "");
  if (!price || /nieznana/i.test(price)) return "";
  if (price === "Bezpłatne") return "wstęp bezpłatny";
  return /^(od|do)\s/.test(price) ? `bilety ${price}` : `bilety: ${price}`;
}

export function buildEventSeoDescription(event: SeoEvent) {
  const dateText = formatPolishDate(event.startDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const day = dateText ? dateText.charAt(0).toUpperCase() + dateText.slice(1) : "";
  const time = event.is_all_day ? "" : formatPolishDate(event.startDate, { hour: "2-digit", minute: "2-digit" });
  const where = [venueName(event), event.city.trim()].filter(Boolean).join(", ");
  const facts = [[day, time].filter(Boolean).join(", godz. "), where, priceLabel(event)].filter(Boolean).join(" · ");
  const summary = collapseWhitespace(event.short_description || event.description || "");
  const text = summary ? `${facts}. ${summary}` : `${facts}. Sprawdź szczegóły, mapę dojazdu i źródło wydarzenia.`;
  return truncateAtWord(text, MAX_DESCRIPTION_LENGTH);
}
