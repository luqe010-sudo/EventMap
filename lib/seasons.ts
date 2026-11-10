import { formatPolishDate, getDateKeyInAppTimeZone, toAppDate } from "./date-format";

/**
 * Seasonal landing pages ("jarmarki bożonarodzeniowe 2026", "sylwester 2026"...).
 * Events are matched by date window and title keywords, so no extra tables or tags are needed.
 */

export type SeasonSlug = "jarmarki-bozonarodzeniowe" | "mikolajki" | "koncerty-swiateczne" | "sylwester";

export type SeasonMatchEvent = {
  title: string;
  short_description?: string | null;
  startDate: string;
  categorySlug?: string | null;
};

type MonthDay = { month: number; day: number; yearOffset?: number };

type SeasonDefinition = {
  slug: SeasonSlug;
  /** Window start (inclusive) and end (exclusive) relative to the edition year. */
  start: MonthDay;
  end: MonthDay;
  name: (year: number) => string;
  linkLabel: string;
  title: (year: number) => string;
  description: (year: number) => string;
  intro: (year: number) => string[];
  cityHeading: (inCity: string) => string;
  emptyText: string;
  tips: { question: string; answer: string }[];
  matches: (event: SeasonMatchEvent) => boolean;
};

const MIN_INDEXABLE_EVENTS = 3;

function text(event: SeasonMatchEvent) {
  return `${event.title} ${event.short_description ?? ""}`;
}

const christmasWords = /bożonaro|bozonaro|świąt|swiateczn|mikołaj|mikolaj|advent|adwent|christmas|xmas|gwiazdk|wigili|kolęd|koled|pastorał|pastoral|choink/i;

function startsOnNewYearsEveEvening(event: SeasonMatchEvent) {
  const key = getDateKeyInAppTimeZone(event.startDate);
  if (!key.endsWith("-12-31")) return false;
  return Number(formatPolishDate(event.startDate, { hour: "2-digit", hourCycle: "h23" })) >= 18;
}

const SEASONS: SeasonDefinition[] = [
  {
    slug: "jarmarki-bozonarodzeniowe",
    start: { month: 11, day: 1 },
    end: { month: 1, day: 8, yearOffset: 1 },
    name: (year) => `Jarmarki bożonarodzeniowe ${year}`,
    linkLabel: "Jarmarki bożonarodzeniowe",
    title: (year) => `Jarmarki bożonarodzeniowe ${year} – terminy i miasta | MapaImprez`,
    description: (year) => `Kalendarz jarmarków bożonarodzeniowych ${year} w Polsce: Wrocław, Warszawa, Gdańsk, Poznań i inne miasta. Daty otwarcia, miejsca, godziny i atrakcje.`,
    intro: (year) => [
      `Jarmarki bożonarodzeniowe ${year} ruszają w większych miastach zwykle w drugiej połowie listopada i trwają do świąt, a niektóre aż do Trzech Króli. Zebraliśmy terminy, lokalizacje i linki do źródeł w jednym miejscu.`,
      "Lista obejmuje duże jarmarki miejskie oraz mniejsze kiermasze świąteczne organizowane przez domy kultury, parafie i szkoły. Przed wyjazdem sprawdź godziny otwarcia u organizatora – w weekendy stoiska często działają dłużej.",
    ],
    cityHeading: (inCity) => `Jarmark bożonarodzeniowy ${inCity}`,
    emptyText: "Terminy jarmarków na ten sezon jeszcze uzupełniamy. Zajrzyj tu ponownie w listopadzie.",
    tips: [
      { question: "Kiedy otwierają się jarmarki bożonarodzeniowe?", answer: "Największe jarmarki, np. we Wrocławiu, Warszawie i Gdańsku, startują zwykle w drugiej połowie listopada. Mniejsze kiermasze odbywają się głównie w grudniowe weekendy." },
      { question: "Czy wstęp na jarmark jest płatny?", answer: "Wstęp na jarmarki miejskie jest zazwyczaj bezpłatny. Płatne bywają wybrane atrakcje, np. diabelski młyn, karuzele czy lodowisko." },
      { question: "Do kiedy trwają jarmarki?", answer: "Część jarmarków kończy się tuż przed Wigilią, a część działa do początku stycznia. Daty zakończenia podajemy przy każdym wydarzeniu." },
    ],
    matches: (event) => /jarmark|kiermasz/i.test(event.title) && christmasWords.test(text(event)),
  },
  {
    slug: "mikolajki",
    start: { month: 11, day: 28 },
    end: { month: 12, day: 9 },
    name: (year) => `Mikołajki ${year}`,
    linkLabel: "Mikołajki",
    title: (year) => `Mikołajki ${year} – wydarzenia dla dzieci i rodzin | MapaImprez`,
    description: (year) => `Mikołajki ${year} w Polsce: spotkania ze Świętym Mikołajem, warsztaty, spektakle i biegi mikołajkowe. Sprawdź terminy, miejsca i ceny w swoim mieście.`,
    intro: (year) => [
      `Mikołajki ${year} przypadają w ${formatPolishDate(toAppDate(`${year}-12-06T12:00:00`), { weekday: "long" })}, 6 grudnia. Wiele atrakcji odbywa się też w poprzedzający weekend. Zebraliśmy spotkania z Mikołajem, warsztaty świąteczne, spektakle dla dzieci i biegi mikołajkowe.`,
      "Na część wydarzeń obowiązują zapisy lub bilety, a liczba miejsc bywa ograniczona – szczegóły i link do źródła znajdziesz na karcie wydarzenia.",
    ],
    cityHeading: (inCity) => `Mikołajki ${inCity}`,
    emptyText: "Wydarzenia mikołajkowe na ten rok jeszcze uzupełniamy.",
    tips: [
      { question: "Gdzie spotkać Świętego Mikołaja z dziećmi?", answer: "Najczęściej w domach kultury, bibliotekach, centrach nauki i na jarmarkach bożonarodzeniowych. Wiele spotkań jest bezpłatnych, ale wymaga wcześniejszych zapisów." },
      { question: "Czym są biegi mikołajkowe?", answer: "To rekreacyjne biegi, często w strojach Mikołaja, z osobnymi dystansami dla dzieci. Zapisy zwykle zamykają się kilka dni przed startem." },
    ],
    matches: (event) => /mikołaj|mikolaj/i.test(event.title),
  },
  {
    slug: "koncerty-swiateczne",
    start: { month: 11, day: 20 },
    end: { month: 12, day: 28 },
    name: (year) => `Koncerty świąteczne ${year}`,
    linkLabel: "Koncerty świąteczne",
    title: (year) => `Koncerty świąteczne ${year} – kolędy i koncerty w Polsce | MapaImprez`,
    description: (year) => `Koncerty świąteczne i kolędowe ${year}: filharmonie, chóry, gale i koncerty rodzinne w całej Polsce. Terminy, miejsca i ceny biletów.`,
    intro: (year) => [
      `Koncerty świąteczne ${year} to kolędy i pastorałki, gale w filharmoniach, występy chórów oraz koncerty rodzinne. Zebraliśmy wydarzenia z całej Polski w jednym kalendarzu.`,
      "Bilety na popularne koncerty w grudniu wyprzedają się wcześnie. Ceny i link do sprzedaży znajdziesz na karcie każdego wydarzenia.",
    ],
    cityHeading: (inCity) => `Koncerty świąteczne ${inCity}`,
    emptyText: "Koncerty świąteczne na ten sezon jeszcze uzupełniamy.",
    tips: [
      { question: "Kiedy odbywa się najwięcej koncertów świątecznych?", answer: "Najwięcej koncertów przypada na grudniowe weekendy przed świętami. Koncerty kolędowe trwają też po świętach, aż do końca stycznia." },
    ],
    matches: (event) => (event.categorySlug === "koncerty" || /koncert|concert|kolęd|koled|gala/i.test(event.title))
      && christmasWords.test(text(event))
      && !/jarmark|kiermasz/i.test(event.title),
  },
  {
    slug: "sylwester",
    start: { month: 12, day: 26 },
    end: { month: 1, day: 16, yearOffset: 1 },
    name: (year) => `Sylwester ${year}`,
    linkLabel: "Sylwester",
    title: (year) => `Sylwester ${year} – imprezy, koncerty i bale | MapaImprez`,
    description: (year) => `Gdzie na sylwestra ${year}? Koncerty sylwestrowe, bale, imprezy i biegi oraz koncerty noworoczne ${year + 1} w Polsce. Terminy, miejsca i ceny biletów.`,
    intro: (year) => [
      `Sylwester ${year}: koncerty i gale sylwestrowe w filharmoniach, bale, imprezy plenerowe i biegi sylwestrowe, a do tego koncerty noworoczne na początku ${year + 1} roku.`,
      "Miejsca na sylwestrowe koncerty i bale kończą się zwykle na kilka tygodni przed końcem roku. Przy każdym wydarzeniu podajemy cenę i link do źródła.",
    ],
    cityHeading: (inCity) => `Sylwester ${inCity}`,
    emptyText: "Wydarzenia sylwestrowe na ten rok jeszcze uzupełniamy.",
    tips: [
      { question: "Czy są darmowe imprezy sylwestrowe?", answer: "Wiele miast organizuje bezpłatne sylwestrowe koncerty plenerowe, a ich programy ogłasza zwykle w grudniu. Bezpłatne są też często biegi sylwestrowe dla dzieci." },
      { question: "Co to są koncerty noworoczne?", answer: "To gale z muzyką Straussa, operetką i przebojami muzyki filmowej, grane w pierwszych tygodniach stycznia, najczęściej w filharmoniach i domach kultury." },
    ],
    matches: (event) => /sylwest|noworoczn|nowy rok|new year/i.test(event.title) || startsOnNewYearsEveEvening(event),
  },
];

export function listSeasons() {
  return SEASONS;
}

export function getSeason(slug: string) {
  return SEASONS.find((season) => season.slug === slug) ?? null;
}

function windowDate(year: number, point: MonthDay) {
  const month = String(point.month).padStart(2, "0");
  const day = String(point.day).padStart(2, "0");
  return toAppDate(`${year + (point.yearOffset ?? 0)}-${month}-${day}T00:00:00`);
}

/** The edition whose window has not ended yet: in November 2026 that is the 2026 season. */
export function resolveSeasonEdition(season: Pick<SeasonDefinition, "start" | "end">, now = new Date()) {
  const currentYear = Number(getDateKeyInAppTimeZone(now).slice(0, 4));
  for (const year of [currentYear - 1, currentYear]) {
    const end = windowDate(year, season.end);
    if (end.getTime() > now.getTime()) return { year, start: windowDate(year, season.start), end };
  }
  return { year: currentYear + 1, start: windowDate(currentYear + 1, season.start), end: windowDate(currentYear + 1, season.end) };
}

export function isSeasonIndexable(eventCount: number) {
  return eventCount >= MIN_INDEXABLE_EVENTS;
}

export type CityGroup<T> = { city: string; citySlug: string; events: T[] };

/** Largest cities first when cities have the same number of events. */
const MAJOR_CITY_ORDER = [
  "warszawa", "krakow", "wroclaw", "lodz", "poznan", "gdansk", "szczecin", "bydgoszcz", "lublin", "bialystok",
  "katowice", "gdynia", "czestochowa", "radom", "rzeszow", "torun", "sosnowiec", "kielce", "gliwice", "olsztyn",
];

/** Groups events by city: the most events first, then alphabetically; events keep their order. */
export function groupEventsByCity<T extends { city: string; citySlug: string }>(events: T[]): CityGroup<T>[] {
  const groups = new Map<string, CityGroup<T>>();
  for (const event of events) {
    const key = event.citySlug || event.city;
    const group = groups.get(key) ?? { city: event.city, citySlug: event.citySlug, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  const rank = (group: CityGroup<T>) => {
    const index = MAJOR_CITY_ORDER.indexOf(group.citySlug);
    return index === -1 ? MAJOR_CITY_ORDER.length : index;
  };
  return [...groups.values()].sort((first, second) => second.events.length - first.events.length
    || rank(first) - rank(second)
    || first.city.localeCompare(second.city, "pl"));
}
