import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), client: vi.fn(), dataset: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOrganizerAccess: mocks.access }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: mocks.client }));
vi.mock("@/lib/organizer-statistics", () => ({ readCompleteOrganizerDataset: mocks.dataset, readOrganizerStatistics: vi.fn() }));
import { listOrganizerEvents } from "../lib/organizer-events";

const gte = vi.fn();
const lt = vi.fn();
const inFilter = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ memberships: [{ organizer_id: "organizer-a" }] });
  const query = {
    select: vi.fn(() => query), order: vi.fn(() => query), range: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn((...args: unknown[]) => { inFilter(...args); return query; }),
    gte: vi.fn((...args: unknown[]) => { gte(...args); return query; }),
    lt: vi.fn((...args: unknown[]) => { lt(...args); return query; }),
    returns: vi.fn().mockResolvedValue({ data: [], count: 0, error: null })
  };
  mocks.client.mockResolvedValue({ from: vi.fn(() => query) });
  mocks.dataset.mockImplementation(async (read: (offset: number, size: number, head: boolean) => Promise<unknown>) => {
    await read(0, 50, false);
    return { status: "complete", rows: [] };
  });
});

it("applies inclusive Warsaw start and exclusive next-day end before fetching own-organizer pages", async () => {
  expect(await listOrganizerEvents({ dateFrom: "2026-10-25", dateTo: "2026-10-25" })).toEqual([]);
  expect(inFilter).toHaveBeenCalledWith("submitted_by_organizer_id", ["organizer-a"]);
  expect(gte).toHaveBeenCalledExactlyOnceWith("start_at", "2026-10-24T22:00:00.000Z");
  expect(lt).toHaveBeenCalledExactlyOnceWith("start_at", "2026-10-25T23:00:00.000Z");
});

it("leaves the unprovided end unbounded", async () => {
  await listOrganizerEvents({ dateFrom: "2026-10-08" });
  expect(gte).toHaveBeenCalledWith("start_at", "2026-10-07T22:00:00.000Z");
  expect(lt).not.toHaveBeenCalled();
});
