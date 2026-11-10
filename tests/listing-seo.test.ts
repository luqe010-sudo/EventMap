import { describe, expect, it } from "vitest";
import { cityListingSeo, cityTimeListingSeo, weekendLabel } from "../lib/listing-seo";

// Tuesday 10 November 2026, 12:00 in Warsaw.
const tuesday = new Date("2026-11-10T11:00:00Z");

describe("listing SEO titles", () => {
  it("labels the upcoming weekend, including month boundaries", () => {
    expect(weekendLabel(tuesday)).toBe("14–15 listopada");
    expect(weekendLabel(new Date("2026-11-25T11:00:00Z"))).toBe("28–29 listopada");
    expect(weekendLabel(new Date("2027-01-27T11:00:00Z"))).toBe("30–31 stycznia");
    expect(weekendLabel(new Date("2026-10-28T11:00:00Z"))).toBe("31 października – 1 listopada");
  });

  it("builds a city title with the current month", () => {
    expect(cityListingSeo("Wrocław", tuesday).title).toBe("Imprezy we Wrocławiu – listopad 2026: koncerty i wydarzenia");
  });

  it("builds intent-style titles for today and the weekend", () => {
    expect(cityTimeListingSeo("Kraków", "weekend", tuesday).title).toBe("Co robić w Krakowie w weekend 14–15 listopada? | MapaImprez");
    expect(cityTimeListingSeo("Kraków", "dzis", tuesday).title).toBe("Imprezy w Krakowie dziś, 10 listopada – co robić? | MapaImprez");
    for (const slug of ["dzis", "weekend", "ten-tydzien"] as const) {
      expect(cityTimeListingSeo("Aleksandrów Łódzki", slug, tuesday).title.length).toBeLessThanOrEqual(70);
    }
  });
});
