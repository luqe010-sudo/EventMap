import type { EventCategory, EventItem, KnownLocation } from "./events";
import { isFreeEvent } from "./events";

export type DateFilter = "today" | "tomorrow" | "weekend" | "week" | "custom" | "all";
export type PriceFilterMode = "all" | "free" | "max";

export const DEFAULT_MAX_PRICE = 100;
export const MAX_PRICE_FILTER_LIMIT = 500;

export type EventFilters = {
  dateFilter: DateFilter;
  customDate: string;
  radiusKm: number | null;
  category: EventCategory | "Wszystkie";
  location: KnownLocation;
  isFree?: boolean;
  priceMode?: PriceFilterMode;
  maxPrice?: number | null;
};

export type PublicFilterParams = {
  dateFilter?: DateFilter;
  customDate?: string;
  priceMode?: PriceFilterMode;
  maxPrice?: number;
  radiusKm?: number;
};

export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveDateRange(dateFilter: DateFilter, customDate: string, now = new Date()): { start: Date; end: Date | null } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  if (dateFilter === "all") {
    return { start, end: null };
  }

  if (dateFilter === "today") {
    end.setDate(start.getDate() + 1);
    return { start, end };
  }

  if (dateFilter === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end.setDate(start.getDate() + 1);
    return { start, end };
  }

  if (dateFilter === "weekend") {
    const day = start.getDay();
    if (day === 0) {
      end.setDate(start.getDate() + 1);
    } else if (day === 6) {
      end.setDate(start.getDate() + 2);
    } else {
      const daysUntilSaturday = 6 - day;
      start.setDate(start.getDate() + daysUntilSaturday);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 2);
    }
    return { start, end };
  }

  if (dateFilter === "week") {
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  const customRange = parseCustomDateRange(customDate);

  if (customRange) {
    const selectedStart = new Date(`${customRange.from}T00:00:00`);
    const selectedEnd = new Date(`${customRange.to}T00:00:00`);
    selectedEnd.setDate(selectedEnd.getDate() + 1);
    return { start: selectedStart, end: selectedEnd };
  }

  end.setDate(start.getDate() + 1);
  return { start, end };
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

  return {
    ...(dateFilter ? { dateFilter } : {}),
    ...(customDate ? { customDate } : {}),
    ...(priceMode ? { priceMode } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(radiusKm != null ? { radiusKm } : {})
  };
}

export function clampMaxPrice(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_PRICE;
  return Math.min(Math.max(Math.round(value), 0), MAX_PRICE_FILTER_LIMIT);
}

function parseCustomDateRange(customDate: string) {
  const [rawFrom, rawTo] = customDate.split("/");
  const from = normalizeDateInput(rawFrom);
  const to = normalizeDateInput(rawTo);

  if (!from && !to) return null;

  const rangeFrom = from ?? to;
  const rangeTo = to ?? from;

  if (!rangeFrom || !rangeTo) return null;

  return rangeFrom <= rangeTo
    ? { from: rangeFrom, to: rangeTo }
    : { from: rangeTo, to: rangeFrom };
}

function normalizeDateInput(value?: string) {
  const trimmed = value?.trim();
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function distanceInKm(origin: KnownLocation, event: Pick<EventItem, "latitude" | "longitude">) {
  if (event.latitude == null || event.longitude == null) return Number.POSITIVE_INFINITY;

  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(event.latitude - origin.latitude);
  const longitudeDelta = toRadians(event.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const eventLatitude = toRadians(event.latitude);

  const angle =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) *
      Math.cos(eventLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}

export function filterEvents(events: EventItem[], filters: EventFilters, now = new Date()) {
  const { start, end } = resolveDateRange(filters.dateFilter, filters.customDate, now);
  const priceMode = filters.priceMode ?? (filters.isFree ? "free" : "all");

  return events
    .map((event) => ({
      event,
      distanceKm: distanceInKm(filters.location, event)
    }))
    .filter(({ event, distanceKm }) => {
      const eventDate = new Date(event.startDate);
      const matchesDate = eventDate >= start && (end === null || eventDate < end);
      const matchesRadius = filters.radiusKm == null || !Number.isFinite(distanceKm) || distanceKm <= filters.radiusKm;
      const matchesCategory = filters.category === "Wszystkie" || event.category === filters.category;
      const matchesFree = !filters.isFree || isFreeEvent(event);
      const matchesPrice = matchesPriceFilter(event, priceMode, filters.maxPrice);
      return matchesDate && matchesRadius && matchesCategory && matchesFree && matchesPrice;
    })
    .sort((first, second) => {
      const dateDelta = new Date(first.event.startDate).getTime() - new Date(second.event.startDate).getTime();
      const firstDistance = Number.isFinite(first.distanceKm) ? first.distanceKm : Number.MAX_SAFE_INTEGER;
      const secondDistance = Number.isFinite(second.distanceKm) ? second.distanceKm : Number.MAX_SAFE_INTEGER;
      return dateDelta || firstDistance - secondDistance;
    });
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
  return Math.min(Math.max(Math.round(parsed), 5), 100);
}

function serializeCustomDateRangeParam(from?: string | null, to?: string | null) {
  if (from && to) return `${from}/${to}`;
  if (to) return `/${to}`;
  return from ?? "";
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
