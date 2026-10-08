import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseServerClient } from "../lib/supabase";
import { getActiveCityLocations, listPublicEventsByIds, mapCityPageToLocation, resolveCityLocation, searchPublicEventCategoryCounts, searchPublicEventMarkers, searchPublicEvents, type CityPage } from "../lib/events";

type Row = Record<string, unknown>;
type Trace = { table: string; selection: string; methods: Array<[string, ...unknown[]]>; from: number; to: number };
const traces: Trace[] = [];
const centre = { latitude: 52.2297, longitude: 21.0122 };
const city = { id: "warszawa-id", name: "Warszawa", slug: "warszawa", is_active: true, ...centre };

function event(id: string, overrides: Row = {}): Row {
  return {
    id, title: id, slug: id, start_at: "2026-10-07T10:00:00Z", end_at: null,
    status: "published", visibility: "public", is_cancelled: false, is_featured: false,
    category_id: "concert-id", price_type: "free", price_min: null, price_max: null,
    category: { name: "Koncert", slug: "koncert", icon: "music", color: "#8b5cf6" },
    location: { id: `location-${id}`, city_id: city.id, name: "Klub", address: "ul. Testowa 1", ...centre, city },
    sources: [], organizer: null, ...overrides
  };
}

function valueAt(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Row)[key] : undefined, row);
}

function mockDatabase(
  events: Row[],
  cities: Row[] = [city],
  options: { maxRows?: number; count?: number | null; emptyAfter?: number; failedAfter?: number; hydrationMissing?: string; changedCountAfter?: number; duplicateAfter?: number; hydrationMoved?: boolean } = {}
) {
  const tables: Record<string, Row[]> = { events, cities, categories: [] };
  function from(table: string) {
    const trace: Trace = { table, selection: "", methods: [], from: 0, to: Number.MAX_SAFE_INTEGER };
    traces.push(trace);
    const filters: Array<(row: Row) => boolean> = [];
    const orders: string[] = [];
    let single = false;
    function result() {
      let rows = [...(tables[table] ?? [])].filter(row => filters.every(filter => filter(row)));
      if (table === "events" && trace.selection.includes("description") && options.hydrationMissing) {
        rows = rows.filter(row => row.id !== options.hydrationMissing);
      }
      rows.sort((first, second) => {
        for (const key of orders) {
          const comparison = String(valueAt(first, key)).localeCompare(String(valueAt(second, key)));
          if (comparison) return comparison;
        }
        return 0;
      });
      const count = "count" in options && table === "events" ? options.count :
        options.changedCountAfter != null && trace.from >= options.changedCountAfter ? rows.length + 1 : rows.length;
      const sliced = options.emptyAfter != null && trace.from >= options.emptyAfter ? [] : rows.slice(trace.from, Math.min(trace.to + 1, trace.from + (options.maxRows ?? 1000)));
      if (options.duplicateAfter != null && trace.from >= options.duplicateAfter && sliced.length) sliced[0] = rows[0];
      if (options.hydrationMoved && trace.selection.includes("description")) {
        for (let index = 0; index < sliced.length; index++) sliced[index] = { ...sliced[index], location: { ...(sliced[index].location as Row), latitude: centre.latitude + 0.001 } };
      }
      const error = options.failedAfter != null && trace.from >= options.failedAfter ? { message: "temporary unavailable" } : null;
      return { data: single ? sliced[0] ?? null : sliced, error, count };
    }
    const builder = {
      select(selection: string, options?: unknown) { trace.selection = selection; trace.methods.push(["select", selection, options]); return builder; },
      eq(key: string, value: unknown) { trace.methods.push(["eq", key, value]); filters.push(row => valueAt(row, key) === value); return builder; },
      in(key: string, values: unknown[]) { trace.methods.push(["in", key, values]); filters.push(row => values.includes(valueAt(row, key))); return builder; },
      order(key: string, options?: unknown) { trace.methods.push(["order", key, options]); orders.push(key); return builder; },
      gte(key: string, value: number) { trace.methods.push(["gte", key, value]); filters.push(row => valueAt(row, key) != null && Number(valueAt(row, key)) >= value); return builder; },
      lte(key: string, value: number) { trace.methods.push(["lte", key, value]); filters.push(row => valueAt(row, key) != null && Number(valueAt(row, key)) <= value); return builder; },
      lt(key: string, value: string) { trace.methods.push(["lt", key, value]); filters.push(row => String(valueAt(row, key)) < value); return builder; },
      or(expression: string) {
        trace.methods.push(["or", expression]);
        if (expression === "is_cancelled.is.null,is_cancelled.eq.false") filters.push(row => row.is_cancelled !== true);
        return builder;
      },
      range(start: number, end: number) { trace.from = start; trace.to = end; trace.methods.push(["range", start, end]); return builder; },
      maybeSingle() { single = true; return builder; },
      returns() { return Promise.resolve(result()); },
      then(resolve: (value: ReturnType<typeof result>) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(result()).then(resolve, reject); }
    };
    return builder;
  }
  vi.mocked(createSupabaseServerClient).mockReturnValue({ from } as unknown as ReturnType<typeof createSupabaseServerClient>);
}

beforeEach(() => { vi.clearAllMocks(); traces.length = 0; });

describe("saved public event hydration", () => {
  it("batches unique IDs and reads complete batches despite a lower server row limit", async () => {
    const ids = Array.from({ length: 235 }, (_, index) => `event-${String(index).padStart(3, "0")}`);
    mockDatabase(ids.map(id => event(id)), [city], { maxRows: 37 });
    const events = await listPublicEventsByIds([...ids, ids[0], ids[100]]);
    expect(events.map(item => item.id)).toEqual(ids);
    expect(events[0]).toMatchObject({ title: ids[0], city: city.name, category: "Koncerty", sourceType: "supabase" });
    const queries = traces.filter(trace => trace.table === "events");
    expect(queries.map(trace => trace.from)).toEqual([0, 37, 74, 0, 37, 74, 0]);
    for (const trace of queries) {
      const batch = trace.methods.find(method => method[0] === "in")?.[2] as string[];
      expect(batch.length).toBeLessThanOrEqual(100);
      expect(trace.methods).toContainEqual(["order", "id", { ascending: true }]);
      expect(trace.methods).toContainEqual(["eq", "status", "published"]);
      expect(trace.methods).toContainEqual(["eq", "visibility", "public"]);
      expect(trace.methods).toContainEqual(["or", "is_cancelled.is.null,is_cancelled.eq.false"]);
    }
  });

  it("omits withdrawn IDs without confusing unavailable content with an incomplete read", async () => {
    mockDatabase([event("visible"), event("draft", { status: "draft" }), event("private", { visibility: "private" }), event("cancelled", { is_cancelled: true })], [city], { maxRows: 1 });
    expect((await listPublicEventsByIds(["visible", "draft", "private", "cancelled", "missing"])).map(item => item.id)).toEqual(["visible"]);
  });

  it("rejects a later page failure or incomplete stream instead of returning partial saved events", async () => {
    mockDatabase([event("a"), event("b")], [city], { maxRows: 1, failedAfter: 1 });
    await expect(listPublicEventsByIds(["a", "b"])).rejects.toThrow("temporary unavailable");
    mockDatabase([event("a"), event("b")], [city], { maxRows: 1, emptyAfter: 1 });
    await expect(listPublicEventsByIds(["a", "b"])).rejects.toThrow("wszystkich wydarzeń");
  });

  it("does not query an empty ID list", async () => {
    mockDatabase([]);
    expect(await listPublicEventsByIds([])).toEqual([]);
    expect(traces).toHaveLength(0);
  });
});

describe("global public search", () => {
  it("finds nearest events beyond the date page and display cap before pagination", async () => {
    const events = Array.from({ length: 45 }, (_, index) => event(`event-${String(index).padStart(2, "0")}`, {
      start_at: `2026-11-${String(1 + Math.floor(index / 2)).padStart(2, "0")}T10:00:00Z`,
      location: { id: `location-${index}`, city_id: city.id, latitude: 52.4 - index * 0.0038, longitude: centre.longitude, city }
    }));
    mockDatabase(events, [city], { maxRows: 7 });
    const result = await searchPublicEvents({ location: centre, sortBy: "nearest", maxResults: 20, pageSize: 2 });
    expect(result.events.map(item => item.id)).toEqual(["event-44", "event-43"]);
    expect(result).toMatchObject({ totalCount: 45, shownCount: 2, hasMore: true });
    const next = await searchPublicEvents({ location: centre, sortBy: "nearest", maxResults: 20, pageSize: 2, page: 2 });
    expect(next.events.map(item => item.id)).toEqual(["event-42", "event-41"]);
  });

  it("uses exact count when the server returns shorter pages than requested", async () => {
    mockDatabase(Array.from({ length: 23 }, (_, index) => event(`event-${String(index).padStart(2, "0")}`)), [city], { maxRows: 6 });
    const result = await searchPublicEvents({ pageSize: 20 });
    expect(result).toMatchObject({ totalCount: 23, shownCount: 20, hasMore: true });
    expect(result.events).toHaveLength(20);
    const candidateRanges = traces.filter(trace => trace.table === "events" && !trace.selection.includes("description")).map(trace => trace.from);
    expect(candidateRanges).toEqual([0, 6, 12, 18]);
  });

  it("includes neighbouring cities in a canonical city radius and excludes distant or missing event coordinates", async () => {
    const nearby = event("nearby", { location: { id: "neighbour", city_id: "another-city", latitude: 52.3, longitude: 21.02, city: { name: "Sąsiednie miasto", slug: "sasiad" } } });
    const distant = event("distant", { location: { id: "far", city_id: city.id, latitude: 50.1, longitude: 19.9, city } });
    const missing = event("missing", { location: { id: "missing", city_id: city.id, latitude: null, longitude: null, city } });
    mockDatabase([event("in-city"), nearby, distant, missing]);
    const result = await searchPublicEvents({ citySlug: "warszawa", radiusKm: 15 });
    expect(result.events.map(item => item.id)).toEqual(["in-city", "nearby"]);
    const queries = traces.filter(trace => trace.table === "events");
    expect(queries.every(trace => !trace.methods.some(method => method[0] === "eq" && method[1] === "location.city_id"))).toBe(true);
    expect(await searchPublicEventMarkers({ citySlug: "warszawa", radiusKm: 15 })).toHaveLength(2);
    expect(await searchPublicEventCategoryCounts({ citySlug: "warszawa", radiusKm: 15 })).toMatchObject([{ category: "Koncerty", count: 2 }]);
  });

  it("uses the exact circular radius after the bounding rectangle", async () => {
    mockDatabase([event("centre"), event("rectangle-corner", { location: { id: "corner", latitude: 52.47, longitude: 21.4, city_id: "other" } })]);
    expect((await searchPublicEvents({ citySlug: "warszawa", radiusKm: 30 })).events.map(item => item.id)).toEqual(["centre"]);
  });

  it("keeps an unqualified city search restricted to the city", async () => {
    mockDatabase([event("in-city"), event("outside", { location: { id: "other", city_id: "other", ...centre, city } })]);
    expect((await searchPublicEvents({ citySlug: "warszawa" })).events.map(item => item.id)).toEqual(["in-city"]);
    expect(traces.find(trace => trace.table === "events")?.methods).toContainEqual(["eq", "location.city_id", city.id]);
  });

  it("keeps public visibility, cancellation, date overlap and price guards on candidate and hydration queries", async () => {
    mockDatabase([event("public"), event("draft", { status: "draft" }), event("private", { visibility: "private" }), event("cancelled", { is_cancelled: true })]);
    const result = await searchPublicEvents({ dateFrom: "2026-10-05T12:00:00Z", dateTo: "2026-12-01T00:00:00Z", priceMode: "max", maxPrice: 80 });
    expect(result.events.map(item => item.id)).toEqual(["public"]);
    for (const trace of traces.filter(trace => trace.table === "events")) {
      expect(trace.methods).toContainEqual(["eq", "status", "published"]);
      expect(trace.methods).toContainEqual(["eq", "visibility", "public"]);
      expect(trace.methods).toContainEqual(["or", "is_cancelled.is.null,is_cancelled.eq.false"]);
      expect(trace.methods).toContainEqual(["or", "start_at.gte.2026-10-05T12:00:00.000Z,end_at.gt.2026-10-05T12:00:00.000Z"]);
      expect(trace.methods).toContainEqual(["lt", "start_at", "2026-12-01T00:00:00Z"]);
      expect(trace.methods).toContainEqual(["or", "price_type.eq.free,price_type.eq.bezplatne,price_min.lte.80,price_max.lte.80"]);
      expect(trace.methods).toContainEqual(["order", "id", { ascending: true }]);
    }
  });

  it("returns the true total and stable date order even at or beyond the display cap", async () => {
    mockDatabase([event("b"), event("a"), event("c")]);
    const lastPage = await searchPublicEvents({ page: 2, pageSize: 1, maxResults: 2 });
    expect(lastPage.events.map(item => item.id)).toEqual(["b"]);
    expect(lastPage).toMatchObject({ totalCount: 3, shownCount: 2, hasMore: false });
    const beyond = await searchPublicEvents({ page: 3, pageSize: 1, maxResults: 2 });
    expect(beyond).toMatchObject({ events: [], totalCount: 3, shownCount: 2, hasMore: false });
  });
});

describe("completeness and failures", () => {
  it("collects all markers and category counts across the default server row limit", async () => {
    mockDatabase(Array.from({ length: 1205 }, (_, index) => event(`event-${String(index).padStart(4, "0")}`)));
    expect(await searchPublicEventMarkers()).toHaveLength(1205);
    expect(await searchPublicEventCategoryCounts()).toMatchObject([{ category: "Koncerty", count: 1205 }]);
  });

  it("fails explicitly when the map would silently exceed its marker cap", async () => {
    mockDatabase([event("a"), event("b"), event("c")]);
    await expect(searchPublicEventMarkers({ maxResults: 2 })).rejects.toThrow("Zbyt wiele wydarzeń na mapie");
  });

  it.each([searchPublicEvents, searchPublicEventMarkers, searchPublicEventCategoryCounts])("fails explicitly above the candidate guard", async (search) => {
    mockDatabase([event("a")], [city], { count: 50001 });
    await expect(search()).rejects.toThrow("Zbyt wiele wydarzeń");
  });

  it("refuses a missing exact count instead of assuming the returned page is the full pool", async () => {
    mockDatabase([event("a")], [city], { count: null });
    await expect(searchPublicEvents()).rejects.toThrow("pełnej liczby");
  });

  it("propagates a later batch failure instead of showing a partial success", async () => {
    mockDatabase([event("a"), event("b"), event("c")], [city], { maxRows: 1, failedAfter: 1 });
    await expect(searchPublicEventCategoryCounts()).rejects.toThrow("temporary unavailable");
  });

  it("rejects an incomplete page stream or changed event during hydration", async () => {
    mockDatabase([event("a"), event("b")], [city], { maxRows: 1, emptyAfter: 1 });
    await expect(searchPublicEvents()).rejects.toThrow("wszystkich wydarzeń");
    mockDatabase([event("a"), event("b")], [city], { hydrationMissing: "b" });
    await expect(searchPublicEvents()).rejects.toThrow("Katalog wydarzeń zmienił");
  });

  it("rejects a changed count or duplicate page when the catalogue shifts during collection", async () => {
    mockDatabase([event("a"), event("b")], [city], { maxRows: 1, changedCountAfter: 1 });
    await expect(searchPublicEvents()).rejects.toThrow("Katalog wydarzeń zmienił");
    mockDatabase([event("a"), event("b")], [city], { maxRows: 1, duplicateAfter: 1 });
    await expect(searchPublicEvents()).rejects.toThrow("Katalog wydarzeń zmienił");
  });

  it("rejects changed coordinates during hydration instead of presenting a stale radius or distance order", async () => {
    mockDatabase([event("a")], [city], { hydrationMoved: true });
    await expect(searchPublicEvents({ citySlug: city.slug, radiusKm: 10 })).rejects.toThrow("Katalog wydarzeń zmienił");
  });

  it("puts events without coordinates last when sorting by distance but retains them for city/date search", async () => {
    mockDatabase([event("a", { location: { city_id: city.id, latitude: null, longitude: null, city } }), event("b")]);
    expect((await searchPublicEvents({ citySlug: city.slug, sortBy: "nearest" })).events.map(item => item.id)).toEqual(["b", "a"]);
    expect((await searchPublicEvents({ citySlug: city.slug })).totalCount).toBe(2);
    expect(await searchPublicEventMarkers({ citySlug: city.slug })).toHaveLength(1);
  });
});

describe("missing city coordinates", () => {
  it("keeps missing canonical coordinates explicit even for a popular city", async () => {
    mockDatabase([event("a")], [{ ...city, latitude: null, longitude: null }]);
    expect(await getActiveCityLocations()).toMatchObject([{ slug: city.slug, latitude: null, longitude: null }]);
    expect(await resolveCityLocation(city.slug)).toMatchObject({ slug: city.slug, latitude: null, longitude: null });
    expect(mapCityPageToLocation({ city: { ...city, latitude: null, longitude: null } } as CityPage)).toMatchObject({ latitude: null, longitude: null });
    expect((await searchPublicEvents({ citySlug: city.slug })).events).toHaveLength(1);
  });

  it.each([searchPublicEvents, searchPublicEventMarkers, searchPublicEventCategoryCounts])("rejects a radius without city coordinates, even when an arbitrary point is supplied", async (search) => {
    mockDatabase([event("a")], [{ ...city, latitude: null, longitude: null }]);
    await expect(search({ citySlug: city.slug, location: centre, radiusKm: 30 })).rejects.toThrow("współrzędnych");
  });

  it("rejects distance sorting without a centre", async () => {
    mockDatabase([event("a")], [{ ...city, latitude: null, longitude: null }]);
    await expect(searchPublicEvents({ citySlug: city.slug, sortBy: "nearest" })).rejects.toThrow("współrzędnych");
    await expect(searchPublicEvents({ sortBy: "nearest" })).rejects.toThrow("współrzędnych");
  });
});
