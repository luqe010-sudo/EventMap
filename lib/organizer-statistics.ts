import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import { dateTimeLocalToUtcIso, getDateKeyInAppTimeZone } from "@/lib/date-format";

export type StatisticsReadStatus = "complete" | "unavailable" | "incomplete";
type AnalyticsRow = Pick<Database["public"]["Tables"]["event_analytics"]["Row"], "id" | "event_id" | "event_type" | "created_at">;
type PageResponse<T> = { data: T[] | null; error: { message: string } | null; count: number | null };
type Dataset<T> = { status: StatisticsReadStatus; rows: T[] };
const PAGE_SIZE = 500;
const MAX_STATISTIC_ROWS = 200_000;
const EVENT_ID_BATCH_SIZE = 100;

/** Advance by actual returned rows: a server max_rows smaller than our page is not EOF. */
export async function readCompleteOrganizerDataset<T extends { id: string }>(
  readPage: (offset: number, size: number, head: boolean) => PromiseLike<PageResponse<T>>,
  maximumRows = MAX_STATISTIC_ROWS
): Promise<Dataset<T>> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  try {
    do {
      const result = await readPage(rows.length, PAGE_SIZE, false);
      if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Dataset count unavailable");
      if (expected === null) expected = result.count;
      if (expected !== result.count || expected > maximumRows) throw new Error("Dataset changed or exceeds the read limit");
      const page = result.data ?? [];
      if (!page.length && rows.length < expected) throw new Error("Dataset stopped before its exact count");
      for (const row of page) {
        if (!row.id || seen.has(row.id)) throw new Error("Dataset contains repeated identifiers");
        seen.add(row.id);
        rows.push(row);
      }
      if (rows.length > expected) throw new Error("Dataset exceeds its exact count");
    } while (rows.length < expected);
    const final = await readPage(0, 1, true);
    if (final.error || final.count !== expected) throw new Error("Dataset changed during the read");
    return { status: "complete", rows };
  } catch (error) {
    console.error("[organizer-statistics] Dataset read was not complete", error);
    return { status: rows.length || (expected !== null && expected > maximumRows) ? "incomplete" : "unavailable", rows: [] };
  }
}

export function organizerMonthWindow(now: Date) {
  const monthKey = getDateKeyInAppTimeZone(now).slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const following = new Date(Date.UTC(year, month, 1));
  const nextKey = `${following.getUTCFullYear()}-${String(following.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    start: dateTimeLocalToUtcIso(`${monthKey}-01T00:00`)!,
    end: dateTimeLocalToUtcIso(`${nextKey}-01T00:00`)!
  };
}

export function summarizeOrganizerAnalytics(rows: AnalyticsRow[], now: Date) {
  const month = organizerMonthWindow(now);
  const start = Date.parse(month.start);
  const end = Math.min(Date.parse(month.end), now.getTime() + 1);
  const countsByEvent = new Map<string, Map<string, number>>();
  const monthCounts = new Map<string, number>();
  for (const row of rows) {
    const counts = countsByEvent.get(row.event_id) ?? new Map<string, number>();
    counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
    countsByEvent.set(row.event_id, counts);
    const timestamp = Date.parse(row.created_at);
    if (timestamp >= start && timestamp < end) monthCounts.set(row.event_type, (monthCounts.get(row.event_type) ?? 0) + 1);
  }
  return { countsByEvent, monthCounts, monthStart: month.start };
}

export async function readOrganizerStatistics(supabase: SupabaseClient<Database>, eventIds: string[], now = new Date()) {
  const ids = [...new Set(eventIds)].sort();
  const batches = Array.from({ length: Math.ceil(ids.length / EVENT_ID_BATCH_SIZE) }, (_, index) => ids.slice(index * EVENT_ID_BATCH_SIZE, (index + 1) * EVENT_ID_BATCH_SIZE));
  const analyticsRead = async () => {
    const allRows: AnalyticsRow[] = [];
    for (const batch of batches) {
      const result = await readCompleteOrganizerDataset((offset, size, head) => supabase
        .from("event_analytics").select("id, event_id, event_type, created_at", { count: "exact", head })
        .in("event_id", batch).lte("created_at", now.toISOString()).order("id", { ascending: true })
        .range(offset, offset + size - 1).returns<AnalyticsRow[]>());
      if (result.status !== "complete") return { status: allRows.length ? "incomplete" as const : result.status, rows: [] as AnalyticsRow[] };
      allRows.push(...result.rows);
      if (allRows.length > MAX_STATISTIC_ROWS) return { status: "incomplete" as const, rows: [] as AnalyticsRow[] };
    }
    return { status: "complete" as const, rows: allRows };
  };
  const savesRead = async () => {
    const counts = new Map<string, number>();
    try {
      // The saved_events PK includes private user_id, which is deliberately not granted.
      // Exact HEAD counts read every visible save without exposing IDs or max_rows truncation.
      for (let offset = 0; offset < ids.length; offset += 8) {
        const results = await Promise.all(ids.slice(offset, offset + 8).map(async eventId => {
          const result = await supabase.from("saved_events").select("event_id", { count: "exact", head: true }).eq("event_id", eventId);
          if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("Save count unavailable");
          return [eventId, result.count] as const;
        }));
        for (const [eventId, count] of results) counts.set(eventId, count);
      }
      for (const batch of batches) {
        const result = await supabase.from("saved_events").select("event_id", { count: "exact", head: true }).in("event_id", batch);
        const expected = batch.reduce((sum, id) => sum + counts.get(id)!, 0);
        if (result.error || result.count !== expected) throw new Error("Save counts changed during the read");
      }
      return { status: "complete" as const, counts };
    } catch (error) {
      console.error("[organizer-statistics] Current save counts were not complete", error);
      return { status: counts.size ? "incomplete" as const : "unavailable" as const, counts: null };
    }
  };
  const [analytics, saves] = await Promise.all([analyticsRead(), savesRead()]);
  const summary = summarizeOrganizerAnalytics(analytics.rows, now);
  const metric = (type: string) => analytics.status === "complete" ? summary.monthCounts.get(type) ?? 0 : null;
  return {
    analyticsStatus: analytics.status,
    savesStatus: saves.status,
    countsByEvent: analytics.status === "complete" ? summary.countsByEvent : null,
    savedEventsByEvent: saves.counts,
    monthStart: summary.monthStart,
    monthViews: metric("view"),
    monthContactClicks: analytics.status === "complete" ? metric("phone_click")! + metric("website_click")! : null,
    monthTicketClicks: metric("ticket_click"),
    monthSaveClicks: metric("save_click"),
    monthShares: metric("share_click"),
    currentSaves: saves.counts ? [...saves.counts.values()].reduce((sum, count) => sum + count, 0) : null
  };
}
