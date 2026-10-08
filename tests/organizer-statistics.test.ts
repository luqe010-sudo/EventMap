import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { organizerMonthWindow, readCompleteOrganizerDataset, readOrganizerStatistics, summarizeOrganizerAnalytics } from "../lib/organizer-statistics";

vi.mock("@/lib/auth", () => ({ requireOrganizerAccess: vi.fn(), getCurrentUserContext: vi.fn(), getPrimaryOrganizerId: vi.fn() }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireOrganizerAccess } from "../lib/auth";
import { createSupabaseUserClient } from "../lib/supabase-user";
import { getOrganizerDashboard, getOrganizerStats, listOrganizerEvents } from "../lib/organizer-events";

type AnalyticsRow = Pick<Database["public"]["Tables"]["event_analytics"]["Row"], "id" | "event_id" | "event_type" | "created_at">;
const now = new Date("2026-10-06T10:00:00.000Z");
function analytics(id: number, eventType = "view", eventId = "event-a", createdAt = "2026-10-02T12:00:00.000Z"): AnalyticsRow {
  return { id: String(id).padStart(8, "0"), event_id: eventId, event_type: eventType, created_at: createdAt };
}
const fakeEvent = (id: string) => ({ id, title: id, start_at: "2027-05-01T12:00:00Z", status: "published", visibility: "public", is_cancelled: false, location: null, submitted_by_organizer_id: "organizer-a" });

function clientFixture(options: {
  analytics?: AnalyticsRow[];
  saves?: Record<string, number>;
  events?: ReturnType<typeof fakeEvent>[];
  maxRows?: number;
  failAnalyticsOffset?: number;
  finalAnalyticsDelta?: number;
  failSaves?: boolean;
  saveBatchDelta?: number;
} = {}) {
  const calls: Array<{ table: string; select: string; head: boolean; offset: number; filters: Array<[string, unknown]> }> = [];
  const orders: Array<[string, string, unknown]> = [];
  const supabase = {
    from: (table: string) => {
      let selected = "";
      let head = false;
      let offset = 0;
      let requested = 500;
      const filters: Array<[string, unknown]> = [];
      const query = {
        select: (value: string, config?: { head?: boolean }) => { selected = value; head = Boolean(config?.head); return query; },
        in: (column: string, values: string[]) => { filters.push([column, values]); return query; },
        eq: (column: string, value: string) => { filters.push([column, value]); return query; },
        lte: (column: string, value: string) => { filters.push([column, value]); return query; },
        gte: () => query,
        order: (column: string, config: unknown) => { orders.push([table, column, config]); return query; },
        limit: () => query,
        range: (from: number, to: number) => { offset = from; requested = to - from + 1; return query; },
        returns: () => query,
        then: (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => {
          calls.push({ table, select: selected, head, offset, filters });
          const ids = filters.find(([column, values]) => column === "event_id" && Array.isArray(values))?.[1] as string[] | undefined;
          if (table === "saved_events") {
            if (options.failSaves) return { data: null, count: null, error: { message: "Private provider detail" } };
            const eventId = filters.find(([column, value]) => column === "event_id" && typeof value === "string")?.[1] as string | undefined;
            const count = eventId ? options.saves?.[eventId] ?? 0 : (ids ?? []).reduce((sum, id) => sum + (options.saves?.[id] ?? 0), 0) + (options.saveBatchDelta ?? 0);
            return { data: null, count, error: null };
          }
          if (table === "notifications") return { data: [], error: null };
          const ceiling = filters.find(([column, value]) => column === "created_at" && typeof value === "string")?.[1] as string | undefined;
          const data = (table === "events" ? options.events ?? [] : (options.analytics ?? []).filter(row => (!ids || ids.includes(row.event_id)) && (!ceiling || row.created_at <= ceiling))).slice().sort((a, b) => a.id.localeCompare(b.id));
          if (table === "event_analytics" && !head && offset === options.failAnalyticsOffset) return { data: null, count: null, error: { message: "Private provider detail" } };
          return {
            data: head ? null : data.slice(offset, offset + Math.min(requested, options.maxRows ?? 1000)),
            count: data.length + (head && table === "event_analytics" ? options.finalAnalyticsDelta ?? 0 : 0),
            error: null
          };
        }).then(resolve, reject)
      };
      return query;
    }
  };
  return { supabase: supabase as unknown as SupabaseClient<Database>, calls, orders };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireOrganizerAccess).mockResolvedValue({
    userId: "organizer-user", profile: null, isAdmin: false,
    memberships: [{ id: "membership-a", organizer_id: "organizer-a", user_id: "organizer-user", role: "owner", created_at: null, organizer: null }]
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("complete organizer reads", () => {
  it("reads all 1203 analytic rows even when max_rows is lower than the requested page, and produces repeatable results", async () => {
    const fixture = clientFixture({ analytics: Array.from({ length: 1203 }, (_, index) => analytics(index)), maxRows: 37, saves: { "event-a": 1450 } });
    const first = await readOrganizerStatistics(fixture.supabase, ["event-a"], now);
    const second = await readOrganizerStatistics(fixture.supabase, ["event-a"], now);
    expect(first).toEqual(second);
    expect(first.analyticsStatus).toBe("complete");
    expect(first.monthViews).toBe(1203);
    expect(first.countsByEvent?.get("event-a")?.get("view")).toBe(1203);
    expect(first.currentSaves).toBe(1450);
    expect(fixture.calls.filter(call => call.table === "event_analytics" && !call.head).map(call => call.offset).slice(0, 4)).toEqual([0, 37, 74, 111]);
    expect(fixture.calls.filter(call => call.table === "saved_events").every(call => call.head && call.select === "event_id")).toBe(true);
    expect(fixture.orders).toContainEqual(["event_analytics", "id", { ascending: true }]);
  });
  it("discards partial analytics on a later page failure while keeping an independently confirmed save count", async () => {
    const fixture = clientFixture({ analytics: [analytics(1), analytics(2), analytics(3)], maxRows: 2, failAnalyticsOffset: 2, saves: { "event-a": 3 } });
    const result = await readOrganizerStatistics(fixture.supabase, ["event-a"], now);
    expect(result.analyticsStatus).toBe("incomplete");
    expect(result.countsByEvent).toBeNull();
    expect(result.monthViews).toBeNull();
    expect(result.monthContactClicks).toBeNull();
    expect(result.currentSaves).toBe(3);
    expect(result.savesStatus).toBe("complete");
  });
  it("does not turn an unavailable analytics read or unavailable save count into successful zero metrics", async () => {
    const fixture = clientFixture({ failAnalyticsOffset: 0, failSaves: true });
    const result = await readOrganizerStatistics(fixture.supabase, ["event-a"], now);
    expect(result.analyticsStatus).toBe("unavailable");
    expect(result.savesStatus).toBe("unavailable");
    expect(result.monthViews).toBeNull();
    expect(result.monthSaveClicks).toBeNull();
    expect(result.currentSaves).toBeNull();
  });
  it("detects changes in analytics or current-save counts during the read", async () => {
    const fixture = clientFixture({ analytics: [analytics(1)], finalAnalyticsDelta: 1, saves: { "event-a": 2 }, saveBatchDelta: 1 });
    const result = await readOrganizerStatistics(fixture.supabase, ["event-a"], now);
    expect(result.analyticsStatus).toBe("incomplete");
    expect(result.savesStatus).toBe("incomplete");
    expect(result.monthViews).toBeNull();
    expect(result.currentSaves).toBeNull();
  });
  it("reports a changed count, repeated ID, or zero progress as incomplete rather than returning a truncated list", async () => {
    for (const failure of ["count", "duplicate", "empty"]) {
      let calls = 0;
      const result = await readCompleteOrganizerDataset(async () => {
        calls += 1;
        return { data: calls === 1 ? [{ id: "a" }] : failure === "empty" ? [] : [{ id: "a" }], error: null, count: failure === "count" && calls > 1 ? 3 : 2 };
      });
      expect(result).toEqual({ status: "incomplete", rows: [] });
      expect(calls).toBe(2);
    }
  });
  it("does not report an over-limit dataset as complete", async () => {
    const result = await readCompleteOrganizerDataset(async () => ({ data: [{ id: "a" }], error: null, count: 3 }), 2);
    expect(result).toEqual({ status: "incomplete", rows: [] });
  });
  it("returns confirmed zeros without reading any table when there are no owned events", async () => {
    const fixture = clientFixture();
    const result = await readOrganizerStatistics(fixture.supabase, [], now);
    expect(result.analyticsStatus).toBe("complete");
    expect(result.savesStatus).toBe("complete");
    expect(result.monthViews).toBe(0);
    expect(result.currentSaves).toBe(0);
    expect(fixture.calls).toHaveLength(0);
  });
});

describe("organizer statistics meaning and monthly dates", () => {
  it("keeps historical heart clicks separate from current saves and groups both per event", async () => {
    const fixture = clientFixture({ analytics: [analytics(1, "save_click"), analytics(2, "save_click"), analytics(3, "save_click", "event-b")], saves: { "event-a": 1, "event-b": 0 }, events: [fakeEvent("event-a"), fakeEvent("event-b")] });
    vi.mocked(createSupabaseUserClient).mockResolvedValue(fixture.supabase);
    vi.useFakeTimers(); vi.setSystemTime(now);
    const result = await getOrganizerStats();
    expect(result.rows.map(row => [row.event.id, row.saveClicks, row.currentSaves])).toEqual([["event-a", 2, 1], ["event-b", 1, 0]]);
    expect(result.rows[0]).not.toHaveProperty("saves");
    expect(requireOrganizerAccess).toHaveBeenCalled();
    expect(fixture.calls.filter(call => call.table === "events").every(call => call.filters.some(([column, ids]) => column === "submitted_by_organizer_id" && JSON.stringify(ids) === '["organizer-a"]'))).toBe(true);
  });
  it("uses Warsaw midnight across summer time and winter time month boundaries", () => {
    expect(organizerMonthWindow(new Date("2026-10-01T00:00:00Z"))).toEqual({ start: "2026-09-30T22:00:00.000Z", end: "2026-10-31T23:00:00.000Z" });
    expect(organizerMonthWindow(new Date("2026-12-31T23:30:00Z"))).toEqual({ start: "2026-12-31T23:00:00.000Z", end: "2027-01-31T23:00:00.000Z" });
  });
  it("includes the Warsaw month start exactly, excludes prior month and future records, and keeps lifetime per-event counts", () => {
    const summary = summarizeOrganizerAnalytics([
      analytics(1, "view", "event-a", "2026-09-30T21:59:59.999Z"),
      analytics(2, "view", "event-a", "2026-09-30T22:00:00.000Z"),
      analytics(3, "view", "event-b", now.toISOString()),
      analytics(4, "view", "event-b", "2026-11-01T00:00:00Z"),
      analytics(5, "phone_click"), analytics(6, "website_click"), analytics(7, "ticket_click"), analytics(8, "share_click")
    ], now);
    expect(summary.monthCounts.get("view")).toBe(2);
    expect(summary.countsByEvent.get("event-a")?.get("view")).toBe(2);
    expect(summary.countsByEvent.get("event-b")?.get("view")).toBe(2);
    expect(summary.monthCounts.get("share_click")).toBe(1);
  });
  it("provides monthly dashboard clicks and shares without inventing zeros or counting all-time clicks as monthly", async () => {
    const fixture = clientFixture({ events: [fakeEvent("event-a")], analytics: [analytics(1, "save_click", "event-a", "2026-09-10T10:00:00Z"), analytics(2, "save_click"), analytics(3, "share_click"), analytics(4, "phone_click"), analytics(5, "website_click"), analytics(6, "ticket_click")], saves: { "event-a": 2 } });
    vi.mocked(createSupabaseUserClient).mockResolvedValue(fixture.supabase);
    vi.useFakeTimers(); vi.setSystemTime(now);
    const result = await getOrganizerDashboard();
    expect(result.stats).toMatchObject({ currentSaves: 2, saveClicks: 1, shares: 1, contactClicks: 2, ticketClicks: 1, monthStart: "2026-09-30T22:00:00.000Z" });
  });
  it("fully reads more than 1000 owned events and keeps stable ordering and ownership in every page", async () => {
    const fixture = clientFixture({ events: Array.from({ length: 1205 }, (_, index) => fakeEvent(String(index).padStart(6, "0"))), maxRows: 63 });
    vi.mocked(createSupabaseUserClient).mockResolvedValue(fixture.supabase);
    const result = await listOrganizerEvents();
    expect(result).toHaveLength(1205);
    expect(result[1204].id).toBe("001204");
    expect(fixture.orders).toContainEqual(["events", "start_at", { ascending: false }]);
    expect(fixture.orders).toContainEqual(["events", "id", { ascending: true }]);
    expect(fixture.calls.every(call => call.filters.some(([column]) => column === "submitted_by_organizer_id"))).toBe(true);
  });
  it("refuses stats before any Supabase query when organizer access fails", async () => {
    vi.mocked(requireOrganizerAccess).mockRejectedValue(new Error("Access denied"));
    await expect(getOrganizerStats()).rejects.toThrow("Access denied");
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });
});
