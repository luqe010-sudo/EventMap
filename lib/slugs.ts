import type { EventCategory, EventItem } from "./events";
import type { DateFilter, PriceFilterMode } from "./filters";
import { slugify } from "./slugify";
import { cityLocative } from "./city-locative";

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
  const citySlug = (event.citySlug || toSlug(event.city || "polska")).toLowerCase();
  const eventSlug = (event.slug || toSlug(event.title)).toLowerCase();
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
  return cityLocative(city);
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
  sortBy?: "date" | "nearest";
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

export function buildFilterQuery(params: Pick<SearchUrlParams, "dateFilter" | "customDate" | "priceMode" | "maxPrice" | "radiusKm" | "sortBy">) {
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

  if (params.sortBy === "nearest") query.set("sort", "nearest");

  return query;
}

export function appendPublicFilters(path: string, params: Parameters<typeof buildFilterQuery>[0]) {
  const query = buildFilterQuery(params);
  if (params.dateFilter === "all") query.set("kiedy", "all");
  return appendQuery(path, query);
}

function appendQuery(path: string, query: URLSearchParams) {
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
