import type { EventCategory, EventItem, KnownLocation } from "./events";
import { isFreeEvent } from "./events";
import { comparePublicSearchItems, distanceBetweenCoordinates, type PublicEventSort } from "./event-search";
import { eventOverlapsWindow } from "./event-dates";
import { normalizeDateInput, resolveDateRange } from "./date-range";
export { resolveDateRange } from "./date-range";

export type DateFilter = "today" | "tomorrow" | "weekend" | "week" | "custom" | "all";
export type PriceFilterMode = "all" | "free" | "max";

export const DEFAULT_MAX_PRICE = 100;
export const MAX_PRICE_FILTER_LIMIT = 500;
export const MAX_RADIUS_FILTER_LIMIT = 200;

export type EventFilters = {
  dateFilter: DateFilter;
  customDate: string;
  radiusKm: number | null;
  category: EventCategory | "Wszystkie";
  location: KnownLocation;
  isFree?: boolean;
  priceMode?: PriceFilterMode;
  maxPrice?: number | null;
  sortBy?: PublicEventSort;
};

export type PublicFilterParams = {
  dateFilter?: DateFilter;
  customDate?: string;
  priceMode?: PriceFilterMode;
  maxPrice?: number;
  radiusKm?: number;
  sortBy?: PublicEventSort;
};

export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parsePublicFilterParams(
  params: Record<string, string | string[] | undefined>
): PublicFilterParams {
  const dateFilter = parseDateFilterParam(readParam(params.kiedy));
  const customDate = serializeCustomDateRangeParam(
    normalizeDateInput(readParam(params.dataOd)),
    normalizeDateInput(readParam(params.dataDo))
  );
  const priceMode = parsePriceModeParam(readParam(params.cena), readParam(params.cenaMax));
  const maxPrice = parseMaxPriceParam(readParam(params.cenaMax));
  const radiusKm = parseRadiusParam(readParam(params.radius));
  const sortParam = readParam(params.sort);
  const sortBy = sortParam === "date" || sortParam === "nearest" ? sortParam : undefined;

  return {
    ...(dateFilter ? { dateFilter } : {}),
    ...(customDate ? { customDate } : {}),
    ...(priceMode ? { priceMode } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(radiusKm != null ? { radiusKm } : {}),
    ...(sortBy ? { sortBy } : {})
  };
}

export function clampMaxPrice(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_PRICE;
  return Math.min(Math.max(Math.round(value), 0), MAX_PRICE_FILTER_LIMIT);
}

export function distanceInKm(origin: KnownLocation, event: Pick<EventItem, "latitude" | "longitude">) {
  return distanceBetweenCoordinates(origin, event);
}

export function filterEvents(events: EventItem[], filters: EventFilters, now = new Date()) {
  const { start, end } = resolveDateRange(filters.dateFilter, filters.customDate, now);
  const lowerBound = new Date(Math.max(start.getTime(), now.getTime()));
  const priceMode = filters.priceMode ?? (filters.isFree ? "free" : "all");

  return events
    .map((event) => ({
      event,
      distanceKm: distanceInKm(filters.location, event)
    }))
    .filter(({ event, distanceKm }) => {
      const matchesDate = eventOverlapsWindow(event.startDate, event.end_at, lowerBound, end);
      const matchesRadius = filters.radiusKm == null || distanceKm <= filters.radiusKm;
      const matchesCategory = filters.category === "Wszystkie" || event.category === filters.category;
      const matchesFree = !filters.isFree || isFreeEvent(event);
      const matchesPrice = matchesPriceFilter(event, priceMode, filters.maxPrice);
      return matchesDate && matchesRadius && matchesCategory && matchesFree && matchesPrice;
    })
    .sort((first, second) => comparePublicSearchItems(first.event, second.event, filters.sortBy, filters.location));
}

function matchesPriceFilter(
  event: Pick<EventItem, "price_type" | "price" | "price_min" | "price_max">,
  mode: PriceFilterMode,
  maxPrice?: number | null
) {
  if (mode === "all") return true;
  if (mode === "free") return isFreeEvent(event);

  const limit = clampMaxPrice(maxPrice ?? DEFAULT_MAX_PRICE);
  if (isFreeEvent(event)) return true;

  const lowestKnownPrice = event.price_min ?? event.price_max;
  return lowestKnownPrice != null && lowestKnownPrice <= limit;
}

function parseDateFilterParam(value?: string): DateFilter | undefined {
  if (
    value === "today" ||
    value === "tomorrow" ||
    value === "weekend" ||
    value === "week" ||
    value === "custom" ||
    value === "all"
  ) {
    return value;
  }
  return undefined;
}

function parsePriceModeParam(priceMode?: string, maxPrice?: string): PriceFilterMode | undefined {
  if (priceMode === "free" || priceMode === "all") return priceMode;
  if (priceMode === "max" || maxPrice) return "max";
  return undefined;
}

function parseMaxPriceParam(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? clampMaxPrice(parsed) : undefined;
}

function parseRadiusParam(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(Math.round(parsed), 5), MAX_RADIUS_FILTER_LIMIT);
}

function serializeCustomDateRangeParam(from?: string | null, to?: string | null) {
  if (from && to) return `${from}/${to}`;
  if (to) return `/${to}`;
  return from ?? "";
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
