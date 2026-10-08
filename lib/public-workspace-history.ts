import type { CategoryOption, EventCategory, KnownLocation } from "./events";
import { hasLocationCoordinates } from "./event-search";
import { DEFAULT_MAX_PRICE, parsePublicFilterParams, type DateFilter, type PriceFilterMode } from "./filters";
import { normalizeCitySearchFilters, publicSearchOptionsFromParams } from "./public-search-params";
import { toPluralCategorySlug, toSlug } from "./slugs";

export type PublicWorkspaceSearchState = {
  category: EventCategory | "Wszystkie";
  location: KnownLocation | null;
  locationMode: "city" | "radius";
  radiusKm: number;
  dateFilter: DateFilter;
  customDate: string;
  priceMode: PriceFilterMode;
  maxPrice: number;
  sortBy: "date" | "nearest";
};

const ROUTE_DATES: Record<string, DateFilter> = { dzis: "today", weekend: "weekend", "ten-tydzien": "week" };

/** Reconstruct the same search as its server route when browser history changes. */
export function restorePublicWorkspaceSearch(
  workspaceUrl: string,
  origin: string,
  categories: CategoryOption[],
  locations: ReadonlyMap<string, KnownLocation>
): PublicWorkspaceSearchState | null {
  try {
    const url = new URL(workspaceUrl, origin);
    if (url.origin !== origin) return null;
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    let category: PublicWorkspaceSearchState["category"] = "Wszystkie";
    if (segments[0] && segments[0] !== "lokalizacja") {
      const option = categories.find(item =>
        toPluralCategorySlug(item.slug) === segments[0] || toPluralCategorySlug(toSlug(item.name)) === segments[0]);
      if (option) { category = option.name; segments.shift(); }
    }

    let location: KnownLocation | null = null;
    let routeDate: DateFilter | undefined;
    let filters = parsePublicFilterParams(Object.fromEntries(url.searchParams));
    if (segments[0] === "lokalizacja" && segments.length === 1) {
      const point = publicSearchOptionsFromParams(url.searchParams);
      if (!hasLocationCoordinates(point.location)) return null;
      location = { ...point.location, label: "Wybrana lokalizacja", aliases: [] };
      filters = { ...filters, radiusKm: point.radiusKm ?? 30 };
    } else if (segments.length) {
      location = locations.get(segments[0]) ?? null;
      if (!location || segments.length > 2 || (segments[1] && !ROUTE_DATES[segments[1]])) return null;
      routeDate = ROUTE_DATES[segments[1]];
      filters = normalizeCitySearchFilters(filters, location);
    } else {
      filters = { ...filters, radiusKm: undefined, sortBy: "date" };
    }

    return {
      category,
      location,
      locationMode: location && filters.radiusKm != null ? "radius" : "city",
      radiusKm: filters.radiusKm ?? 100,
      dateFilter: filters.dateFilter ?? routeDate ?? "all",
      customDate: filters.customDate ?? "",
      priceMode: filters.priceMode ?? "all",
      maxPrice: filters.maxPrice ?? DEFAULT_MAX_PRICE,
      sortBy: filters.sortBy ?? "date"
    };
  } catch { return null; }
}
