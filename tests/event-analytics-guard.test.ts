import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsIngestionGuard, analyticsClientKey } from "@/lib/analytics-ingestion-guard";

afterEach(() => vi.unstubAllEnvs());

describe("bounded instance analytics guard", () => {
  it("limits a client, resets at expiry and limits rotated clients globally", () => {
    let now = 100;
    const guard = new AnalyticsIngestionGuard(() => now);
    for (let i = 0; i < 60; i++) expect(guard.consume("one")).toBe(true);
    expect(guard.consume("one")).toBe(false);
    for (let i = 0; i < 540; i++) expect(guard.consume(`client-${i}`)).toBe(true);
    expect(guard.consume("new-client")).toBe(false);
    now += 60_000;
    expect(guard.consume("one")).toBe(true);
  });

  it("does not evict active identities to make room for attacker rotations", () => {
    let now = 0;
    const guard = new AnalyticsIngestionGuard(() => now, 2);
    expect(guard.consume("a")).toBe(true);
    expect(guard.consume("b")).toBe(true);
    expect(guard.consume("c")).toBe(false);
    expect(guard.consume("a")).toBe(true);
    now = 60_000;
    expect(guard.consume("c")).toBe(true);
  });

  it("reserves before await, ignores case variants and separates sessions/types/events", () => {
    const guard = new AnalyticsIngestionGuard(() => 0);
    expect(guard.reserve("ABC", "DEF", "view").kind).toBe("reserved");
    expect(guard.reserve("abc", "def", "view").kind).toBe("duplicate");
    expect(guard.reserve("abc", "other", "view").kind).toBe("reserved");
    expect(guard.reserve("other", "def", "view").kind).toBe("reserved");
    expect(guard.reserve("abc", "def", "save_click").kind).toBe("reserved");
  });

  it("caps receipts, expires them and prevents an old release deleting a new lease", () => {
    let now = 0;
    const guard = new AnalyticsIngestionGuard(() => now, 1);
    const old = guard.reserve("e", "s", "view");
    expect(guard.reserve("e", "other", "view").kind).toBe("full");
    if (old.kind !== "reserved") throw new Error("Missing lease");
    old.settle();
    now = 30_000;
    const current = guard.reserve("e", "s", "view");
    if (old.kind !== "reserved" || current.kind !== "reserved") throw new Error("Missing lease");
    old.release();
    expect(guard.reserve("e", "s", "view").kind).toBe("duplicate");
    current.release();
    expect(guard.reserve("e", "s", "view").kind).toBe("reserved");
  });

  it("keeps an in-flight lease past the dedup interval and starts expiry after settling", () => {
    let now = 0;
    const guard = new AnalyticsIngestionGuard(() => now);
    const pending = guard.reserve("e", "s", "view");
    now = 60_000;
    expect(guard.reserve("e", "s", "view").kind).toBe("duplicate");
    if (pending.kind !== "reserved") throw new Error("Missing lease");
    pending.settle();
    now += 29_999;
    expect(guard.reserve("e", "s", "view").kind).toBe("duplicate");
    now += 1;
    expect(guard.reserve("e", "s", "view").kind).toBe("reserved");
  });

  it("ignores untrusted forwarding and retains no raw IP in the client key", () => {
    const request = new Request("https://example.test", { headers: { "x-vercel-forwarded-for": "192.0.2.1", "x-forwarded-for": "192.0.2.2" } });
    vi.stubEnv("VERCEL", "0");
    expect(analyticsClientKey(request)).toBe("unidentified");
    vi.stubEnv("VERCEL", "1");
    const key = analyticsClientKey(request);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(analyticsClientKey(request)).toBe(key);
    expect(analyticsClientKey(new Request("https://example.test", { headers: { "x-vercel-forwarded-for": "spoofed, 192.0.2.1" } }))).toBe("unidentified");
  });
});
