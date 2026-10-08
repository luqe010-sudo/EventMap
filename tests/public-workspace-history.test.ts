import { describe, expect, it } from "vitest";
import type { CategoryOption, KnownLocation } from "../lib/events";
import { restorePublicWorkspaceSearch } from "../lib/public-workspace-history";
import { buildSearchUrl } from "../lib/slugs";

const origin = "https://mapaimprez.pl";
const categories: CategoryOption[] = [
  { id: "music", name: "Koncerty", slug: "koncerty", icon: null, color: null },
  { id: "sport", name: "Sport", slug: "sport", icon: null, color: null }
];
const warsaw: KnownLocation = { label: "Warszawa", slug: "warszawa", aliases: [], latitude: 52.23, longitude: 21.01 };
const krakow: KnownLocation = { label: "Kraków", slug: "krakow", aliases: [], latitude: 50.06, longitude: 19.94 };
const missing: KnownLocation = { label: "Bez centrum", slug: "bez-centrum", aliases: [], latitude: null, longitude: null };
const locations = new Map([warsaw, krakow, missing].map(location => [location.slug!, location]));
const restore = (url: string) => restorePublicWorkspaceSearch(url, origin, categories, locations);

describe("browser search history", () => {
  it("restores all filters when returning to an earlier search and resets omitted filters", () => {
    const earlier = buildSearchUrl({ categorySlug: "koncerty", citySlug: "warszawa", dateFilter: "custom", customDate: "2026-10-10/2026-10-12", priceMode: "max", maxPrice: 80, radiusKm: 25, sortBy: "nearest" });
    const later = buildSearchUrl({ categorySlug: "sport", citySlug: "krakow", dateFilter: "tomorrow", priceMode: "free" });
    expect(restore(earlier)).toEqual({ category: "Koncerty", location: warsaw, locationMode: "radius", radiusKm: 25, dateFilter: "custom", customDate: "2026-10-10/2026-10-12", priceMode: "max", maxPrice: 80, sortBy: "nearest" });
    expect(restore(later)).toEqual({ category: "Sport", location: krakow, locationMode: "city", radiusKm: 100, dateFilter: "tomorrow", customDate: "", priceMode: "free", maxPrice: 100, sortBy: "date" });
    expect(restore("/")).toMatchObject({ category: "Wszystkie", location: null, dateFilter: "all", priceMode: "all", sortBy: "date" });
  });

  it("uses the time route's default, with an explicit query choice taking priority", () => {
    expect(restore("/warszawa/weekend")).toMatchObject({ location: warsaw, dateFilter: "weekend" });
    expect(restore("/koncerty/warszawa/dzis?kiedy=all")).toMatchObject({ category: "Koncerty", location: warsaw, dateFilter: "all" });
    expect(restore("/koncerty/warszawa/ten-tydzien?kiedy=tomorrow")).toMatchObject({ dateFilter: "tomorrow" });
  });

  it("restores a point search and its shared default radius", () => {
    expect(restore("/koncerty/lokalizacja?lat=51.1&lng=17.03&sort=nearest&cena=free"))
      .toMatchObject({ category: "Koncerty", location: { latitude: 51.1, longitude: 17.03 }, locationMode: "radius", radiusKm: 30, sortBy: "nearest", priceMode: "free" });
    expect(restore("/lokalizacja?lat=51.1&lng=17.03&radius=50"))
      .toMatchObject({ category: "Wszystkie", radiusKm: 50 });
  });

  it("normalizes searches that cannot use distance just as the server does", () => {
    expect(restore("/koncerty/bez-centrum?radius=50&sort=nearest&kiedy=tomorrow&cena=free"))
      .toMatchObject({ location: missing, locationMode: "city", sortBy: "date", dateFilter: "tomorrow", priceMode: "free" });
    expect(restore("/koncerty?radius=50&sort=nearest"))
      .toMatchObject({ location: null, sortBy: "date", locationMode: "city" });
  });

  it.each(["/nieznane-miasto", "/koncerty/warszawa/koncert", "/lokalizacja?lat=91&lng=17", "/lokalizacja?lat=51", "/warszawa/nieznany-termin", "https://other.invalid/warszawa"])("requires the server route for unsupported history %s", url => {
    expect(restore(url)).toBeNull();
  });
});
