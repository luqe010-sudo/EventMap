import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), redirect: vi.fn() }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/events", () => ({ listPublicEventsByIds: vi.fn() }));

import { createSupabaseUserClient } from "../lib/supabase-user";
import { removeSavedEventAction, toggleSavedEventAction } from "../lib/user-account-actions";
import { getCurrentUserSavedEventIds, getEventSaveState, getUserAccountData } from "../lib/user-account";
import { listPublicEventsByIds, type EventItem } from "../lib/events";
import { revalidatePath } from "next/cache";

const eventId = "e7a00000-0000-4000-8000-000000000101";
const rpc = vi.fn();
const getUser = vi.fn();
const from = vi.fn();

function completeSavedRpc(rows: Array<{ event_id: string; created_at?: string }>) {
  rpc.mockImplementation((_name, _args, options) => {
    const query = {
      order: vi.fn(() => query),
      range: vi.fn().mockResolvedValue({ data: options?.head ? null : rows, count: rows.length, error: null })
    };
    return query;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "current-user", email: "test@example.invalid" } }, error: null });
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ auth: { getUser }, rpc, from } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saved event mutation", () => {
  it.each(["", "invalid", "../../event"])("rejects invalid identifier %s before requesting a session", async (id) => {
    expect((await toggleSavedEventAction(id, true)).error).toBeTruthy();
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });
  it("requires login before invoking the RPC", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await toggleSavedEventAction(eventId, true)).toEqual({ saved: false, requiresLogin: true });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([true, false])("sets desired state %s without accepting a user ID or querying the table", async (saved) => {
    rpc.mockResolvedValue({ data: saved, error: null });
    expect(await toggleSavedEventAction(eventId, saved)).toEqual({ saved });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("set_my_saved_event", { p_event_id: eventId, p_saved: saved });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/account");
  });
  it("explains rejection of an event withdrawn while the page was open", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    const result = await toggleSavedEventAction(eventId, true);
    expect(result.saved).toBe(false);
    expect(result.error).toContain("nie można już zapisać");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("does not report success when the RPC returns an unexpected state", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await toggleSavedEventAction(eventId, true)).error).toBeTruthy();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("preserves the previous saved state when removal fails", async () => {
    rpc.mockRejectedValue(new Error("Network unavailable"));
    expect(await toggleSavedEventAction(eventId, false)).toMatchObject({ saved: true, error: expect.any(String) });
  });
});

describe("saved event list removal", () => {
  it("returns an RPC failure to the card and does not revalidate an unchanged list", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Denied" } });
    expect(await removeSavedEventAction(eventId)).toMatchObject({ saved: true, error: expect.any(String) });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an expired session so the card can resume after login", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await removeSavedEventAction(eventId)).toEqual({ saved: false, requiresLogin: true });
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("confirms removal only when the own-user RPC returns false", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await removeSavedEventAction(eventId)).toEqual({ saved: false });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("set_my_saved_event", { p_event_id: eventId, p_saved: false });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/saved");
  });
});

describe("private saved event reads", () => {
  it("does not query saved events for a logged out viewer", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUserSavedEventIds()).toEqual({ isLoggedIn: false, eventIds: [] });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses the own-user RPC without a caller-supplied user ID", async () => {
    completeSavedRpc([{ event_id: eventId }]);
    expect(await getCurrentUserSavedEventIds()).toEqual({ isLoggedIn: true, eventIds: [eventId] });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "get_my_saved_events", {}, { count: "exact" });
    expect(rpc).toHaveBeenNthCalledWith(2, "get_my_saved_events", {}, { count: "exact", head: true });
    expect(from).not.toHaveBeenCalled();
  });
  it("propagates a failed read instead of reporting an empty saved list", async () => {
    const query = { order: vi.fn(() => query), range: vi.fn().mockResolvedValue({ data: null, count: null, error: { message: "Unavailable" } }) };
    rpc.mockReturnValue(query);
    await expect(getCurrentUserSavedEventIds()).rejects.toThrow();
  });
  it("interprets an empty RPC array as an unsaved event", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getEventSaveState(eventId)).toEqual({ isLoggedIn: true, isSaved: false });
    expect(rpc).toHaveBeenCalledWith("get_my_saved_events", { p_event_id: eventId });
  });
  it("keeps save order and hides events no longer returned by the public query", async () => {
    const profileQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { role: "user" }, error: null }) };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    from.mockReturnValue(profileQuery);
    completeSavedRpc([{ event_id: "newer" }, { event_id: "withdrawn" }, { event_id: "older" }]);
    vi.mocked(listPublicEventsByIds).mockResolvedValue([{ id: "older" }, { id: "newer" }] as EventItem[]);
    const account = await getUserAccountData();
    expect(account.savedEvents.map((event) => event.id)).toEqual(["newer", "older"]);
    expect(account.savedEventsError).toBeNull();
    expect(from).toHaveBeenCalledExactlyOnceWith("profiles");
  });
  it("shows a saved-list failure instead of hydrating and displaying an incomplete account list", async () => {
    const profileQuery = { select: vi.fn(() => profileQuery), eq: vi.fn(() => profileQuery), maybeSingle: vi.fn().mockResolvedValue({ data: { role: "user" }, error: null }) };
    from.mockReturnValue(profileQuery);
    const savedQuery = { order: vi.fn(() => savedQuery), range: vi.fn().mockResolvedValue({ data: [{ event_id: eventId }], count: null, error: null }) };
    rpc.mockReturnValue(savedQuery);
    const account = await getUserAccountData();
    expect(account.savedEvents).toEqual([]);
    expect(account.savedEventsError).toContain("Nie udało się pobrać");
    expect(listPublicEventsByIds).not.toHaveBeenCalled();
  });
  it("keeps the account profile and email when public saved-event hydration fails", async () => {
    const profile = { id: "current-user", display_name: "Test User", role: "user" };
    const profileQuery = { select: vi.fn(() => profileQuery), eq: vi.fn(() => profileQuery), maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }) };
    from.mockReturnValue(profileQuery);
    completeSavedRpc([{ event_id: eventId }]);
    vi.mocked(listPublicEventsByIds).mockRejectedValue(new Error("Sensitive provider details"));
    const account = await getUserAccountData();
    expect(account).toMatchObject({ email: "test@example.invalid", profile, savedEvents: [], savedEventsError: expect.stringContaining("Nie udało się pobrać") });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Sensitive provider details");
  });
  it("preserves framework redirects during saved-event hydration", async () => {
    const profileQuery = { select: vi.fn(() => profileQuery), eq: vi.fn(() => profileQuery), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    from.mockReturnValue(profileQuery);
    completeSavedRpc([{ event_id: eventId }]);
    const signal = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    vi.mocked(listPublicEventsByIds).mockRejectedValue(signal);
    await expect(getUserAccountData()).rejects.toBe(signal);
  });
});
