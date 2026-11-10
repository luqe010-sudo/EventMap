import { formatPolishDate } from "./date-format";
import { resolveDateRange } from "./date-range";
import { formatInCity } from "./slugs";

export type ListingTimeSlug = "dzis" | "weekend" | "ten-tydzien";

const BRAND_SUFFIX = " | MapaImprez";
const MAX_TITLE_LENGTH = 70;

function withBrand(title: string) {
  return title.length + BRAND_SUFFIX.length <= MAX_TITLE_LENGTH ? `${title}${BRAND_SUFFIX}` : title;
}

function monthYear(now: Date) {
  return formatPolishDate(now, { month: "long", year: "numeric" });
}

function dayAndGenitiveMonth(date: Date) {
  const [day, ...month] = formatPolishDate(date, { day: "numeric", month: "long" }).split(" ");
  return { day, month: month.join(" ") };
}

function dayMonth(date: Date) {
  return formatPolishDate(date, { day: "numeric", month: "long" });
}

/** "14–15 listopada" or "29 listopada – 1 grudnia" for the weekend that the listing shows. */
export function weekendLabel(now = new Date()) {
  const { start, end } = resolveDateRange("weekend", "", now);
  const last = new Date((end ?? start).getTime() - 12 * 60 * 60 * 1000);
  const first = dayAndGenitiveMonth(start);
  const final = dayAndGenitiveMonth(last);
  if (first.day === final.day && first.month === final.month) return `${first.day} ${first.month}`;
  return first.month === final.month
    ? `${first.day}–${final.day} ${final.month}`
    : `${first.day} ${first.month} – ${final.day} ${final.month}`;
}

export function cityListingSeo(cityLabel: string, now = new Date()) {
  const inCity = formatInCity(cityLabel);
  return {
    title: withBrand(`Imprezy ${inCity} – ${monthYear(now)}: koncerty i wydarzenia`),
    description: `Aktualny kalendarz imprez ${inCity}: koncerty, festyny, wydarzenia rodzinne, sport i kultura. Sprawdź, co robić dziś i w weekend – z mapą, cenami i godzinami.`,
  };
}

export function cityTimeListingSeo(cityLabel: string, slug: ListingTimeSlug, now = new Date()) {
  const inCity = formatInCity(cityLabel);
  if (slug === "dzis") {
    return {
      title: withBrand(`Imprezy ${inCity} dziś, ${dayMonth(now)} – co robić?`),
      description: `Co robić dziś ${inCity}? Koncerty, spektakle, festyny i wydarzenia rodzinne na ${dayMonth(now)} – z mapą, godzinami i cenami biletów.`,
    };
  }
  if (slug === "weekend") {
    const label = weekendLabel(now);
    return {
      title: withBrand(`Co robić ${inCity} w weekend ${label}?`),
      description: `Imprezy ${inCity} w weekend ${label}: koncerty, wydarzenia dla dzieci, festyny, sport i kultura. Plan na sobotę i niedzielę z mapą i cenami.`,
    };
  }
  return {
    title: withBrand(`Imprezy ${inCity} w tym tygodniu – kalendarz wydarzeń`),
    description: `Wydarzenia ${inCity} w najbliższych 7 dniach: koncerty, spektakle, festyny i wydarzenia rodzinne. Sprawdź godziny, miejsca i ceny.`,
  };
}
