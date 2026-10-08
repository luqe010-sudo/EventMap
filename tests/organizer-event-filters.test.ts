import { describe, expect, it } from "vitest";
import { organizerEventDateBounds } from "../lib/organizer-event-filters";

describe("organizer event calendar filters", () => {
  it.each([
    ["2026-01-08", "2026-01-07T23:00:00.000Z", "2026-01-08T23:00:00.000Z", 24],
    ["2026-10-08", "2026-10-07T22:00:00.000Z", "2026-10-08T22:00:00.000Z", 24],
    ["2026-03-29", "2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z", 23],
    ["2026-10-25", "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z", 25]
  ])("includes only the Warsaw calendar day %s", (day, from, until, hours) => {
    const bounds = organizerEventDateBounds({ dateFrom: day, dateTo: day });
    expect(bounds).toEqual({ from, until });
    expect((Date.parse(bounds.until!) - Date.parse(bounds.from!)) / 3_600_000).toBe(hours);
  });

  it("keeps independent open boundaries", () => {
    expect(organizerEventDateBounds({ dateFrom: "2026-10-08" })).toEqual({
      from: "2026-10-07T22:00:00.000Z", until: null
    });
    expect(organizerEventDateBounds({ dateTo: "2026-10-08" })).toEqual({
      from: null, until: "2026-10-08T22:00:00.000Z"
    });
    expect(organizerEventDateBounds({})).toEqual({ from: null, until: null });
  });

  it("uses the following calendar day across a month/year boundary", () => {
    expect(organizerEventDateBounds({ dateTo: "2026-12-31" })).toEqual({
      from: null, until: "2026-12-31T23:00:00.000Z"
    });
  });

  it.each(["invalid", "2026-02-30", "2026-13-01", "2026-10-08T14:00", ""])(
    "ignores invalid optional date input %s instead of normalizing to a different day", value => {
      expect(organizerEventDateBounds({ dateFrom: value, dateTo: value })).toEqual({ from: null, until: null });
    }
  );
});
