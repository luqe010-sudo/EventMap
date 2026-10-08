import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/HomePage", () => ({ default: () => null }));
vi.mock("@/components/EventDetailView", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ searchAddress: vi.fn() }));
vi.mock("@/lib/events", () => ({
  getCategoryBySlugFromDb: vi.fn(), listCategories: vi.fn(), listPublicCategoryCityRoutes: vi.fn(),
  resolveCityLocation: vi.fn(), getActiveCityLocations: vi.fn(), searchPublicEvents: vi.fn(),
  getEventBySlug: vi.fn(), listEvents: vi.fn(), isFreeEvent: vi.fn()
}));

import CategoryPage from "../app/[category]/page";
import CategoryCityPage from "../app/[category]/[city]/page";
import EventOrTimePage from "../app/[category]/[city]/[event]/page";
import LocationPage from "../app/lokalizacja/page";
import HomePage from "../components/HomePage";
import { notFound, redirect } from "next/navigation";
import { searchAddress } from "../lib/geocoding";
import {
  getActiveCityLocations, getCategoryBySlugFromDb, getEventBySlug, listCategories, listEvents,
  listPublicCategoryCityRoutes, resolveCityLocation, searchPublicEvents, type EventItem, type KnownLocation
} from "../lib/events";

class RouteRedirect extends Error {
  constructor(readonly url: string) { super(`NEXT_REDIRECT:${url}`); }
}

type HomeProps = React.ComponentProps<typeof HomePage>;
function homeProps(node: React.ReactNode): HomeProps {
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    if (node.type === HomePage) return node.props as HomeProps;
    for (const child of React.Children.toArray(node.props.children)) {
      try { return homeProps(child); } catch { /* Try the next sibling. */ }
    }
  }
  throw new Error("HomePage missing from route result");
}

const category = { id: "music", name: "Koncerty", slug: "koncerty", icon: null, color: null };
const city: KnownLocation = { label: "Warszawa", slug: "warszawa", aliases: [], latitude: 52.23, longitude: 21.01 };
const emptySearch = { events: [], totalCount: 0, page: 1, pageSize: 12, maxResults: 10000, shownCount: 0, hasMore: false };
const geocoded = { displayName: "Małe Miasto", latitude: 51.12345, longitude: 20.98765, city: "Małe Miasto", address: null, postalCode: null, voivodeship: null, county: null, municipality: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation((url) => { throw new RouteRedirect(url); });
  vi.mocked(notFound).mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
  vi.mocked(getCategoryBySlugFromDb).mockImplementation(async (slug) => slug.toLowerCase().startsWith("koncert") ? category : null);
  vi.mocked(resolveCityLocation).mockImplementation(async (slug) => slug.toLowerCase() === "warszawa" ? city : null);
  vi.mocked(listCategories).mockResolvedValue([category]);
  vi.mocked(getActiveCityLocations).mockResolvedValue([city]);
  vi.mocked(listPublicCategoryCityRoutes).mockResolvedValue([]);
  vi.mocked(searchPublicEvents).mockResolvedValue(emptySearch);
  vi.mocked(listEvents).mockResolvedValue([]);
  vi.mocked(searchAddress).mockResolvedValue([]);
});

describe("SSR city and radius semantics", () => {
  it("honours category date and price query filters on first render", async () => {
    const result = await CategoryPage({ params: Promise.resolve({ category: "koncerty" }), searchParams: Promise.resolve({ kiedy: "tomorrow", cena: "max", cenaMax: "80" }) });
    expect(searchPublicEvents).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "music", dateFilter: "tomorrow", priceMode: "max", maxPrice: 80, sortBy: "date" }));
    expect(homeProps(result).initialFilters).toMatchObject({ dateFilter: "tomorrow", priceMode: "max", maxPrice: 80 });
  });

  it("keeps a known city inside its administrative scope when radius is absent", async () => {
    const result = await CategoryPage({ params: Promise.resolve({ category: "warszawa" }), searchParams: Promise.resolve({ sort: "nearest" }) });
    expect(searchPublicEvents).toHaveBeenCalledWith(expect.objectContaining({ citySlug: "warszawa", radiusKm: undefined, sortBy: "nearest" }));
    expect(homeProps(result).initialFilters?.radiusKm).toBeUndefined();
  });

  it("uses an explicit city radius and keeps an empty city/category page instead of widening it", async () => {
    const result = await CategoryCityPage({ params: Promise.resolve({ category: "koncerty", city: "warszawa" }), searchParams: Promise.resolve({ radius: "40", sort: "nearest", cena: "free" }) });
    expect(searchPublicEvents).toHaveBeenCalledWith(expect.objectContaining({ citySlug: "warszawa", categoryId: "music", radiusKm: 40, sortBy: "nearest", priceMode: "free" }));
    expect(homeProps(result).initialEvents).toEqual([]);
    expect(homeProps(result).initialFilters).toMatchObject({ radiusKm: 40, sortBy: "nearest" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not invent a centre for a known city whose coordinates are missing", async () => {
    vi.mocked(resolveCityLocation).mockResolvedValue({ ...city, latitude: null, longitude: null });
    const result = await CategoryCityPage({ params: Promise.resolve({ category: "koncerty", city: "warszawa" }), searchParams: Promise.resolve({ radius: "50", sort: "nearest", kiedy: "weekend" }) });
    expect(searchPublicEvents).toHaveBeenCalledWith(expect.objectContaining({ citySlug: "warszawa", radiusKm: undefined, sortBy: "date", dateFilter: "weekend" }));
    expect(homeProps(result).initialFilters).toMatchObject({ radiusKm: undefined, sortBy: "date" });
    expect(searchAddress).not.toHaveBeenCalled();
  });

  it("allows query filters to override a category/city/time route on first render", async () => {
    const result = await EventOrTimePage({ params: Promise.resolve({ category: "koncerty", city: "warszawa", event: "weekend" }), searchParams: Promise.resolve({ kiedy: "tomorrow", radius: "25", sort: "nearest" }) });
    expect(searchPublicEvents).toHaveBeenCalledWith(expect.objectContaining({ dateFilter: "tomorrow", radiusKm: 25, sortBy: "nearest", citySlug: "warszawa" }));
    expect(homeProps(result).initialFilters?.dateFilter).toBe("tomorrow");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("public route redirects", () => {
  it("retains allowed filters while normalising category and city slugs", async () => {
    await expect(CategoryCityPage({ params: Promise.resolve({ category: "koncert", city: "Warszawa" }), searchParams: Promise.resolve({ kiedy: "tomorrow", cena: "free", radius: "25", sort: "nearest", unexpected: "discard" }) })).rejects.toThrow(RouteRedirect);
    const url = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.invalid");
    expect(url.pathname).toBe("/koncerty/warszawa");
    expect(Object.fromEntries(url.searchParams)).toEqual({ kiedy: "tomorrow", cena: "free", radius: "25", sort: "nearest" });
  });

  it("keeps an explicit all-dates override when normalising a time route", async () => {
    await expect(EventOrTimePage({ params: Promise.resolve({ category: "koncert", city: "Warszawa", event: "weekend" }), searchParams: Promise.resolve({ kiedy: "all", cena: "free" }) })).rejects.toThrow(RouteRedirect);
    const url = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.invalid");
    expect(url.pathname).toBe("/koncerty/warszawa/weekend");
    expect(url.searchParams.get("kiedy")).toBe("all");
  });

  it("does not swallow the Next redirect after successful fallback geocoding", async () => {
    vi.mocked(searchAddress).mockResolvedValue([geocoded]);
    await expect(CategoryCityPage({ params: Promise.resolve({ category: "koncerty", city: "male-miasto" }), searchParams: Promise.resolve({ kiedy: "tomorrow", cena: "free", radius: "40", sort: "nearest" }) })).rejects.toThrow(RouteRedirect);
    expect(notFound).not.toHaveBeenCalled();
    const url = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.invalid");
    expect(url.pathname).toBe("/koncerty/lokalizacja");
    expect(Object.fromEntries(url.searchParams)).toEqual({ kiedy: "tomorrow", cena: "free", radius: "40", sort: "nearest", lat: "51.123", lng: "20.988" });
  });

  it("carries the path's time filter into an unknown-city geocoding redirect", async () => {
    vi.mocked(searchAddress).mockResolvedValue([geocoded]);
    await expect(EventOrTimePage({ params: Promise.resolve({ category: "koncerty", city: "male-miasto", event: "weekend" }), searchParams: Promise.resolve({ cena: "free" }) })).rejects.toThrow(RouteRedirect);
    const url = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.invalid");
    expect(url.pathname).toBe("/koncerty/lokalizacja");
    expect(url.searchParams.get("kiedy")).toBe("weekend");
    expect(url.searchParams.get("radius")).toBe("30");
  });

  it("rejects invalid geocoding coordinates instead of building a NaN URL", async () => {
    vi.mocked(searchAddress).mockResolvedValue([{ ...geocoded, latitude: Number.NaN }]);
    await expect(CategoryPage({ params: Promise.resolve({ category: "male-miasto" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("retains filters in a canonical direct-event redirect", async () => {
    vi.mocked(getEventBySlug).mockResolvedValue({ id: "one", title: "Koncert", slug: "Koncert", category: "Koncerty", categorySlug: "koncerty", city: "Warszawa", citySlug: "warszawa" } as EventItem);
    await expect(EventOrTimePage({ params: Promise.resolve({ category: "koncert", city: "Warszawa", event: "Koncert" }), searchParams: Promise.resolve({ kiedy: "today", cena: "free" }) })).rejects.toThrow(RouteRedirect);
    const url = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.invalid");
    expect(url.searchParams.get("kiedy")).toBe("today");
    expect(url.searchParams.get("cena")).toBe("free");
  });
});

describe("point search first render", () => {
  it("shares its default 30 km radius between SSR and client initial filters", async () => {
    const result = await LocationPage({ searchParams: Promise.resolve({ lat: "52,23", lng: "21.01", sort: "nearest" }) });
    expect(searchPublicEvents).toHaveBeenCalledWith(expect.objectContaining({ radiusKm: 30, sortBy: "nearest", location: expect.objectContaining({ latitude: 52.23, longitude: 21.01 }) }));
    expect(homeProps(result).initialFilters).toMatchObject({ radiusKm: 30, sortBy: "nearest" });
  });

  it("retains coordinates and allowed filters in a category/point canonical redirect", async () => {
    await expect(CategoryCityPage({ params: Promise.resolve({ category: "koncert", city: "lokalizacja" }), searchParams: Promise.resolve({ lat: "52.23", lng: "21.01", kiedy: "tomorrow", cena: "free", sort: "nearest" }) })).rejects.toThrow(RouteRedirect);
    const url = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.invalid");
    expect(url.pathname).toBe("/koncerty/lokalizacja");
    expect(Object.fromEntries(url.searchParams)).toEqual({ kiedy: "tomorrow", cena: "free", radius: "30", sort: "nearest", lat: "52.23", lng: "21.01" });
  });

  it.each([
    { lat: "52oops", lng: "21" }, { lat: "91", lng: "21" }, { lat: "52", lng: "181" },
    { lat: "Infinity", lng: "21" }, { lat: "", lng: "21" }, { lat: "52" }
  ])("does not search with malformed/out-of-range point %j", async (point) => {
    await expect(LocationPage({ searchParams: Promise.resolve({ ...point, kiedy: "tomorrow", radius: "30", sort: "nearest" }) })).rejects.toThrow(RouteRedirect);
    expect(searchPublicEvents).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/?kiedy=tomorrow");
  });
});
