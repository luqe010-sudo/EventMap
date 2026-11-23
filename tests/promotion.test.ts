import { describe, expect, it } from "vitest";
import { buildPromotionOrderMailto, defaultFeaturedUntil, endOfAppDayIso, getPromotionState, isPromotionActive, resolveFeaturedFields } from "../lib/promotion";

const now = new Date("2026-11-23T12:00:00Z");
const base = {
  status: "published",
  visibility: "public",
  is_cancelled: false,
  is_featured: false,
  start_at: "2026-12-06T16:00:00Z",
  end_at: null
};

describe("getPromotionState", () => {
  it("offers promotion for upcoming public events", () => {
    expect(getPromotionState(base, now)).toBe("available");
    expect(getPromotionState({ ...base, status: "pending_review" }, now)).toBe("available");
  });

  it("reports events with an active promotion window", () => {
    expect(getPromotionState({ ...base, is_featured: true, featured_until: "2026-12-06T22:59:59Z" }, now)).toBe("featured");
  });

  it("treats expired or undated promotions as not featured", () => {
    expect(getPromotionState({ ...base, is_featured: true, featured_until: "2026-11-20T22:59:59Z" }, now)).toBe("available");
    expect(getPromotionState({ ...base, is_featured: true, featured_until: null }, now)).toBe("available");
  });

  it("blocks cancelled, private, draft, rejected and finished events", () => {
    expect(getPromotionState({ ...base, is_cancelled: true }, now)).toBe("unavailable");
    expect(getPromotionState({ ...base, visibility: "private" }, now)).toBe("unavailable");
    expect(getPromotionState({ ...base, status: "draft" }, now)).toBe("unavailable");
    expect(getPromotionState({ ...base, status: "rejected" }, now)).toBe("unavailable");
    expect(getPromotionState({ ...base, start_at: "2026-11-01T10:00:00Z" }, now)).toBe("unavailable");
  });

  it("uses end date for multi-day events that already started", () => {
    expect(getPromotionState({ ...base, start_at: "2026-11-20T10:00:00Z", end_at: "2026-12-24T18:00:00Z" }, now)).toBe("available");
  });
});

describe("buildPromotionOrderMailto", () => {
  it("prefills subject, price and event data", () => {
    const href = buildPromotionOrderMailto(
      { id: "evt-1", title: "Jarmark & koncert", start_at: "2026-12-06T16:00:00Z" },
      { organizerName: "Dom Kultury", publicUrl: "https://mapaimprez.pl/koncerty/wroclaw/jarmark" }
    );
    expect(href.startsWith("mailto:kontakt@mapaimprez.pl?subject=")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Zamówienie polecenia wydarzenia – Jarmark & koncert");
    const body = params.get("body") ?? "";
    expect(body).toContain("39 zł brutto");
    expect(body).toContain("ID wydarzenia: evt-1");
    expect(body).toContain("Organizator: Dom Kultury");
    expect(body).toContain("Link: https://mapaimprez.pl/koncerty/wroclaw/jarmark");
  });
});

describe("promotion window", () => {
  it("is active only while is_featured and featured_until is in the future", () => {
    expect(isPromotionActive({ is_featured: true, featured_until: "2026-11-23T12:00:01Z" }, now)).toBe(true);
    expect(isPromotionActive({ is_featured: true, featured_until: "2026-11-23T12:00:00Z" }, now)).toBe(false);
    expect(isPromotionActive({ is_featured: false, featured_until: "2026-12-30T00:00:00Z" }, now)).toBe(false);
    expect(isPromotionActive({ is_featured: true, featured_until: null }, now)).toBe(false);
  });

  it("computes the end of a Polish day across DST", () => {
    expect(endOfAppDayIso("2026-12-06")).toBe("2026-12-06T22:59:59.000Z");
    expect(endOfAppDayIso("2026-07-01")).toBe("2026-07-01T21:59:59.000Z");
  });

  it("defaults to the end of the event day, capped at 30 days", () => {
    expect(defaultFeaturedUntil({ start_at: "2026-12-06T16:00:00Z", end_at: null }, now)).toBe("2026-12-06T22:59:59.000Z");
    expect(defaultFeaturedUntil({ start_at: "2026-11-28T10:00:00Z", end_at: "2026-12-02T20:00:00Z" }, now)).toBe("2026-12-02T22:59:59.000Z");
    expect(defaultFeaturedUntil({ start_at: "2027-03-01T10:00:00Z", end_at: null }, now)).toBe("2026-12-23T12:00:00.000Z");
    expect(defaultFeaturedUntil({ start_at: "", end_at: null }, now)).toBe("2026-12-23T12:00:00.000Z");
  });

  it("resolves admin form values", () => {
    const event = { start_at: "2026-12-06T16:00:00Z", end_at: null };
    expect(resolveFeaturedFields({ isFeatured: false, untilDate: "2026-12-01" }, event, now)).toEqual({ is_featured: false, featured_until: null });
    expect(resolveFeaturedFields({ isFeatured: true, untilDate: null }, event, now)).toEqual({ is_featured: true, featured_until: "2026-12-06T22:59:59.000Z" });
    expect(resolveFeaturedFields({ isFeatured: true, untilDate: "2026-12-01" }, event, now)).toEqual({ is_featured: true, featured_until: "2026-12-01T22:59:59.000Z" });
    expect(resolveFeaturedFields({ isFeatured: true, untilDate: "bad" }, event, now)).toEqual({ is_featured: true, featured_until: "2026-12-06T22:59:59.000Z" });
  });
});
