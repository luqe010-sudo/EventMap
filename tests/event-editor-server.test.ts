import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ uploadEventImageToCloudinary: vi.fn() }));
vi.mock("@/lib/cities", () => ({ resolveCityIdFromForm: vi.fn() }));

import { buildEventWritePayload, eventPreparationFailure, saveEventSource } from "../lib/event-editor-server";
import { createSupabaseUserClient } from "../lib/supabase-user";
import { uploadEventImageToCloudinary } from "../lib/cloudinary";
import { resolveCityIdFromForm } from "../lib/cities";
import { EventValidationError } from "../lib/event-editor-validation";

function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Koncert", category_id: "category", start_at: "2027-05-01T20:00", ...overrides })) if (value !== undefined) data.set(key, value);
  return data;
}
const existing = { visibility: "private", submitted_by_organizer_id: "original-organizer", published_at: "2026-09-01T12:00:00Z" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(uploadEventImageToCloudinary).mockResolvedValue(null);
});

describe("confirmed source writes", () => {
  function sourceClient(existingId: string | null, written: { data: unknown; error: unknown }) {
    const eq = vi.fn();
    const order = vi.fn();
    const update = vi.fn();
    const insert = vi.fn();
    let operation = "read";
    const query = {
      select: vi.fn(() => query), limit: vi.fn(() => query),
      order: vi.fn((...args: unknown[]) => { order(...args); return query; }),
      eq: vi.fn((...args: unknown[]) => { eq(...args); return query; }),
      update: vi.fn((payload: unknown) => { operation = "update"; update(payload); return query; }),
      insert: vi.fn((payload: unknown) => { operation = "insert"; insert(payload); return query; }),
      maybeSingle: vi.fn(() => operation === "read" ? Promise.resolve({ data: existingId ? { id: existingId } : null, error: null }) : Promise.resolve(written)),
      single: vi.fn(() => Promise.resolve(written))
    };
    const from = vi.fn(() => query);
    vi.mocked(createSupabaseUserClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
    return { eq, order, update, insert, from };
  }

  it("does not report a silently filtered source update as saved", async () => {
    const client = sourceClient("source-a", { data: null, error: null });
    await expect(saveEventSource("event-a", form({ source_name: "Źródło" }), "organizer")).rejects.toThrow("potwierdzić zapisu źródła");
    expect(client.eq).toHaveBeenCalledWith("id", "source-a");
    expect(client.eq).toHaveBeenCalledWith("event_id", "event-a");
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("selects the first source deterministically and preserves its type when omitted", async () => {
    const client = sourceClient("source-a", { data: { id: "source-a" }, error: null });
    await saveEventSource("event-a", form({ source_url: "https://example.com" }), "manual");
    expect(client.order.mock.calls).toEqual([["created_at", { ascending: true }], ["id", { ascending: true }]]);
    expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ source_url: "https://example.com" }));
    expect(client.update.mock.calls[0][0]).not.toHaveProperty("source_type");
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("accepts an explicitly supplied type when updating a source", async () => {
    const client = sourceClient("source-a", { data: { id: "source-a" }, error: null });
    await saveEventSource("event-a", form({ source_name: "Źródło", source_type: "import" }), "manual");
    expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ source_type: "import" }));
  });

  it.each([[undefined, "organizer"], ["import", "import"]])("uses the insert default only when the source type is absent (%s)", async (sourceType, expectedType) => {
    const client = sourceClient(null, { data: { id: "source-a" }, error: null });
    await saveEventSource("event-a", form({ source_name: "Źródło", source_type: sourceType }), "organizer");
    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({ event_id: "event-a", source_type: expectedType }));
  });

  it("clears only the first source's editable fields when both edit inputs are blank", async () => {
    const client = sourceClient("source-a", { data: { id: "source-a" }, error: null });
    await saveEventSource("event-a", form({ source_name: " ", source_url: "", source_type: "ignored" }), "organizer", { clearWhenBlank: true });
    expect(client.eq.mock.calls).toEqual([["event_id", "event-a"], ["id", "source-a"], ["event_id", "event-a"]]);
    expect(client.update).toHaveBeenCalledExactlyOnceWith({ source_name: null, source_url: null });
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("does not create an empty source when the edit has nothing to clear", async () => {
    const client = sourceClient(null, { data: null, error: null });
    await saveEventSource("event-a", form({ source_name: "", source_url: "" }), "organizer", { clearWhenBlank: true });
    expect(client.update).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("confirms creation instead of reporting a missing insert result as success", async () => {
    sourceClient(null, { data: null, error: null });
    await expect(saveEventSource("event-a", form({ source_name: "Źródło" }), "manual")).rejects.toThrow("potwierdzić zapisu źródła");
  });

  it("leaves blank source inputs on create and omitted inputs on edit untouched", async () => {
    await saveEventSource("event-a", form({ source_name: "", source_url: "" }), "manual");
    await saveEventSource("event-a", form(), "manual", { clearWhenBlank: true });
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });
});

describe("shared event write payload", () => {
  it("rethrows framework redirects rather than turning them into form errors", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    expect(() => eventPreparationFailure(redirect)).toThrow(redirect);
  });
  it.each([{ end_at: "2027-05-01T19:00" }, { price_min: "-1" }, { source_url: "javascript:alert(1)" }, { location_latitude: "100", location_longitude: "20" }])("validates everything before image upload or location creation %o", async values => {
    await expect(buildEventWritePayload(form({ location_city: "Warszawa", ...values }), { mode: "create", createdBy: "user", organizerId: "organizer", status: "pending_review" })).rejects.toThrow(EventValidationError);
    expect(uploadEventImageToCloudinary).not.toHaveBeenCalled();
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
    expect(resolveCityIdFromForm).not.toHaveBeenCalled();
  });
  it.each(["published", "pending_review", "rejected", "archived"])("preserves hidden visibility, original submitter and first publication on %s edit", async status => {
    const payload = await buildEventWritePayload(form({ visibility: "public", submitted_by_organizer_id: "forged", published_at: "forged", created_by: "forged" }), { mode: "update", existing, organizerId: "display-organizer", status });
    expect(payload).toMatchObject({ visibility: "private", submitted_by_organizer_id: "original-organizer", published_at: existing.published_at, organizer_id: "display-organizer", status });
    expect(payload).not.toHaveProperty("created_by");
  });
  it("preserves null metadata rather than replacing it with public or a new submitter", async () => {
    expect(await buildEventWritePayload(form(), { mode: "update", existing: { visibility: null, submitted_by_organizer_id: null, published_at: null }, organizerId: "display-organizer", status: "draft" })).toMatchObject({ visibility: null, submitted_by_organizer_id: null, published_at: null });
  });
  it("sets the first publication only on initial publication", async () => {
    const before = Date.now();
    const payload = await buildEventWritePayload(form(), { mode: "update", existing: { ...existing, published_at: null }, organizerId: "organizer", status: "published" });
    expect(Date.parse(payload.published_at!)).toBeGreaterThanOrEqual(before);
  });
  it("creates a public event with a server-selected owner and author", async () => {
    const payload = await buildEventWritePayload(form({ status: "published", organizer_id: "forged", submitted_by_organizer_id: "forged" }), { mode: "create", createdBy: "user", organizerId: "organizer", status: "pending_review" });
    expect(payload).toMatchObject({ visibility: "public", submitted_by_organizer_id: "organizer", organizer_id: "organizer", created_by: "user", status: "pending_review", published_at: null });
  });
});
