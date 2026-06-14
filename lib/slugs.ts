import type { EventCategory, EventItem } from "./events";
import type { DateFilter, PriceFilterMode } from "./filters";
import { slugify } from "./slugify";

export function toSlug(text: string): string {
  return slugify(text);
  /*
  return text
    .trim()
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  */
}

export function eventToSlug(event: EventItem): string {
  return event.slug || toSlug(event.title);
}

export function eventPath(event: EventItem): string {
  const categorySlug = toPluralCategorySlug(event.categorySlug || toSlug(event.category || "inne"));
  const citySlug = event.citySlug || toSlug(event.city || "polska");
  const eventSlug = event.slug || toSlug(event.title);
  return `/${categorySlug}/${citySlug}/${eventSlug}`;
}

export function categoryPath(category: string): string {
  return `/${toPluralCategorySlug(toSlug(category))}`;
}

export function toPluralCategoryName(name: string): string {
  const n = name.trim();
  const lower = n.toLowerCase();
  if (lower === "koncert") return "Koncerty";
  if (lower === "festyn") return "Festyny";
  if (lower === "dozynki" || lower === "dożynki") return "Dożynki";
  if (lower === "rodzina") return "Rodzinne";
  if (lower === "motoryzacja") return "Motoryzacja";
  if (lower === "kultura") return "Kultura";
  if (lower === "festiwal") return "Festiwale";
  if (lower === "kabaret") return "Kabarety";
  return n;
}

export function toPluralCategorySlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (s === "koncert") return "koncerty";
  if (s === "festyn") return "festyny";
  if (s === "dozynki" || s === "dożynki") return "dozynki";
  if (s === "rodzina") return "rodzinne";
  if (s === "motoryzacja") return "motoryzacja";
  if (s === "kultura") return "kultura";
  if (s === "festiwal") return "festiwale";
  if (s === "kabaret") return "kabarety";
  return s;
}

export function formatInCity(city: string): string {
  const name = city.trim();
  const lower = name.toLowerCase();

  // Dictionary of common cities to locative form with preposition
  const dictionary: Record<string, string> = {
    wroclaw: "we Wrocławiu",
    wrocław: "we Wrocławiu",
    warszawa: "w Warszawie",
    krakow: "w Krakowie",
    kraków: "w Krakowie",
    poznan: "w Poznaniu",
    poznań: "w Poznaniu",
    gdansk: "w Gdańsku",
    gdańsk: "w Gdańsku",
    lodz: "w Łodzi",
    łódź: "w Łodzi",
    katowice: "w Katowicach",
    szczecin: "w Szczecinie",
    gdynia: "w Gdyni",
    sopot: "w Sopocie",
    dzierzoniow: "w Dzierżoniowie",
    dzierżoniów: "w Dzierżoniowie",
    klodzko: "w Kłodzku",
    kłodzko: "w Kłodzku",
    lublin: "w Lublinie",
    bydgoszcz: "w Bydgoszczy",
    bialystok: "w Białymstoku",
    białystok: "w Białymstoku",
    torun: "w Toruniu",
    toruń: "w Toruniu",
    rzeszow: "w Rzeszowie",
    rzeszów: "w Rzeszowie",
    sosnowiec: "w Sosnowcu",
    gliwice: "w Gliwicach",
    olsztyn: "w Olsztynie",
    zabrze: "w Zabrzu",
    bielsko: "w Bielsku-Białej",
    "bielsko-biala": "w Bielsku-Białej",
    "bielsko-biała": "w Bielsku-Białej",
  };

  if (dictionary[lower]) {
    return dictionary[lower];
  }

  const mountainCity = formatGoraCity(name, lower);
  if (mountainCity) {
    return mountainCity;
  }

  let locative = name;
  let preposition = "w";

  // If city name starts with W or F followed by another consonant, use "we"
  if (/^[wf][^aeiouyąęóoszn]/i.test(lower)) {
    preposition = "we";
  }

  if (lower.endsWith("a")) {
    locative = name.slice(0, -1) + "ie";
  } else if (lower.endsWith("o")) {
    locative = name.slice(0, -1) + "u";
  } else if (lower.endsWith("y")) {
    locative = name.slice(0, -1) + "ach";
  } else if (lower.endsWith("e") && !lower.endsWith("ice")) {
    locative = name + "m";
  } else if (lower.endsWith("ice")) {
    locative = name.slice(0, -2) + "ach";
  } else if (lower.endsWith("ec")) {
    locative = name.slice(0, -2) + "cu";
  } else {
    if (lower.endsWith("dź")) {
      locative = name.slice(0, -2) + "dzi";
    } else if (lower.endsWith("k") || lower.endsWith("ch") || lower.endsWith("g") || lower.endsWith("h")) {
      locative = name + "u";
    } else if (
      lower.endsWith("m") ||
      lower.endsWith("n") ||
      lower.endsWith("p") ||
      lower.endsWith("s") ||
      lower.endsWith("t") ||
      lower.endsWith("z")
    ) {
      locative = name + "ie";
    } else if (lower.endsWith("r")) {
      locative = name + "ze";
    }
  }

  return `${preposition} ${locative}`;
}

function formatGoraCity(name: string, lower: string) {
  if (!lower.endsWith(" góra")) return null;

  const mountainName = "Góra";
  const prefix = name.slice(0, -mountainName.length).trim();
  if (!prefix) return "w Górze";

  const prefixLocative = prefix.endsWith("a")
    ? `${prefix.slice(0, -1)}ej`
    : prefix;

  return `w ${prefixLocative} Górze`;
}

export type SearchUrlParams = {
  categorySlug?: string;       // plural slug, e.g. "koncerty"
  citySlug?: string;           // e.g. "wroclaw"
  geoLocation?: { lat: number; lng: number; radius: number };
  dateFilter?: DateFilter;
  customDate?: string;
  priceMode?: PriceFilterMode;
  maxPrice?: number | null;
  radiusKm?: number | null;
};

/**
 * Builds a navigation URL from the current search filter state.
 * Used by the "Znajdź" button on all pages.
 */
export function buildSearchUrl(params: SearchUrlParams): string {
  const { categorySlug, citySlug, geoLocation } = params;
  const query = buildFilterQuery(params);

  // category + city
  if (categorySlug && citySlug) {
    return appendQuery(`/${categorySlug}/${citySlug}`, query);
  }

  // category + geolocation (non-known city)
  if (categorySlug && geoLocation) {
    query.set("lat", String(geoLocation.lat));
    query.set("lng", String(geoLocation.lng));
    query.set("radius", String(geoLocation.radius));
    return appendQuery(`/${categorySlug}/lokalizacja`, query);
  }

  // category only
  if (categorySlug) {
    return appendQuery(`/${categorySlug}`, query);
  }

  // city only
  if (citySlug) {
    return appendQuery(`/${citySlug}`, query);
  }

  // geolocation only
  if (geoLocation) {
    query.set("lat", String(geoLocation.lat));
    query.set("lng", String(geoLocation.lng));
    query.set("radius", String(geoLocation.radius));
    return appendQuery(`/lokalizacja`, query);
  }

  // nothing selected → stay home
  return appendQuery(`/`, query);
}

function buildFilterQuery(params: Pick<SearchUrlParams, "dateFilter" | "customDate" | "priceMode" | "maxPrice" | "radiusKm">) {
  const query = new URLSearchParams();

  if (params.dateFilter && params.dateFilter !== "all") {
    query.set("kiedy", params.dateFilter);
    if (params.dateFilter === "custom") {
      const [from = "", to = ""] = (params.customDate ?? "").split("/");
      if (from) query.set("dataOd", from);
      if (to) query.set("dataDo", to);
    }
  }

  if (params.priceMode === "free") {
    query.set("cena", "free");
  } else if (params.priceMode === "max" && params.maxPrice != null) {
    query.set("cena", "max");
    query.set("cenaMax", String(params.maxPrice));
  }

  if (params.radiusKm != null) {
    query.set("radius", String(params.radiusKm));
  }

  return query;
}

function appendQuery(path: string, query: URLSearchParams) {
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
