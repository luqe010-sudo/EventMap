import { expect, it } from "vitest";
import { groupEventsByVenue } from "../lib/event-groups";
import type { EventItem } from "../lib/events";

function item(id: string, locationId: string | null, name = "Klub") {
  return { event: { id, location: locationId ? { id: locationId, name } : null } as EventItem, distanceKm: 2 };
}

it("combines the same venue across the loaded page while keeping its event order", () => {
  const events = [item("a", "venue1"), item("b", "venue2"), item("c", "venue1")];
  const groups = groupEventsByVenue(events);
  expect(groups.map(g => g.events.map(e => e.event.id))).toEqual([["a", "c"], ["b"]]);
  expect(events.map(e => e.event.id)).toEqual(["a", "b", "c"]);
});

it("does not combine different venues with identical names", () => {
  expect(groupEventsByVenue([item("a", "venue1"), item("b", "venue2")])).toHaveLength(2);
});

it("keeps events with unknown locations separate", () => {
  expect(groupEventsByVenue([item("a", null), item("b", null)])).toHaveLength(2);
});
