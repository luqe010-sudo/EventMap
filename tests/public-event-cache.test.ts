import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  search: vi.fn(),
  markers: vi.fn(),
  counts: vi.fn(),
  byIds: vi.fn(),
  bySlug: vi.fn(),
  sitemapEvents: vi.fn(),
  categoryCityRoutes: vi.fn(),
  categories: vi.fn(),
  cities: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/components/HomePage", () => ({ default: () => null }));
vi.mock("@/components/EventDetailView", () => ({ default: () => null }));
vi.mock("@/lib/geocoding", () => ({ searchAddress: vi.fn() }));
vi.mock("@/lib/events", () => ({
  PUBLIC_EVENTS_MAX_RESULTS: 300,
  PUBLIC_EVENTS_PAGE_SIZE: 20,
  PUBLIC_EVENT_MARKER_LIMIT: 10000,
  searchPublicEvents: mocks.search,
  searchPublicEventMarkers: mocks.markers,
  searchPublicEventCategoryCounts: mocks.counts,
  listPublicEventsByIds: mocks.byIds,
  getEventBySlug: mocks.bySlug,
  listPublicEventSitemapEntries: mocks.sitemapEvents,
  listPublicCategoryCityRoutes: mocks.categoryCityRoutes,
  listCategories: mocks.categories,
  getCategoryBySlugFromDb: vi.fn(),
  resolveCityLocation: vi.fn(),
  getActiveCityLocations: vi.fn(),
  getHomeData: vi.fn(),
  listEvents: vi.fn(),
  isFreeEvent: vi.fn()
}));
vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ order: mocks.cities }) }) })
  })
}));

import { revalidatePublicEventCache } from "@/lib/public-event-cache";
import * as searchRoute from "../app/api/events/search/route";
import * as markerRoute from "../app/api/events/markers/route";
import * as countRoute from "../app/api/events/category-counts/route";
import * as detailRoute from "../app/api/events/[id]/route";
import * as singularAlias from "../app/wydarzenie/[slug]/route";
import * as pluralAlias from "../app/wydarzenia/[slug]/route";
import * as sitemapIndex from "../app/sitemap.xml/route";
import * as sitemapMain from "../app/sitemap-main.xml/route";
import * as sitemapEvents from "../app/sitemap-events.xml/route";
import * as sitemapCities from "../app/sitemap-cities.xml/route";
import * as sitemapCategoryCities from "../app/sitemap-category-cities.xml/route";
import * as sitemapCategories from "../app/sitemap-categories.xml/route";
import * as homePage from "../app/page";
import * as categoryPage from "../app/[category]/page";
import * as cityPage from "../app/[category]/[city]/page";
import * as eventPage from "../app/[category]/[city]/[event]/page";
import * as locationPage from "../app/lokalizacja/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.search.mockResolvedValue({ events: [{ id: "event" }], totalCount: 1 });
  mocks.markers.mockResolvedValue([{ id: "event" }]);
  mocks.counts.mockResolvedValue([{ categoryId: "music", count: 1 }]);
  mocks.byIds.mockResolvedValue([{ id: "event" }]);
  mocks.bySlug.mockResolvedValue({ id: "event", slug: "concert", categorySlug: "koncerty", citySlug: "warszawa" });
  mocks.sitemapEvents.mockResolvedValue([]);
  mocks.categoryCityRoutes.mockResolvedValue([]);
  mocks.categories.mockResolvedValue([]);
  mocks.cities.mockResolvedValue({ data: [] });
});

function expectFresh(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
}

describe("publication invalidation", () => {
  it("invalidates all detail/listing placements so old and new URLs cannot survive a move", () => {
    revalidatePublicEventCache();
    for (const path of ["/", "/lokalizacja", "/[category]", "/[category]/[city]", "/[category]/[city]/[event]"]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path, "page");
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/", "layout");
    expect(mocks.revalidatePath.mock.calls.some(([path]) => /^\/(auth|account|admin|organizer)(\/|$)/.test(path))).toBe(false);
  });

  it("covers dynamic ID/slug handlers by their scoped layout tags rather than page tags", () => {
    revalidatePublicEventCache();
    for (const path of ["/api/events", "/wydarzenie", "/wydarzenia"]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path, "layout");
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/api/events/[id]", "page");
  });

  it("invalidates the index and every sitemap feed", () => {
    revalidatePublicEventCache();
    for (const path of ["/sitemap.xml", "/sitemap-main.xml", "/sitemap-events.xml", "/sitemap-cities.xml", "/sitemap-category-cities.xml", "/sitemap-categories.xml"]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    }
  });
});

describe("fresh public event HTTP responses", () => {
  it.each([
    ["search", searchRoute, mocks.search],
    ["markers", markerRoute, mocks.markers],
    ["category-counts", countRoute, mocks.counts]
  ] as const)("%s reads the current inventory on each request and never caches failures", async (path, route, query) => {
    const request = new NextRequest(`https://example.invalid/api/events/${path}`);
    const first = await route.GET(request);
    expect(first.status).toBe(200);
    expectFresh(first);
    const firstBody = await first.json();

    query.mockResolvedValue(path === "search" ? { events: [], totalCount: 0 } : []);
    const withdrawn = await route.GET(request);
    expectFresh(withdrawn);
    expect(await withdrawn.json()).not.toEqual(firstBody);
    expect(query).toHaveBeenCalledTimes(2);

    query.mockRejectedValue(new Error("service unavailable"));
    const failed = await route.GET(request);
    expect(failed.status).toBe(500);
    expectFresh(failed);
  });

  it("detail changes from public content to uncached 404 after withdrawal and does not cache a service error", async () => {
    const request = new NextRequest("https://example.invalid/api/events/event");
    const context = { params: Promise.resolve({ id: "event" }) };
    const first = await detailRoute.GET(request, context);
    expect(first.status).toBe(200);
    expectFresh(first);
    mocks.byIds.mockResolvedValue([]);
    const withdrawn = await detailRoute.GET(request, context);
    expect(withdrawn.status).toBe(404);
    expectFresh(withdrawn);
    expect(await withdrawn.json()).not.toHaveProperty("event");
    mocks.byIds.mockRejectedValue(new Error("service unavailable"));
    const failed = await detailRoute.GET(request, context);
    expect(failed.status).toBe(500);
    expectFresh(failed);
  });

  it.each([["wydarzenie", singularAlias], ["wydarzenia", pluralAlias]] as const)("/%s does not permanently cache an old canonical redirect or an unpublished 404", async (path, route) => {
    const request = new Request(`https://example.invalid/${path}/concert`);
    const context = { params: Promise.resolve({ slug: "concert" }) };
    const initial = await route.GET(request, context);
    expect(initial.status).toBe(308);
    expectFresh(initial);
    mocks.bySlug.mockResolvedValue({ slug: "concert", categorySlug: "festiwale", citySlug: "wroclaw" });
    const moved = await route.GET(request, context);
    expect(moved.headers.get("location")).toBe("https://example.invalid/festiwale/wroclaw/concert");
    expect(moved.headers.get("location")).not.toBe(initial.headers.get("location"));
    expectFresh(moved);
    mocks.bySlug.mockResolvedValue(null);
    const withdrawn = await route.GET(request, context);
    expect(withdrawn.status).toBe(404);
    expectFresh(withdrawn);
  });

  it("does not serve a withdrawn event from a previously requested sitemap", async () => {
    mocks.sitemapEvents.mockResolvedValue([{ path: "/koncerty/warszawa/concert", lastmod: "2026-10-06T10:00:00Z" }]);
    const before = await sitemapEvents.GET();
    expectFresh(before);
    expect(await before.text()).toContain("/koncerty/warszawa/concert");
    mocks.sitemapEvents.mockResolvedValue([]);
    const after = await sitemapEvents.GET();
    expectFresh(after);
    expect(await after.text()).not.toContain("/koncerty/warszawa/concert");
  });

  it.each([
    ["index", sitemapIndex], ["main", sitemapMain], ["events", sitemapEvents],
    ["cities", sitemapCities], ["category-cities", sitemapCategoryCities], ["categories", sitemapCategories]
  ] as const)("%s sitemap has no separate browser/CDN lifetime", async (_name, route) => {
    expectFresh(await route.GET());
  });

  it("disables full route/ISR caches as well as HTTP caches on every public data surface", () => {
    for (const route of [homePage, categoryPage, cityPage, eventPage, locationPage, searchRoute, markerRoute, countRoute, detailRoute, singularAlias, pluralAlias, sitemapIndex, sitemapMain, sitemapEvents, sitemapCities, sitemapCategoryCities, sitemapCategories]) {
      expect(route.dynamic).toBe("force-dynamic");
    }
  });
});
