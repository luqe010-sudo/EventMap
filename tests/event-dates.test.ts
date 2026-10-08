import { expect, it } from "vitest";
import { eventOverlapsWindow, publicDateLowerBoundExpression } from "../lib/event-dates";

const now = new Date("2026-10-05T12:00:00Z");
const tomorrow = new Date("2026-10-05T22:00:00Z");

it("retains an ongoing multi-day event", () => {
  expect(eventOverlapsWindow("2026-10-03T12:00:00Z", "2026-10-06T12:00:00Z", now, tomorrow)).toBe(true);
});
it("excludes a finished event at the exact end boundary", () => {
  expect(eventOverlapsWindow("2026-10-05T10:00:00Z", now.toISOString(), now, tomorrow)).toBe(false);
});
it("does not infer duration when the end is unknown", () => {
  expect(eventOverlapsWindow("2026-10-05T10:00:00Z", null, now, tomorrow)).toBe(false);
});
it("includes an upcoming event with no end", () => {
  expect(eventOverlapsWindow("2026-10-05T14:00:00Z", null, now, tomorrow)).toBe(true);
});
it("keeps the upper date boundary exclusive", () => {
  expect(eventOverlapsWindow(tomorrow.toISOString(), null, now, tomorrow)).toBe(false);
});
it("builds the server overlap filter from a validated ISO timestamp", () => {
  expect(publicDateLowerBoundExpression("2026-10-05T14:00:00+02:00")).toBe("start_at.gte.2026-10-05T12:00:00.000Z,end_at.gt.2026-10-05T12:00:00.000Z");
  expect(() => publicDateLowerBoundExpression("bad,visibility.eq.private")).toThrow();
});
