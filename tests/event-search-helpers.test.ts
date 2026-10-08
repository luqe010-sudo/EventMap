import { expect, it } from "vitest";
import { comparePublicSearchItems, distanceBetweenCoordinates, hasLocationCoordinates, radiusBoundingBox, type Coordinates } from "../lib/event-search";
import { filterEvents, parsePublicFilterParams } from "../lib/filters";
import type { EventItem, KnownLocation } from "../lib/events";

const origin: KnownLocation & Coordinates = { label: "Warszawa", aliases: [], latitude: 52.2297, longitude: 21.0122 };

it.each([
  null, undefined, { latitude: null, longitude: 21 }, { latitude: 52, longitude: null },
  { latitude: Number.NaN, longitude: 21 }, { latitude: 91, longitude: 21 },
  { latitude: 52, longitude: Number.POSITIVE_INFINITY }, { latitude: 52, longitude: 181 }
])("rejects a missing or invalid coordinate pair: %s", (value) => {
  expect(hasLocationCoordinates(value)).toBe(false);
  expect(distanceBetweenCoordinates(origin, value)).toBe(Number.POSITIVE_INFINITY);
});

it("accepts zero coordinates and keeps antipodal distance finite", () => {
  expect(hasLocationCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
  expect(distanceBetweenCoordinates({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(20015.087, 2);
});

it("calculates distance from actual coordinates", () => {
  expect(distanceBetweenCoordinates(origin, { latitude: 50.0647, longitude: 19.945 })).toBeCloseTo(252, 0);
});

it("keeps date order stable by id, independent of distance", () => {
  const first = { id: "a", startDate: "2026-10-06T10:00:00Z", latitude: 50, longitude: 19 };
  const second = { ...first, id: "b", ...origin };
  expect(comparePublicSearchItems(first, second, "date", origin)).toBeLessThan(0);
  expect(comparePublicSearchItems(first, second, "nearest", origin)).toBeGreaterThan(0);
});

it("uses date and id as ties for nearest, and puts unknown event coordinates last", () => {
  const first = { id: "a", startDate: "2026-10-06T10:00:00Z", ...origin };
  const later = { ...first, id: "b", startDate: "2026-10-07T10:00:00Z" };
  expect(comparePublicSearchItems(first, later, "nearest", origin)).toBeLessThan(0);
  expect(comparePublicSearchItems({ ...first, latitude: null }, later, "nearest", origin)).toBeGreaterThan(0);
});

it("keeps unzoned legacy dates in Europe/Warsaw when sorting alongside UTC dates", () => {
  const local = { id: "b", startDate: "2026-07-01T10:00:00", ...origin };
  const utc = { id: "a", startDate: "2026-07-01T09:00:00Z", ...origin };
  expect(comparePublicSearchItems(local, utc, "date")).toBeLessThan(0);
});

it("keeps radius bounding boxes conservative at the antimeridian and poles", () => {
  expect(radiusBoundingBox({ latitude: 0, longitude: 179.9 }, 100)).not.toHaveProperty("minLongitude");
  expect(radiusBoundingBox({ latitude: 89.9, longitude: 20 }, 100)).toEqual({ minLatitude: expect.any(Number), maxLatitude: 90 });
  const box = radiusBoundingBox(origin, 30);
  expect(box.minLatitude).toBeLessThan(origin.latitude!);
  expect(box.maxLatitude).toBeGreaterThan(origin.latitude!);
});

it("parses only supported global sorting values", () => {
  expect(parsePublicFilterParams({ sort: "nearest", radius: "35" })).toMatchObject({ sortBy: "nearest", radiusKm: 35 });
  expect(parsePublicFilterParams({ sort: ["date", "nearest"] })).toMatchObject({ sortBy: "date" });
  expect(parsePublicFilterParams({ sort: "price" })).not.toHaveProperty("sortBy");
});

it("applies the same requested order when filtering events on the client", () => {
  const far = { id: "a", startDate: "2026-10-06T10:00:00Z", end_at: null, category: "Koncerty", latitude: 52.5, longitude: 21.0122 } as EventItem;
  const near = { ...far, id: "b", startDate: "2026-10-07T10:00:00Z", latitude: 52.23 };
  const filters = { location: origin, dateFilter: "all" as const, customDate: "", radiusKm: null, category: "Wszystkie" };
  expect(filterEvents([near, far], { ...filters, sortBy: "date" }, new Date("2026-10-05T12:00:00Z")).map(item => item.event.id)).toEqual(["a", "b"]);
  expect(filterEvents([far, near], { ...filters, sortBy: "nearest" }, new Date("2026-10-05T12:00:00Z")).map(item => item.event.id)).toEqual(["b", "a"]);
});
