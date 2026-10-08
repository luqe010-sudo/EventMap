import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), consume: vi.fn(), reserve: vi.fn(), release: vi.fn(), settle: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/analytics-ingestion-guard", () => ({
  analyticsClientKey: () => "client",
  analyticsIngestionGuard: { consume: mocks.consume, reserve: mocks.reserve }
}));

import { readAnalyticsRequest, isSameOriginAnalyticsRequest, recordPublicEventAnalytics } from "@/lib/event-analytics";
import { parseAnalyticsBody } from "@/lib/event-analytics-contract";
import { POST } from "../app/api/events/[id]/analytics/route";

const eventId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const body = { eventType: "view" as const, sessionId, analyticsConsent: true as const };
const context = { params: Promise.resolve({ id: eventId }) };
function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request(`https://example.test/api/events/${eventId}/analytics`, {
    method: "POST", headers: { "content-type": "application/json", origin: "https://example.test", ...headers }, body: JSON.stringify(value)
  });
}
function database(publicEvent: boolean, failure?: "read" | "insert" | "transport") {
  const query = { select: vi.fn(), eq: vi.fn(), or: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.or.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: publicEvent ? { id: eventId } : null, error: failure === "read" ? {} : null });
  const insert = vi.fn().mockResolvedValue({ error: failure === "insert" ? {} : null });
  if (failure === "transport") insert.mockRejectedValue(new Error("Lost response"));
  mocks.from.mockImplementation((table: string) => table === "events" ? query : { insert });
  return { query, insert };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.consume.mockReturnValue(true);
  mocks.reserve.mockReturnValue({ kind: "reserved", release: mocks.release, settle: mocks.settle });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("analytics input boundary", () => {
  it.each([{}, { ...body, analyticsConsent: false }, { ...body, sessionId: "x" }, { ...body, eventType: "admin" }, { ...body, user_id: eventId }, [body]])("rejects untrusted or nonconsenting payload %j", (value) => {
    expect(parseAnalyticsBody(value)).toBeNull();
  });
  it("accepts the exact contract and rejects other content types", async () => {
    expect(await readAnalyticsRequest(request())).toEqual({ body });
    expect(await readAnalyticsRequest(request(body, { "content-type": "text/plain" }))).toEqual({ status: 415 });
  });
  it("bounds advertised and streamed body bytes even with a forged small content-length", async () => {
    expect(await readAnalyticsRequest(request(body, { "content-length": "1025" }))).toEqual({ status: 413 });
    expect(await readAnalyticsRequest(request("ą".repeat(600), { "content-length": "1" }))).toEqual({ status: 413 });
  });
  it("cancels an oversized stream and rejects malformed JSON or UTF-8", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1025)); }, cancel });
    const streamed = new Request("https://example.test", { method: "POST", body: stream, headers: { "content-type": "application/json" }, duplex: "half" } as RequestInit);
    expect(await readAnalyticsRequest(streamed)).toEqual({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
    for (const invalid of ["{", new Uint8Array([0xff])]) {
      expect(await readAnalyticsRequest(new Request("https://example.test", { method: "POST", body: invalid, headers: { "content-type": "application/json" } }))).toEqual({ status: 400 });
    }
  });
  it("requires a same-origin browser request, rejecting null, missing and foreign origins", () => {
    expect(isSameOriginAnalyticsRequest(request())).toBe(true);
    for (const origin of ["null", "https://foreign.test", "https://example.test/path"]) expect(isSameOriginAnalyticsRequest(request(body, { origin }))).toBe(false);
    expect(isSameOriginAnalyticsRequest(new Request("https://example.test"))).toBe(false);
    expect(isSameOriginAnalyticsRequest(request(body, { "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("uses the incoming Host when Next's bind hostname differs, never forwarded-host or URL credentials", () => {
    expect(isSameOriginAnalyticsRequest(request(body, { host: "localhost:3000", origin: "https://localhost:3000" }))).toBe(true);
    expect(isSameOriginAnalyticsRequest(request(body, { host: "127.0.0.1:3000", origin: "https://localhost:3000" }))).toBe(false);
    expect(isSameOriginAnalyticsRequest(request(body, { "x-forwarded-host": "foreign.test", origin: "https://foreign.test" }))).toBe(false);
    for (const host of ["user@example.test", "example.test/path", "example.test#fragment"]) {
      expect(isSameOriginAnalyticsRequest(request(body, { host }))).toBe(false);
    }
  });
});

describe("public analytics persistence", () => {
  it("requires published/public/noncancelled and inserts no account identity", async () => {
    const { query, insert } = database(true);
    expect(await recordPublicEventAnalytics(eventId, body)).toBe("recorded");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.eq).toHaveBeenCalledWith("visibility", "public");
    expect(query.or).toHaveBeenCalledWith("is_cancelled.is.null,is_cancelled.eq.false");
    expect(insert).toHaveBeenCalledWith({ event_id: eventId, event_type: "view", session_id: sessionId, user_id: null });
  });
  it("never inserts when publication cannot be established", async () => {
    const { insert } = database(false);
    expect(await recordPublicEventAnalytics(eventId, body)).toBe("not-public");
    expect(insert).not.toHaveBeenCalled();
    database(true, "read");
    await expect(recordPublicEventAnalytics(eventId, body)).rejects.toThrow();
  });
});

describe("analytics HTTP responses", () => {
  it("validates before using the database and never caches errors", async () => {
    const invalid = await POST(request(), { params: Promise.resolve({ id: "bad" }) });
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect((await POST(request(body, { origin: "https://foreign.test" }), context)).status).toBe(403);
    expect((await POST(request({ ...body, analyticsConsent: false }), context)).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns 429 before database work and acknowledges duplicates without re-inserting", async () => {
    mocks.consume.mockReturnValue(false);
    const limited = await POST(request(), context);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    mocks.consume.mockReturnValue(true);
    mocks.reserve.mockReturnValue({ kind: "duplicate" });
    expect(await (await POST(request(), context)).json()).toEqual({ ok: true, ignored: true });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("releases a known missing-public-event reservation", async () => {
    database(false);
    expect((await POST(request(), context)).status).toBe(404);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it.each(["insert", "transport"] as const)("returns unavailable and retains the short reservation after %s failure", async (failure) => {
    database(true, failure);
    expect((await POST(request(), context)).status).toBe(503);
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.settle).toHaveBeenCalledOnce();
  });
  it("acknowledges a successful insert and never caches it", async () => {
    database(true);
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
});
