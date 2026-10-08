import { describe, expect, it, vi } from "vitest";
import { readCompleteSavedEvents, type SavedEventRow } from "../lib/saved-event-reads";

const savedRows = (length: number): SavedEventRow[] => Array.from({ length }, (_, index) => ({
  event_id: `e7a00000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  created_at: "2026-10-08T12:00:00Z"
}));
type Response = { data: SavedEventRow[] | null; count: number | null; error: { message: string } | null };

function pagedClient(rows: SavedEventRow[], cap = 500, alter?: (response: Response, offset: number, head: boolean) => Response) {
  const ranges: Array<{ offset: number; last: number; head: boolean }> = [];
  const orders = vi.fn();
  const rpc = vi.fn((_name: string, _args: unknown, options: { count?: string; head?: boolean }) => {
    const query = {
      order: vi.fn((...args: unknown[]) => { orders(...args); return query; }),
      range: vi.fn(async (offset: number, last: number) => {
        const head = !!options.head;
        ranges.push({ offset, last, head });
        const response = { data: head ? null : rows.slice(offset, Math.min(last + 1, offset + cap)), count: rows.length, error: null };
        return alter ? alter(response, offset, head) : response;
      })
    };
    return query;
  });
  return { client: { rpc } as unknown as Parameters<typeof readCompleteSavedEvents>[0], rpc, ranges, orders };
}

describe("complete own-user saved-event RPC reads", () => {
  it("reads beyond 1000 saves and a lower server max_rows while preserving stable order", async () => {
    const rows = savedRows(1201);
    const { client, ranges, orders, rpc } = pagedClient(rows, 73);
    expect(await readCompleteSavedEvents(client)).toEqual(rows);
    expect(ranges.filter(page => !page.head).map(page => page.offset)).toEqual(
      Array.from({ length: 17 }, (_, index) => index * 73)
    );
    expect(ranges.at(-1)).toEqual({ offset: 0, last: 0, head: true });
    expect(orders).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(orders).toHaveBeenCalledWith("event_id", { ascending: true });
    expect(rpc.mock.calls.every(([name, args, options]) => name === "get_my_saved_events" &&
      JSON.stringify(args) === "{}" && options.count === "exact")).toBe(true);
  });

  it("confirms an empty list instead of assuming a missing page is empty", async () => {
    const { client, ranges } = pagedClient([]);
    expect(await readCompleteSavedEvents(client)).toEqual([]);
    expect(ranges).toHaveLength(2);
  });

  it.each([
    ["missing count", { count: null }],
    ["failed RPC", { error: { message: "Unavailable" } }],
    ["missing rows", { data: [] }]
  ])("refuses an incomplete result with %s", async (_reason, change) => {
    const { client } = pagedClient(savedRows(2), 1, (response, offset, head) =>
      !head && offset === 1 ? { ...response, ...change } : response);
    await expect(readCompleteSavedEvents(client)).rejects.toThrow();
  });

  it("refuses duplicate rows after a page shifted during the read", async () => {
    const rows = savedRows(2);
    const { client } = pagedClient(rows, 1, (response, offset, head) =>
      !head && offset === 1 ? { ...response, data: [rows[0]] } : response);
    await expect(readCompleteSavedEvents(client)).rejects.toThrow("spójnej");
  });

  it("refuses count changes on a later page and on the final HEAD check", async () => {
    for (const finalOnly of [false, true]) {
      const { client } = pagedClient(savedRows(2), 1, (response, offset, head) =>
        (finalOnly ? head : !head && offset === 1) ? { ...response, count: 3 } : response);
      await expect(readCompleteSavedEvents(client)).rejects.toThrow("zmieniła");
    }
  });

  it("reports a declared safety limit instead of returning the beginning of a larger list", async () => {
    const { client, ranges } = pagedClient(savedRows(3));
    await expect(readCompleteSavedEvents(client, 2)).rejects.toThrow("limit");
    expect(ranges).toHaveLength(1);
  });

  it("rejects rows that exceed the exact count", async () => {
    const { client } = pagedClient(savedRows(2), 500, response => ({ ...response, count: 1 }));
    await expect(readCompleteSavedEvents(client)).rejects.toThrow("kompletności");
  });
});
