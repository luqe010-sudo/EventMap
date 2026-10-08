import { describe, expect, it } from "vitest";
import { normalizeCitySearchFilters, publicSearchOptionsFromParams } from "@/lib/public-search-params";
import { appendPublicFilters, buildSearchUrl } from "@/lib/slugs";
import { parsePublicFilterParams } from "@/lib/filters";

describe("wspólny kontrakt publicznego wyszukiwania", () => {
  it("odróżnia miasto od promienia wokół miasta", () => {
    const city = publicSearchOptionsFromParams(new URLSearchParams("citySlug=wroclaw"));
    const nearby = publicSearchOptionsFromParams(new URLSearchParams("citySlug=wroclaw&radius=50&sort=nearest"));
    expect(city).toMatchObject({ citySlug: "wroclaw", radiusKm: null, sortBy: "date" });
    expect(nearby).toMatchObject({ citySlug: "wroclaw", radiusKm: 50, sortBy: "nearest" });
    expect(nearby.location).toBeUndefined();
  });

  it("GPS bez promienia ma jeden domyślny zakres", () => {
    expect(publicSearchOptionsFromParams(new URLSearchParams("lat=51.1&lng=17.03")))
      .toMatchObject({ location: { latitude: 51.1, longitude: 17.03 }, radiusKm: 30 });
  });

  it.each(["lat=91&lng=17", "lat=51", "lat=51&lng=", "lat=NaN&lng=17", "lat=51&lng=181"])("odrzuca nieprawidłowy punkt %s", (query) => {
    expect(() => publicSearchOptionsFromParams(new URLSearchParams(query))).toThrow("Nieprawidłowe współrzędne");
  });

  it("SSR miasta bez centrum zachowuje datę i cenę, usuwa niewykonalną odległość", () => {
    const filters = { dateFilter: "weekend" as const, priceMode: "max" as const, maxPrice: 80, radiusKm: 50, sortBy: "nearest" as const };
    expect(normalizeCitySearchFilters(filters, { label: "Miasto", aliases: [], slug: "miasto", latitude: null, longitude: null }))
      .toEqual({ ...filters, radiusKm: undefined, sortBy: "date" });
  });

  it("URL, alias redirect i parser zachowują pełny zakres filtrów", () => {
    const filters = { dateFilter: "custom" as const, customDate: "2026-10-10/2026-10-11", priceMode: "max" as const, maxPrice: 80, radiusKm: 50, sortBy: "nearest" as const };
    const url = buildSearchUrl({ categorySlug: "koncerty", citySlug: "wroclaw", ...filters });
    expect(url).toBe(appendPublicFilters("/koncerty/wroclaw", filters));
    expect(parsePublicFilterParams(Object.fromEntries(new URL(url, "http://localhost").searchParams))).toEqual(filters);
  });

  it("nie przekazuje nieznanych parametrów w przekierowaniu", () => {
    const filters = parsePublicFilterParams({ kiedy: "weekend", sort: "random", admin: "1" });
    expect(appendPublicFilters("/wroclaw", filters)).toBe("/wroclaw?kiedy=weekend");
  });

  it("jawne wszystkie daty nie zmieniają się w weekend przy normalizacji trasy czasu", () => {
    expect(appendPublicFilters("/wroclaw/weekend", { dateFilter: "all" })).toBe("/wroclaw/weekend?kiedy=all");
  });
});
