import { describe, expect, it, vi } from "vitest";
import { resolveDateRange, normalizeDateInput } from "../lib/date-range";
import { serializeJsonLd } from "../lib/json-ld";
import { generateSeoText } from "../lib/seo-texts";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/event-editor", () => ({ createSlug: vi.fn() }));
vi.mock("@/lib/oauth-profile", () => ({ ensureGoogleOAuthAccount: vi.fn() }));

import { signUpAction } from "../lib/auth-actions";
import { createSupabaseUserClient } from "../lib/supabase-user";

describe("registration authorization", () => {
  it.each(["admin", "moderator", "OWNER", "", null])("rejects role %s before calling Supabase", async (role) => {
    vi.clearAllMocks();
    const form = new FormData();
    for (const [key, value] of Object.entries({ email: "test@example.invalid", password: "password123", confirmPassword: "password123", displayName: "Test", termsAccepted: "on", privacyNoticeAccepted: "on" })) form.set(key, value);
    if (role !== null) form.set("role", role);
    const result = await signUpAction(form);
    expect(result.success).toBe(false);
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });
  it.each(["user", "organizer"])("passes the allowed role %s to Auth", async (role) => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { message: "Test rejection" } });
    vi.mocked(createSupabaseUserClient).mockResolvedValue({ auth: { signUp } } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
    const form = new FormData();
    for (const [key, value] of Object.entries({ email: "test@example.invalid", password: "password123", confirmPassword: "password123", displayName: "Test", role, organizerName: "Test", termsAccepted: "on", privacyNoticeAccepted: "on" })) form.set(key, value);
    await signUpAction(form);
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: expect.objectContaining({ role }) }) }));
  });
});

describe("Polish calendar boundaries", () => {
  it("uses the Polish day even when UTC is still the previous day", () => {
    const range = resolveDateRange("today", "", new Date("2026-07-01T22:30:00Z"));
    expect(range.start.toISOString()).toBe("2026-07-01T22:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-07-02T22:00:00.000Z");
  });
  it.each([
    ["2026-03-29", "2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z"],
    ["2026-10-25", "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z"]
  ])("handles the clock change on %s", (day, start, end) => {
    const range = resolveDateRange("custom", day);
    expect(range.start.toISOString()).toBe(start);
    expect(range.end?.toISOString()).toBe(end);
  });
  it("includes both days of a reversed custom range", () => {
    const range = resolveDateRange("custom", "2026-10-12/2026-10-10");
    expect(range.start.toISOString()).toBe("2026-10-09T22:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-10-12T22:00:00.000Z");
  });
  it("keeps Sunday's weekend within Sunday", () => {
    const range = resolveDateRange("weekend", "", new Date("2026-10-11T10:00:00Z"));
    expect(range.start.toISOString()).toBe("2026-10-10T22:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-10-11T22:00:00.000Z");
  });
  it.each(["2026-02-30", "2026-13-01", "invalid"])("rejects impossible date %s", (value) => {
    expect(normalizeDateInput(value)).toBeNull();
  });
});

it("preserves JSON data while preventing a script breakout", () => {
  const value = { name: "</script><script>alert(1)</script>", description: "&\u2028\u2029" };
  const serialized = serializeJsonLd(value);
  expect(serialized).not.toMatch(/[<>&\u2028\u2029]/);
  expect(JSON.parse(serialized)).toEqual(value);
});

it("escapes untrusted location and category labels in SEO markup", () => {
  const html = generateSeoText('<script>alert(1)</script>', '<img src=x onerror=alert(1)>');
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;");
});
