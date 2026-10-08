import type { KnownLocation, PublicEventSearchOptions } from "./events";
import { hasLocationCoordinates } from "./event-search";
import { parsePublicFilterParams, type PublicFilterParams } from "./filters";

// List, map and category counts must interpret the same URL identically.
export function publicSearchOptionsFromParams(params: URLSearchParams): PublicEventSearchOptions {
  const filters = parsePublicFilterParams(Object.fromEntries(params.entries()));
  const hasPoint = params.has("lat") || params.has("lng");
  const point = {
    latitude: parseCoordinate(params.get("lat")),
    longitude: parseCoordinate(params.get("lng"))
  };
  if (hasPoint && !hasLocationCoordinates(point)) {
    throw new Error("Nieprawidłowe współrzędne lokalizacji.");
  }
  return {
    dateFilter: filters.dateFilter ?? "all",
    customDate: filters.customDate,
    categorySlug: params.get("categorySlug")?.trim() || undefined,
    citySlug: params.get("citySlug")?.trim() || undefined,
    location: hasPoint && hasLocationCoordinates(point) ? point : undefined,
    radiusKm: filters.radiusKm ?? (hasPoint ? 30 : null),
    priceMode: filters.priceMode ?? "all",
    maxPrice: filters.maxPrice,
    sortBy: filters.sortBy ?? "date"
  };
}

export function normalizeCitySearchFilters(filters: PublicFilterParams, location: KnownLocation): PublicFilterParams {
  if (hasLocationCoordinates(location)) return filters;
  return { ...filters, radiusKm: undefined, sortBy: "date" };
}

function parseCoordinate(value: string | null) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
