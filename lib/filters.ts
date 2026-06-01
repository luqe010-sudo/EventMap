import type { EventCategory, EventItem, KnownLocation } from "./events";
import { isFreeEvent } from "./events";

export type DateFilter = "today" | "tomorrow" | "weekend" | "week" | "custom";

export type EventFilters = {
  dateFilter: DateFilter;
  customDate: string;
  radiusKm: number;
  category: EventCategory | "Wszystkie";
  location: KnownLocation;
  isFree?: boolean;
};

export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveDateRange(dateFilter: DateFilter, customDate: string, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

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

  if (customDate) {
    const selected = new Date(`${customDate}T00:00:00`);
    const selectedEnd = new Date(selected);
    selectedEnd.setDate(selected.getDate() + 1);
    return { start: selected, end: selectedEnd };
  }

  end.setDate(start.getDate() + 1);
  return { start, end };
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

  return events
    .map((event) => ({
      event,
      distanceKm: distanceInKm(filters.location, event)
    }))
    .filter(({ event, distanceKm }) => {
      const eventDate = new Date(event.startDate);
      const matchesDate = eventDate >= start && eventDate < end;
      const matchesRadius = !Number.isFinite(distanceKm) || distanceKm <= filters.radiusKm;
      const matchesCategory = filters.category === "Wszystkie" || event.category === filters.category;
      const matchesFree = !filters.isFree || isFreeEvent(event);
      return matchesDate && matchesRadius && matchesCategory && matchesFree;
    })
    .sort((first, second) => {
      const dateDelta = new Date(first.event.startDate).getTime() - new Date(second.event.startDate).getTime();
      const firstDistance = Number.isFinite(first.distanceKm) ? first.distanceKm : Number.MAX_SAFE_INTEGER;
      const secondDistance = Number.isFinite(second.distanceKm) ? second.distanceKm : Number.MAX_SAFE_INTEGER;
      return dateDelta || firstDistance - secondDistance;
    });
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
