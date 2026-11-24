import { expect, it } from "vitest";
import { buildDiscoverySections } from "../lib/event-discovery";
import type { EventItem } from "../lib/events";

const now = new Date("2026-11-24T12:00:00Z");

function item(id: string, values: Partial<EventItem> = {}) {
  return {
    event: {
      id,
      title: "Wydarzenie",
      startDate: "2026-11-27T18:00:00+01:00",
      end_at: null,
      categorySlug: "kultura",
      price_type: "unknown",
      price: "Cena nieznana",
      ...values,
    } as EventItem,
    distanceKm: 2,
  };
}

it("uses weekend overlap, including an ongoing fair and excluding the exact Monday boundary", () => {
  const events = [
    item("fair", { startDate: "2026-11-20T10:00:00+01:00", end_at: "2026-12-01T20:00:00+01:00" }),
    item("saturday", { startDate: "2026-11-28T12:00:00+01:00" }),
    item("monday", { startDate: "2026-11-30T00:00:00+01:00" }),
    item("finished", { startDate: "2026-11-20T10:00:00+01:00", end_at: now.toISOString() }),
  ];
  const weekend = buildDiscoverySections(events, { now }).find((section) => section.id === "weekend");
  expect(weekend?.events.map(({ event }) => event.id)).toEqual(["fair", "saturday"]);
});

it("requires the seasonal keyword and the current edition date window", () => {
  const events = [
    item("fair", { title: "Jarmark bożonarodzeniowy", startDate: "2026-11-20T10:00:00+01:00", end_at: "2026-12-30T20:00:00+01:00" }),
    item("wrong-season", { title: "Jarmark bożonarodzeniowy", startDate: "2027-06-02T12:00:00+02:00" }),
    item("ordinary-fair", { title: "Jarmark książki" }),
  ];
  // The weekend shelf would otherwise claim the ongoing fair first.
  const seasonal = buildDiscoverySections(events, { now, dateFilter: "weekend" }).find((section) => section.id === "jarmarki-bozonarodzeniowe");
  expect(seasonal?.events.map(({ event }) => event.id)).toEqual(["fair"]);
});

it("omits sections that repeat active filters and leaves the source list unchanged", () => {
  const events = [
    item("concert", { categorySlug: "koncerty", price_type: "free", price: "Bezpłatne" }),
    item("family", { categorySlug: "rodzinne" }),
  ];
  const original = [...events];
  expect(buildDiscoverySections(events, { now, category: "Koncerty", priceMode: "free", dateFilter: "weekend" })
    .map((section) => section.id)).toEqual(["family"]);
  expect(events).toEqual(original);
  expect(buildDiscoverySections(events, { now, category: "Rodzina", dateFilter: "weekend" })
    .some((section) => section.id === "family")).toBe(false);
});

it("uses the declared free price and does not infer admission from a numeric zero", () => {
  const events = [
    item("free", { price_type: "free", price: "Bezpłatne" }),
    item("unknown", { price_min: 0, price_max: 0 }),
  ];
  const free = buildDiscoverySections(events, { now }).find((section) => section.id === "free");
  expect(free?.events.map(({ event }) => event.id)).toEqual(["free"]);
});

it("shows only nonempty shelves with at most six unique events each", () => {
  const events = Array.from({ length: 9 }, (_, index) => item(String(index), {
    categorySlug: "koncerty",
    price_type: "free",
    price: "Bezpłatne",
  }));
  const sections = buildDiscoverySections([...events, events[0]], { now });
  expect(sections.map((section) => section.id)).toEqual(["concerts", "free"]);
  expect(sections[0].events).toHaveLength(6);
  expect(new Set(sections[0].events.map(({ event }) => event.id)).size).toBe(6);
  expect(buildDiscoverySections([], { now })).toEqual([]);
});

it("provides existing navigation filters and keeps at most five shelves with weekend ideas first", () => {
  const events = [
    item("fair", { title: "Jarmark bożonarodzeniowy", startDate: "2026-11-28T12:00:00+01:00" }),
    item("december-fair", { title: "Jarmark bożonarodzeniowy", startDate: "2026-12-05T12:00:00+01:00" }),
    item("concert", { categorySlug: "koncerty" }),
    item("free", { price_type: "free", price: "Bezpłatne" }),
    item("family", { categorySlug: "rodzinne" }),
  ];
  const sections = buildDiscoverySections(events, { now });
  expect(sections).toHaveLength(5);
  expect(sections.find((section) => section.id === "family")?.filters).toEqual({ category: "Rodzinne" });
  expect(sections[0]).toMatchObject({ id: "weekend", filters: { dateFilter: "weekend" } });
  expect(sections[1]).toMatchObject({ id: "jarmarki-bozonarodzeniowe", href: "/jarmarki-bozonarodzeniowe" });
  expect(sections.find((section) => section.id === "concerts")?.filters).toEqual({ category: "Koncerty" });
  expect(sections.find((section) => section.id === "free")?.filters).toEqual({ priceMode: "free" });
});

it("keeps a weekend shelf even when its available events are also recommended", () => {
  const events = [item("featured-weekend", { startDate: "2026-11-28T10:00:00+01:00" })];
  const sections = buildDiscoverySections(events, { now, shownEventIds: ["featured-weekend"] });
  expect(sections.map((section) => section.id)).toEqual(["weekend"]);
});

it("leads each shelf with events not shown above and skips shelves of repeats only", () => {
  const events = [
    item("weekend-fair", { title: "Jarmark bożonarodzeniowy", startDate: "2026-11-28T12:00:00+01:00", price_type: "free", price: "Bezpłatne" }),
    item("december-fair", { title: "Jarmark bożonarodzeniowy", startDate: "2026-12-05T12:00:00+01:00", price_type: "free", price: "Bezpłatne" }),
    item("recommended", { categorySlug: "koncerty" }),
  ];
  const sections = buildDiscoverySections(events, { now, shownEventIds: ["recommended"] });
  expect(sections.map((section) => section.id)).toEqual(["weekend", "jarmarki-bozonarodzeniowe"]);
  expect(sections[1].events.map(({ event }) => event.id)).toEqual(["december-fair", "weekend-fair"]);
});
