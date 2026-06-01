import type { EventCategory, EventItem } from "./events";

export function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function eventToSlug(event: EventItem): string {
  return event.slug || toSlug(event.title);
}

export function eventPath(event: EventItem): string {
  return `/wydarzenie/${eventToSlug(event)}`;
}

export function categoryPath(category: EventCategory): string {
  return `/kategoria/${toSlug(category)}`;
}
