import { expect, it, vi, afterEach } from "vitest";
import { resolveDateRange } from "../lib/date-range";
import { searchPolishCities } from "../lib/geocoding";
import { listingMetadata } from "../lib/listing-metadata";
import { publicSearchOptionsFromParams, PublicSearchInputError } from "../lib/public-search-params";

afterEach(() => vi.unstubAllGlobals());
it("moves weekend to next Saturday on Sunday evening in Warsaw", () => {
  const range = resolveDateRange("weekend", "", new Date("2026-11-01T18:00:00+01:00"));
  expect(range.start.toISOString()).toBe("2026-11-06T23:00:00.000Z");
  expect(range.end?.toISOString()).toBe("2026-11-08T23:00:00.000Z");
});
it.each(["lat=abc&lng=21", "sort=nearest", "radius=30"])("rejects invalid context %s", params => {
  expect(() => publicSearchOptionsFromParams(new URLSearchParams(params))).toThrow(PublicSearchInputError);
});
it("does not suggest industrial POIs or duplicate city centres", async () => {
  const feature = (name: string, osm_key: string, osm_value: string) => ({ properties: { name, osm_key, osm_value, countrycode: "PL", state: "małopolskie" }, geometry: { type: "Point", coordinates: [19.94, 50.06] } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [feature("Krakow-Leg Power Plant", "power", "plant"), feature("Krakowska Ulica", "highway", "residential"), feature("Kraków", "place", "city")] }) }));
  expect((await searchPolishCities("Krak")).map(result => result.city)).toEqual(["Kraków"]);
});
it("gives collection pages their own social metadata", () => {
  expect(listingMetadata({ title: "Koncerty", description: "Koncerty w Polsce", alternates: { canonical: "/koncerty" } }).openGraph).toMatchObject({ title: "Koncerty", url: "/koncerty", description: "Koncerty w Polsce" });
});
