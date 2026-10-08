import type { EventItem } from "./events";

export type EventWithDistance = { event: EventItem; distanceKm: number };
export type VenueEventGroup = { key: string; venue: string | null; events: EventWithDistance[] };

/** Group only records that share the same database location, never guessed names. */
export function groupEventsByVenue(items: EventWithDistance[]): VenueEventGroup[] {
  const groups = new Map<string, VenueEventGroup>();
  for (const item of items) {
    const locationId = item.event.location?.id;
    const key = locationId ? `venue:${locationId}` : `event:${item.event.id}`;
    const group = groups.get(key);
    if (group) group.events.push(item);
    else groups.set(key, { key, venue: item.event.location?.name ?? null, events: [item] });
  }
  return [...groups.values()];
}
