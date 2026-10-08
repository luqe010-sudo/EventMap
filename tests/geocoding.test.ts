import { afterEach, expect, it, vi } from "vitest";
import { searchPolishCities, searchStreetAddress } from "../lib/geocoding";

afterEach(() => vi.unstubAllGlobals());

it("does not fall back to public Nominatim when city autocomplete fails", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Provider unavailable"));
  vi.stubGlobal("fetch", fetch);
  await searchPolishCities("NieistniejaceTestoweMiasto");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("photon");
});

it("returns an empty address list on provider failure without a Nominatim request", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Provider unavailable"));
  vi.stubGlobal("fetch", fetch);
  expect(await searchStreetAddress("Lipowa 10", "Wrocław")).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("photon");
});
