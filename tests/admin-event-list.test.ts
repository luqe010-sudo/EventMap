import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ uploadEventImageToCloudinary: vi.fn() }));
vi.mock("@/lib/cities", () => ({ resolveCityIdFromForm: vi.fn() }));

import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { listAdminEvents, listAdminReviewEvents } from "@/lib/admin-events";
import {
  ADMIN_EVENT_POOL_LIMIT, AdminEventFilterError, adminEventDateBounds, buildAdminEventListUrl,
  parseAdminEventListFilters, type AdminEventListItem
} from "@/lib/admin-event-list";

type Row = AdminEventListItem;
const row = (index: number, extra: Partial<Row> = {}): Row => ({
  id: `event-${String(index).padStart(6, "0")}`, title: "Koncert", created_at: "2026-10-05T12:00:00Z",
  updated_at: null, start_at: "2027-05-01T20:00:00Z", published_at: null,
  status: "published", visibility: "public", review_note: null, is_featured: false,
  submitted_by_organizer_id: null, category: { name: "Koncerty" },
  location: { city: { name: "Warszawa" } }, organizer: { name: "Organizator" }, ...extra
});

let rows: Row[];
let maximumRows: number;
let overrideCount: number | null | undefined;
let changedCount: boolean;
let duplicateBatch: boolean;
let emptyBatch: boolean;
let dbError: { message: string } | null;
const reads: Array<{ head: boolean; orders: Array<{ key: string; asc: boolean; nullsFirst: boolean }>; range?: [number, number] }> = [];
const filters: Array<[string, string, unknown]> = [];
const from = vi.fn(() => {
  let head = false;
  let range: [number, number] | undefined;
  const predicates: Array<(row: Row) => boolean> = [];
  const orders: Array<{ key: string; asc: boolean; nullsFirst: boolean }> = [];
  const query = {
    select: vi.fn((_columns: string, options?: { head?: boolean }) => { head = options?.head === true; return query; }),
    eq: vi.fn((key: keyof Row, value: unknown) => { filters.push(["eq", key, value]); predicates.push(item => item[key] === value); return query; }),
    in: vi.fn((key: keyof Row, values: unknown[]) => { filters.push(["in", key, values]); predicates.push(item => values.includes(item[key])); return query; }),
    gte: vi.fn((key: keyof Row, value: string) => { filters.push(["gte", key, value]); predicates.push(item => item[key] != null && String(item[key]) >= value); return query; }),
    lt: vi.fn((key: keyof Row, value: string) => { filters.push(["lt", key, value]); predicates.push(item => item[key] != null && String(item[key]) < value); return query; }),
    or: vi.fn((value: string) => {
      expect(value).toBe("is_featured.is.null,is_featured.eq.false");
      predicates.push(item => item.is_featured !== true);
      return query;
    }),
    order: vi.fn((key: string, options: { ascending: boolean; nullsFirst?: boolean }) => { orders.push({ key, asc: options.ascending, nullsFirst: options.nullsFirst ?? false }); return query; }),
    range: vi.fn((start: number, end: number) => { range = [start, end]; return query; }),
    returns: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
      reads.push({ head, orders, range });
      const selected = rows.filter(item => predicates.every(predicate => predicate(item)));
      selected.sort((left, right) => {
        for (const order of orders) {
          const a = left[order.key as keyof Row];
          const b = right[order.key as keyof Row];
          if (a == null && b != null) return order.nullsFirst ? -1 : 1;
          if (a != null && b == null) return order.nullsFirst ? 1 : -1;
          const result = String(a).localeCompare(String(b));
          if (result) return result * (order.asc ? 1 : -1);
        }
        return 0;
      });
      const count = overrideCount === undefined ? selected.length + (!head && changedCount ? 1 : 0) : overrideCount;
      let data = head ? null : selected.slice(range?.[0] ?? 0, Math.min((range?.[1] ?? selected.length - 1) + 1, (range?.[0] ?? 0) + maximumRows));
      if (!head && duplicateBatch && range && range[0] > 0 && data?.length) data[0] = selected[0];
      if (!head && emptyBatch) data = [];
      return { data, count, error: dbError };
    }).then(resolve, reject)
  };
  return query;
});

beforeEach(() => {
  vi.resetAllMocks();
  rows = Array.from({ length: 1105 }, (_, index) => row(index)).reverse();
  maximumRows = 1000;
  overrideCount = undefined;
  changedCount = false;
  duplicateBatch = false;
  emptyBatch = false;
  dbError = null;
  reads.length = 0;
  filters.length = 0;
  vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin", profile: null });
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
});

afterEach(() => vi.restoreAllMocks());

describe("complete and stable admin event pages", () => {
  it("uses database count/range and ID ties to reach records after the old 1000-row boundary", async () => {
    const result = await listAdminEvents({ page: "21", sort: "created_at", dir: "desc" });
    expect(result).toMatchObject({ page: 21, pageSize: 50, pageCount: 23, totalCount: 1105 });
    expect(result.events.map(item => item.id)).toEqual(Array.from({ length: 50 }, (_, index) => row(1000 + index).id));
    expect(reads).toEqual([
      { head: true, orders: [], range: undefined },
      { head: false, orders: [{ key: "created_at", asc: false, nullsFirst: false }, { key: "id", asc: true, nullsFirst: false }], range: [1000, 1049] }
    ]);
  });

  it("finds related text beyond 1000, folding Polish accents without truncating the catalogue", async () => {
    rows[0] = row(1104, { title: "Specjalny występ", category: { name: "Kultura" }, location: { city: { name: "Łódź" } }, organizer: { name: "Dom Sztuki" } });
    const result = await listAdminEvents({ q: "WYSTEP", category: "kultura", city: "Lodz", organizer: "sztuki" });
    expect(result.totalCount).toBe(1);
    expect(result.events.map(item => item.id)).toEqual([row(1104).id]);
    expect(reads.filter(read => !read.head).map(read => read.range)).toEqual([[0, 499], [500, 999], [1000, 1104]]);
  });

  it("sorts the entire relation-name pool before taking a page and keeps equal names stable", async () => {
    rows[0] = row(1104, { location: { city: { name: "Aaaa" } } });
    const first = await listAdminEvents({ sort: "city", dir: "asc" });
    const second = await listAdminEvents({ sort: "city", dir: "asc", page: "2" });
    expect(first.events[0].id).toBe(row(1104).id);
    expect(first.events[1].id).toBe(row(0).id);
    expect(second.events[0].id).toBe(row(49).id);
    expect(first.totalCount).toBe(1105);
    expect(new Set([...first.events, ...second.events].map(item => item.id)).size).toBe(100);
  });

  it.each(["%", "_", ",", "(status.eq.published)"])("treats %s as literal text instead of PostgREST syntax", async text => {
    rows = [row(0, { title: `Dosłowny ${text}` }), row(1, { title: "Zwykły koncert" })];
    const result = await listAdminEvents({ q: text });
    expect(result.events.map(item => item.id)).toEqual([row(0).id]);
  });

  it("honours lower Supabase response limits while filling the requested page", async () => {
    maximumRows = 17;
    const result = await listAdminEvents({ page: "2" });
    expect(result.events).toHaveLength(50);
    expect(result.events[0].id).toBe(row(50).id);
    expect(result.events[49].id).toBe(row(99).id);
  });

  it("clamps a page beyond the current result set to the final nonempty page", async () => {
    const result = await listAdminEvents({ page: "99999" });
    expect(result).toMatchObject({ page: 23, pageCount: 23, totalCount: 1105 });
    expect(result.events).toHaveLength(5);
    expect(reads[1].range).toEqual([1100, 1104]);
  });

  it("returns a true zero result without inventing a missing-data error", async () => {
    rows = [];
    expect(await listAdminEvents()).toEqual({ events: [], page: 1, pageCount: 1, pageSize: 50, totalCount: 0 });
    expect(reads).toHaveLength(1);
  });

  it("keeps review constrained to draft/pending even when status and publication parameters are forged", async () => {
    rows = [row(0, { status: "draft" }), row(1, { status: "pending_review" }), row(2), row(3, { status: "rejected" })];
    const result = await listAdminReviewEvents({ status: "published", featured: "yes", publishedFrom: "malformed", sort: "published_at" });
    expect(result.events.map(item => item.id)).toEqual([row(0).id, row(1).id]);
    expect(result.totalCount).toBe(2);
    expect(filters).toContainEqual(["in", "status", ["draft", "pending_review"]]);
    expect(filters.some(([kind, key]) => kind === "eq" && key === "status")).toBe(false);
  });

  it("distinguishes featured false/null from true while counting before pagination", async () => {
    rows = [row(0, { is_featured: true }), row(1, { is_featured: false }), row(2, { is_featured: null })];
    const result = await listAdminEvents({ featured: "no" });
    expect(result.totalCount).toBe(2);
    expect(result.events.map(item => item.id)).toEqual([row(1).id, row(2).id]);
  });
});

describe("admin date and parameter validation", () => {
  it("uses Warsaw inclusive dates and exclusive next midnight across the spring DST change", async () => {
    rows = [row(0, { start_at: "2026-03-28T22:59:59.999Z" }), row(1, { start_at: "2026-03-28T23:00:00.000Z" }), row(2, { start_at: "2026-03-29T21:59:59.999Z" }), row(3, { start_at: "2026-03-29T22:00:00.000Z" })];
    const result = await listAdminEvents({ eventFrom: "2026-03-29", eventTo: "2026-03-29" });
    expect(result.events.map(item => item.id)).toEqual([row(1).id, row(2).id]);
    expect(filters).toContainEqual(["gte", "start_at", "2026-03-28T23:00:00.000Z"]);
    expect(filters).toContainEqual(["lt", "start_at", "2026-03-29T22:00:00.000Z"]);
  });

  it("applies Warsaw boundaries to created/published dates and the 25-hour autumn day", () => {
    expect(adminEventDateBounds({ createdFrom: "2026-10-25", createdTo: "2026-10-25", publishedFrom: "2026-10-25", publishedTo: "2026-10-25" })).toEqual([
      { column: "created_at", from: "2026-10-24T22:00:00.000Z", until: "2026-10-25T23:00:00.000Z" },
      { column: "published_at", from: "2026-10-24T22:00:00.000Z", until: "2026-10-25T23:00:00.000Z" }
    ]);
  });

  it.each([{ eventFrom: "2026-02-30" }, { eventFrom: "2026-10-10", eventTo: "2026-10-09" }, { q: "x".repeat(201) }])("rejects invalid filters %j before opening a database client", async input => {
    await expect(listAdminEvents(input)).rejects.toBeInstanceOf(AdminEventFilterError);
    expect(requireAdmin).toHaveBeenCalled();
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "2oops", "1.5", "999999999999999999999", "Infinity"])("normalises invalid page %s and unknown SQL sort/status choices", page => {
    expect(parseAdminEventListFilters({ page, sort: "created_at);drop", dir: "sideways", status: "admin", featured: "all", ignored: "secret" })).toEqual({ sort: "created_at", dir: "desc", page: "1" });
  });

  it("preserves allowed filter values in pagination URLs and removes stale/unknown flags", () => {
    const parsed = parseAdminEventListFilters({ q: ["50%, _test", "discard"], category: "Kultura", city: "Łódź", status: "published", eventFrom: "2026-10-06", sort: "city", dir: "asc", page: "4", save: "unconfirmed", token: "secret" });
    const url = new URL(buildAdminEventListUrl("/admin/events", parsed, 5), "https://example.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "50%, _test", category: "Kultura", city: "Łódź", status: "published", eventFrom: "2026-10-06", sort: "city", dir: "asc", page: "5" });
    expect(new URL(buildAdminEventListUrl("/admin/review", parsed, 1), "https://example.invalid").searchParams.has("status")).toBe(false);
  });
});

describe("admin access and completeness failures", () => {
  it.each([listAdminEvents, listAdminReviewEvents])("checks admin access before any database read", async read => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Access denied"));
    await expect(read()).rejects.toThrow("Access denied");
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("reports an oversized complex pool rather than hiding matching records", async () => {
    overrideCount = ADMIN_EVENT_POOL_LIMIT + 1;
    await expect(listAdminEvents({ q: "Koncert" })).rejects.toThrow("Zbyt wiele wydarzeń");
    expect(reads).toHaveLength(1);
  });

  it.each(["missing-count", "changed-count", "duplicates", "empty-batch", "database-error"])("does not return success for %s", async failure => {
    if (failure === "missing-count") overrideCount = null;
    if (failure === "changed-count") changedCount = true;
    if (failure === "duplicates") duplicateBatch = true;
    if (failure === "empty-batch") emptyBatch = true;
    if (failure === "database-error") dbError = { message: "RLS/network unavailable" };
    await expect(listAdminEvents({ q: "Koncert" })).rejects.toThrow();
  });
});
