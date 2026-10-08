import { describe, expect, it } from "vitest";
import { EventValidationError, validateEventForm } from "../lib/event-editor-validation";

function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Koncert", start_at: "2027-05-01T20:00", category_id: "category-a", ...overrides })) if (value !== undefined) data.set(key, value);
  return data;
}

function errors(overrides: Record<string, string | undefined>, organizer = "organizer-a") {
  try { validateEventForm(form(overrides), organizer); }
  catch (error) {
    expect(error).toBeInstanceOf(EventValidationError);
    return (error as EventValidationError).fieldErrors;
  }
  throw new Error("Expected validation failure");
}

describe("event editor validation before writes", () => {
  it("parses Warsaw time, optional fields, zero prices and uppercase currency", () => {
    expect(validateEventForm(form({ end_at: "2027-05-01T20:00", price_min: "0", price_max: "0", currency: "pln", location_latitude: "0", location_longitude: "0" }), "organizer-a"))
      .toMatchObject({ startAt: "2027-05-01T18:00:00.000Z", endAt: "2027-05-01T18:00:00.000Z", priceMin: 0, priceMax: 0, currency: "PLN", latitude: 0, longitude: 0 });
    expect(validateEventForm(form(), "organizer-a")).toMatchObject({ endAt: null, priceMin: null, priceMax: null, latitude: null, longitude: null });
  });
  it.each(["2027-02-30T12:00", "2027-13-01T12:00", "2027-05-01T25:00", "2027-03-28T02:30", "bad date", "2027-05-01T12:00:60", "2027-05-01T12:00Z"])("rejects invalid/nonexistent local date %s", value => {
    expect(errors({ start_at: value })).toHaveProperty("start_at");
    expect(errors({ end_at: value })).toHaveProperty("end_at");
  });
  it("accepts both winter time and the repeated fall hour", () => {
    expect(validateEventForm(form({ start_at: "2027-01-01T20:00" }), "organizer-a").startAt).toBe("2027-01-01T19:00:00.000Z");
    expect(validateEventForm(form({ start_at: "2027-10-31T02:30" }), "organizer-a").startAt).toMatch(/^2027-10-31T0[12]:30:00.000Z$/);
  });
  it("rejects end before start without inventing an end when omitted", () => {
    expect(errors({ end_at: "2027-05-01T19:59" })).toHaveProperty("end_at");
  });
  it.each(["-1", "NaN", "Infinity", "1e999", "abc", "0x20"])("rejects invalid or negative price %s", value => {
    expect(errors({ price_min: value, price_max: value })).toHaveProperty("price_min");
    expect(errors({ price_min: value, price_max: value })).toHaveProperty("price_max");
  });
  it("rejects inverted prices, positive free admission and unsupported types/currency", () => {
    expect(errors({ price_min: "30", price_max: "20" })).toHaveProperty("price_max");
    expect(errors({ price_type: "free", price_min: "1" })).toHaveProperty("price_type");
    expect(errors({ price_type: "fake", currency: "zł" })).toMatchObject({ price_type: expect.any(String), currency: expect.any(String) });
  });
  it.each([{ location_latitude: "91", location_longitude: "20" }, { location_latitude: "52", location_longitude: "-181" }, { location_latitude: "52" }, { location_longitude: "20" }, { location_latitude: "NaN" }])("rejects missing or out-of-range coordinates %o", overrides => {
    expect(Object.keys(errors(overrides)).some(key => key.startsWith("location_"))).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:image/png;base64,x", "file:///etc/a", "//example.com", "https://user:password@example.com", "not a URL"])("rejects unsafe image/source URL %s", value => {
    expect(errors({ main_image_url: value, source_url: value })).toMatchObject({ main_image_url: expect.any(String), source_url: expect.any(String) });
  });
  it("accepts absolute http(s) URLs including query parameters", () => {
    expect(() => validateEventForm(form({ main_image_url: "https://example.com/a.jpg?x=1", source_url: "http://example.com/tickets" }), "organizer-a")).not.toThrow();
  });
  it("collects required-field and text-length errors in one response", () => {
    expect(errors({ title: " ", start_at: "", category_id: "", description: "a".repeat(30001), source_name: "b".repeat(301), review_note: "c".repeat(4001), location_city: "d".repeat(201) }, ""))
      .toMatchObject({ title: expect.any(String), start_at: expect.any(String), category_id: expect.any(String), organizer_id: expect.any(String), description: expect.any(String), source_name: expect.any(String), review_note: expect.any(String), location_city: expect.any(String) });
  });
  it("rejects file type and size before upload", () => {
    const data = form();
    data.set("main_image_file", new File(["hello"], "text.txt", { type: "text/plain" }));
    expect(() => validateEventForm(data, "organizer-a")).toThrow(EventValidationError);
    data.set("main_image_file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
    expect(() => validateEventForm(data, "organizer-a")).toThrow(EventValidationError);
  });
});
