import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(), requireOrganizerAccess: vi.fn(), getCurrentUserContext: vi.fn(), getPrimaryOrganizerId: vi.fn() }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ uploadEventImageToCloudinary: vi.fn() }));
vi.mock("@/lib/cities", () => ({ resolveCityIdFromForm: vi.fn() }));

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOrganizerAccess } from "../lib/auth";
import { createSupabaseUserClient } from "../lib/supabase-user";
import { uploadEventImageToCloudinary } from "../lib/cloudinary";
import { resolveCityIdFromForm } from "../lib/cities";
import { adminCreateEventAction, adminUpdateEventAction, adminSetEventStatusAction, getAdminEventForEdit } from "../lib/admin-events";
import { organizerCreateEventAction, organizerDuplicateEventAction, organizerUpdateEventAction, organizerHideEventAction, organizerCancelEventAction, getOrganizerEventForEdit } from "../lib/organizer-events";
import type { EventEditorState } from "../lib/event-editor-validation";

const emptyState = { fieldErrors: {}, error: null };
const oldPublication = "2026-09-01T12:00:00Z";
let currentEvent: Record<string, unknown> | null;
let updateResult: { data: unknown; error: unknown };
let sourceReadError: { message: string } | null;
let eventInsertResult: { data: unknown; error: unknown } | null;
let eventInsertException: Error | null;
let moderationError: { message: string } | null;
let notificationError: { message: string } | null;
const update = vi.fn();
const insert = vi.fn();
const eq = vi.fn();
const inFilter = vi.fn();
const from = vi.fn();
const order = vi.fn();

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Koncert", start_at: "2027-05-01T20:00", category_id: "category-a", organizer_id: "display-organizer", ...overrides })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  currentEvent = { id: "event-a", title: "Koncert", status: "rejected", visibility: "private", organizer_id: "display-organizer", submitted_by_organizer_id: "organizer-a", published_at: oldPublication, is_cancelled: false };
  updateResult = { data: { id: "event-a" }, error: null };
  sourceReadError = null;
  eventInsertResult = null;
  eventInsertException = null;
  moderationError = null;
  notificationError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin", profile: null });
  vi.mocked(requireOrganizerAccess).mockResolvedValue({
    userId: "organizer-user", profile: null, isAdmin: false,
    memberships: [{ id: "membership-a", organizer_id: "organizer-a", user_id: "organizer-user", role: "owner", created_at: null, organizer: null }]
  });
  vi.mocked(redirect).mockImplementation(path => { throw new Error(`Redirect: ${path}`); });
  vi.mocked(uploadEventImageToCloudinary).mockResolvedValue(null);
  from.mockImplementation((table: string) => {
    let operation = "read";
    let insertedPayload: Record<string, unknown> | null = null;
    const query = {
      select: vi.fn(() => query), maybeSingle: vi.fn(() => query), single: vi.fn(() => query), returns: vi.fn(() => query),
      order: vi.fn((...args: unknown[]) => { order(table, ...args); return query; }), limit: vi.fn(() => query),
      eq: vi.fn((...args: unknown[]) => { eq(...args); return query; }),
      in: vi.fn((...args: unknown[]) => { inFilter(...args); return query; }),
      update: vi.fn((payload: unknown) => { update(table, payload); operation = "update"; return query; }),
      insert: vi.fn((payload: unknown) => { insert(table, payload); insertedPayload = payload as Record<string, unknown>; operation = "insert"; return query; }),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        if (operation === "update") return updateResult;
        if (operation === "insert") {
          if (table === "events") {
            if (eventInsertException) throw eventInsertException;
            return eventInsertResult ?? { data: { id: insertedPayload?.id }, error: null };
          }
          return { data: { id: "created-related-row" }, error: table === "event_moderation_logs" ? moderationError : table === "notifications" ? notificationError : null };
        }
        return {
          data: table === "events" ? currentEvent : table === "organizer_users" ? [{ user_id: "organizer-user" }] : [],
          error: table === "event_sources" ? sourceReadError : null
        };
      }).then(resolve, reject)
    };
    return query;
  });
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
});

afterEach(() => vi.restoreAllMocks());

describe.each([
  ["hide", organizerHideEventAction, { visibility: "private" }],
  ["cancel", organizerCancelEventAction, { status: "archived", is_cancelled: true }]
] as const)("organizer %s confirmation", (_intent, action, payload) => {

  it.each(["zero rows", "wrong returned id", "RLS error"])("does not report success for %s", async failure => {
    updateResult = {
      data: failure === "wrong returned id" ? { id: "event-b" } : null,
      error: failure === "RLS error" ? { message: "Sensitive RLS details" } : null
    };
    const result = await action("event-a");
    expect(result.success).toBeNull();
    expect(result.error).toContain("Nie udało się potwierdzić");
    expect(result.error).not.toContain("Sensitive");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("confirms the owned row before invalidating and reporting success", async () => {
    const result = await action("event-a");
    expect(result.error).toBeNull();
    expect(result.success).toBeTruthy();
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining(payload));
    expect(eq).toHaveBeenCalledWith("id", "event-a");
    expect(eq).toHaveBeenCalledWith("submitted_by_organizer_id", "organizer-a");
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/events");
  });

  it("passes the authentication redirect through without attempting a write", async () => {
    const signal = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    vi.mocked(requireOrganizerAccess).mockRejectedValue(signal);
    await expect(action("event-a")).rejects.toThrow(signal);
    expect(update).not.toHaveBeenCalled();
  });
});

function createdEventId() {
  const payload = insert.mock.calls.find(([table]) => table === "events")?.[1] as { id: string };
  expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  return payload.id;
}

it.each([
  ["admin", getAdminEventForEdit], ["organizer", getOrganizerEventForEdit]
] as const)("loads the %s editor's first source in the same stable order used by the source writer", async (_scope, readAction) => {
  await readAction("event-a");
  expect(order).toHaveBeenCalledWith("events", "created_at", { ascending: true, referencedTable: "sources" });
  expect(order).toHaveBeenCalledWith("events", "id", { ascending: true, referencedTable: "sources" });
  expect(insert).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

describe("organizer event transitions and ownership", () => {
  it("explicitly resubmits rejected without accepting publication, foreign owner, or visibility input", async () => {
    await expect(organizerUpdateEventAction("event-a", emptyState, form({ intent: "resubmit", status: "published", submitted_by_organizer_id: "organizer-b", organizer_id: "organizer-b", visibility: "public" }))).rejects.toThrow("Redirect: /organizer");
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ status: "pending_review", visibility: "private", organizer_id: "display-organizer", submitted_by_organizer_id: "organizer-a", published_at: oldPublication }));
    expect(eq).toHaveBeenCalledWith("submitted_by_organizer_id", "organizer-a");
    expect(inFilter).toHaveBeenCalledWith("submitted_by_organizer_id", ["organizer-a"]);
  });
  it("ordinary rejected edits stay rejected", async () => {
    await expect(organizerUpdateEventAction("event-a", emptyState, form())).rejects.toThrow("Redirect: /organizer");
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ status: "rejected", published_at: oldPublication }));
  });
  it("published edits require review and preserve metadata", async () => {
    currentEvent!.status = "published";
    await expect(organizerUpdateEventAction("event-a", emptyState, form({ status: "published" }))).rejects.toThrow("Redirect: /organizer");
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ status: "pending_review", visibility: "private", published_at: oldPublication }));
  });
  it.each(["archived", "draft", "pending_review", "published"])("refuses forged resubmit from %s", async status => {
    currentEvent!.status = status;
    expect(await organizerUpdateEventAction("event-a", emptyState, form({ intent: "resubmit" }))).toMatchObject({ fieldErrors: { intent: expect.any(String) } });
    expect(update).not.toHaveBeenCalled();
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
  });
  it("refuses resubmission of a cancelled rejected event", async () => {
    currentEvent!.is_cancelled = true;
    expect(await organizerUpdateEventAction("event-a", emptyState, form({ intent: "resubmit" }))).toMatchObject({ fieldErrors: { intent: expect.any(String) } });
    expect(update).not.toHaveBeenCalled();
  });
  it("refuses editing another organization's event before upload or update", async () => {
    currentEvent!.submitted_by_organizer_id = "organizer-b";
    await expect(organizerUpdateEventAction("event-a", emptyState, form({ intent: "resubmit" }))).rejects.toThrow("Redirect: /organizer");
    expect(update).not.toHaveBeenCalled();
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
  });
  it("returns per-field errors before mutation", async () => {
    const result = await organizerUpdateEventAction("event-a", emptyState, form({ price_min: "-2", source_url: "javascript:alert(1)" }));
    expect(result.fieldErrors).toMatchObject({ price_min: expect.any(String), source_url: expect.any(String) });
    expect(update).not.toHaveBeenCalled();
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
  });
  it("retains the form with a generic error when preparation/upload fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(uploadEventImageToCloudinary).mockRejectedValue(new Error("Sensitive service detail"));
    const result = await organizerUpdateEventAction("event-a", emptyState, form());
    expect(result.error).toContain("Nie udało się przygotować");
    expect(result.error).not.toContain("Sensitive");
    expect(update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("creates only pending_review under one of the user's organizers", async () => {
    await expect(organizerCreateEventAction(emptyState, form({ status: "published", organizer_id: "organizer-b" }))).rejects.toThrow("Redirect: /organizer/events/");
    expect(insert).toHaveBeenCalledWith("events", expect.objectContaining({ status: "pending_review", organizer_id: "organizer-a", submitted_by_organizer_id: "organizer-a", created_by: "organizer-user" }));
    expect(redirect).toHaveBeenCalledWith(`/organizer/events/${createdEventId()}/edit`);
  });
  it("does not report success for a silently filtered update", async () => {
    updateResult = { data: null, error: null };
    const result = await organizerUpdateEventAction("event-a", emptyState, form({ source_name: "Źródło" }));
    expect(result.saveIssue).toEqual({ kind: "unconfirmed", editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" });
    expect(from).not.toHaveBeenCalledWith("event_sources");
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/events");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("does not allow forged previous recovery state to edit another organizer's event", async () => {
    currentEvent!.submitted_by_organizer_id = "organizer-b";
    const forgedState: EventEditorState = {
      ...emptyState,
      saveIssue: { kind: "partial", editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" }
    };
    await expect(organizerUpdateEventAction("event-a", forgedState, form({ source_name: "Forged source" }))).rejects.toThrow("Redirect: /organizer");
    expect(requireOrganizerAccess).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
  });
  it("opens the committed duplicate for source verification instead of leaving a duplicate retry on the list", async () => {
    currentEvent!.sources = [{ source_name: "Źródło kopii", source_url: "https://example.com", source_type: "organizer" }];
    sourceReadError = { message: "Source unavailable" };
    await expect(organizerDuplicateEventAction("event-a")).rejects.toThrow("?save=source-unconfirmed");
    expect(redirect).toHaveBeenCalledWith(`/organizer/events/${createdEventId()}/edit?save=source-unconfirmed`);
    expect(insert.mock.calls.filter(([table]) => table === "events")).toHaveLength(1);
    expect(insert).toHaveBeenCalledWith("events", expect.objectContaining({ status: "pending_review", submitted_by_organizer_id: "organizer-a", created_by: "organizer-user" }));
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/events");
  });
  it("takes an uncertain duplicate to the list with a verification notice and does not copy sources", async () => {
    currentEvent!.sources = [{ source_name: "Źródło kopii" }];
    eventInsertException = new Error("Sensitive transport detail");
    await expect(organizerDuplicateEventAction("event-a")).rejects.toThrow("Redirect: /organizer/events?save=unconfirmed");
    expect(from).not.toHaveBeenCalledWith("event_sources");
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/events");
    expect(insert.mock.calls.filter(([table]) => table === "events")).toHaveLength(1);
  });
  it("still checks duplicate ownership before creating a row", async () => {
    currentEvent!.submitted_by_organizer_id = "organizer-b";
    await expect(organizerDuplicateEventAction("event-a")).rejects.toThrow("Redirect: /organizer/events");
    expect(insert).not.toHaveBeenCalled();
  });
});

describe.each([
  ["admin", adminCreateEventAction],
  ["organizer", organizerCreateEventAction]
] as const)("%s create save outcomes", (scope, createAction) => {
  it("returns a partial save with the committed ID after a source failure and invalidates caches", async () => {
    sourceReadError = { message: "Sensitive source detail" };
    const result = await createAction(emptyState, form({ source_name: "Strona organizatora" }));
    expect(result.saveIssue).toEqual({ kind: "partial", editHref: `/${scope}/events/${createdEventId()}/edit`, listHref: `/${scope}/events` });
    expect(result.error).toContain("Wydarzenie zostało zapisane");
    expect(result.error).not.toContain("Sensitive");
    expect(insert.mock.calls.filter(([table]) => table === "events")).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith(`/${scope}/events`);
    expect(vi.mocked(revalidatePath).mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[from.mock.calls.findIndex(([table]) => table === "event_sources")]);
    expect(redirect).not.toHaveBeenCalled();
  });
  it.each(["database error", "transport exception", "missing returned row", "different returned ID"])("preserves attempted recovery links for %s without writing related data", async failure => {
    if (failure === "database error") eventInsertResult = { data: null, error: { message: "Sensitive database detail" } };
    if (failure === "transport exception") eventInsertException = new Error("Sensitive transport detail");
    if (failure === "missing returned row") eventInsertResult = { data: null, error: null };
    if (failure === "different returned ID") eventInsertResult = { data: { id: "other-event" }, error: null };
    const result = await createAction(emptyState, form({ source_name: "Źródło" }));
    expect(result.saveIssue).toEqual({ kind: "unconfirmed", editHref: `/${scope}/events/${createdEventId()}/edit`, listHref: `/${scope}/events` });
    expect(result.error).toContain("potwierdzić zapisu");
    expect(result.error).not.toContain("Sensitive");
    expect(from).not.toHaveBeenCalledWith("event_sources");
    expect(from).not.toHaveBeenCalledWith("event_moderation_logs");
    expect(revalidatePath).toHaveBeenCalledWith(`/${scope}/events`);
    expect(redirect).not.toHaveBeenCalled();
  });
  it("ignores a client-supplied recovery destination rather than reusing its event ID", async () => {
    sourceReadError = { message: "Source unavailable" };
    const forgedState: EventEditorState = {
      ...emptyState,
      saveIssue: { kind: "partial", editHref: `/${scope}/events/foreign-event/edit`, listHref: "https://example.com" }
    };
    const result = await createAction(forgedState, form({ source_name: "Źródło" }));
    expect(result.saveIssue).toEqual({ kind: "partial", editHref: `/${scope}/events/${createdEventId()}/edit`, listHref: `/${scope}/events` });
    expect(update).not.toHaveBeenCalledWith("events", expect.anything());
  });
});

describe("admin event metadata and moderation", () => {
  it("changes the displayed organizer while preserving the original submitter and private visibility", async () => {
    await expect(adminUpdateEventAction("event-a", emptyState, form({ status: "rejected", organizer_id: "new-display-organizer" }))).rejects.toThrow("Redirect: /admin/events");
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ organizer_id: "new-display-organizer", submitted_by_organizer_id: "organizer-a", visibility: "private", published_at: oldPublication }));
  });
  it.each(["published", "draft", "archived", "rejected"] as const)("preserves the publication date during quick status transition to %s", async status => {
    await adminSetEventStatusAction("event-a", status);
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ status, published_at: oldPublication }));
  });
  it("sets a timestamp only for a first publication", async () => {
    currentEvent!.published_at = null;
    await adminSetEventStatusAction("event-a", "published");
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ published_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }));
  });
  it("returns invalid status as a field error without uploading", async () => {
    expect(await adminCreateEventAction(emptyState, form({ status: "bad" }))).toMatchObject({ fieldErrors: { status: expect.any(String) } });
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
  it("returns a generic preparation failure without creating an event after a location error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(resolveCityIdFromForm).mockRejectedValue(new Error("Location error"));
    const result = await adminCreateEventAction(emptyState, form({ location_city: "Warszawa" }));
    expect(result.error).toContain("Nie udało się przygotować");
    expect(insert).not.toHaveBeenCalledWith("events", expect.anything());
    expect(revalidatePath).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("rejects a vanished record before image upload", async () => {
    currentEvent = null;
    await expect(adminUpdateEventAction("event-a", emptyState, form())).rejects.toThrow("Wydarzenie nie istnieje");
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it("does not write moderation history after a zero-row status update", async () => {
    updateResult = { data: null, error: null };
    await expect(adminSetEventStatusAction("event-a", "published")).rejects.toThrow("Redirect: /admin/events?save=unconfirmed");
    expect(insert).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events");
  });
  it("returns unconfirmed for a zero-row editor update without writing sources or moderation", async () => {
    updateResult = { data: null, error: null };
    const result = await adminUpdateEventAction("event-a", emptyState, form({ status: "published", source_name: "Źródło" }));
    expect(result.saveIssue).toEqual({ kind: "unconfirmed", editHref: "/admin/events/event-a/edit", listHref: "/admin/events" });
    expect(from).not.toHaveBeenCalledWith("event_sources");
    expect(from).not.toHaveBeenCalledWith("event_moderation_logs");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("attempts moderation and notifications despite a source failure", async () => {
    sourceReadError = { message: "Source unavailable" };
    const result = await adminUpdateEventAction("event-a", emptyState, form({ status: "published", source_name: "Źródło" }));
    expect(result.saveIssue?.kind).toBe("partial");
    expect(insert).toHaveBeenCalledWith("event_moderation_logs", expect.objectContaining({ event_id: "event-a", old_status: "rejected", new_status: "published", reviewed_by: "admin" }));
    expect(insert).toHaveBeenCalledWith("notifications", expect.arrayContaining([expect.objectContaining({ related_event_id: "event-a", user_id: "organizer-user", type: "event_published" })]));
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events");
    expect(redirect).not.toHaveBeenCalled();
  });
  it.each(["moderation", "notification"])("returns partial after a %s failure instead of reporting a failed event save or success", async failure => {
    if (failure === "moderation") moderationError = { message: "Sensitive moderation detail" };
    else notificationError = { message: "Sensitive notification detail" };
    const result = await adminUpdateEventAction("event-a", emptyState, form({ status: "published", source_name: "Źródło" }));
    expect(result.saveIssue).toEqual({ kind: "partial", editHref: "/admin/events/event-a/edit", listHref: "/admin/events" });
    expect(result.error).toContain("Wydarzenie zostało zapisane");
    expect(result.error).toContain("historii moderacji i powiadomień");
    expect(result.error).not.toContain("Sensitive");
    expect(from).toHaveBeenCalledWith("event_sources");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("keeps cache invalidation when a quick status write succeeds but moderation fails", async () => {
    moderationError = { message: "Moderation unavailable" };
    await expect(adminSetEventStatusAction("event-a", "published")).rejects.toThrow("Redirect: /admin/events?save=moderation-unconfirmed");
    expect(update).toHaveBeenCalledWith("events", expect.objectContaining({ status: "published" }));
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events");
  });
});
