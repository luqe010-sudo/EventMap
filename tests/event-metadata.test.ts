import { describe, expect, it } from "vitest";
import { buildEventSeoDescription, buildEventSeoTitle, cleanEventTitle } from "../lib/event-metadata";

const base = {
  title: "ATB | FINAL CHAPTER | POLAND TOUR",
  city: "Gdynia",
  startDate: "2026-11-07T19:00:00.000Z",
  is_all_day: false,
  address: "Klub SVERA, ul. Kontenerowa 1, Gdynia",
  location: { name: "Klub SVERA" } as never,
  short_description: "ATB, ikona muzyki elektronicznej, wystąpi w Gdyni w ramach pożegnalnej trasy.",
  description: null,
  price_type: "paid",
  price_min: 89,
  price_max: null,
  currency: "PLN",
  price: "89 PLN",
};

describe("event SEO metadata", () => {
  it("cleans shouting pipe-separated titles but keeps short acronyms", () => {
    expect(cleanEventTitle("ATB | FINAL CHAPTER | POLAND TOUR")).toBe("ATB – Final Chapter Poland Tour");
    expect(cleanEventTitle("KSU — koncert w Klubie Akcent")).toBe("KSU — koncert w Klubie Akcent");
  });

  it("adds the city in locative form and the local date", () => {
    expect(buildEventSeoTitle(base)).toBe("ATB – Final Chapter Poland Tour w Gdyni – 7.11.2026 | MapaImprez");
  });

  it("does not repeat a city already named in the title and keeps the brand when it fits", () => {
    expect(buildEventSeoTitle({ ...base, title: "Bracia Figo Fagot Wrocław", city: "Wrocław" })).toBe("Bracia Figo Fagot Wrocław – 7.11.2026 | MapaImprez");
    expect(buildEventSeoTitle({ ...base, title: "Potańcówka w Gdyni" })).toBe("Potańcówka w Gdyni – 7.11.2026 | MapaImprez");
  });

  it("truncates very long titles at a word boundary", () => {
    const title = buildEventSeoTitle({ ...base, title: "Bardzo długi tytuł wydarzenia który zdecydowanie przekracza rozsądną długość dla wyników wyszukiwania" });
    expect(title).toMatch(/…/);
    expect(title.length).toBeLessThanOrEqual(80);
  });

  it("puts date, time, venue and ticket price first in the description", () => {
    const description = buildEventSeoDescription(base);
    expect(description.replace(/\s/g, " ").startsWith("Sobota, 7 listopada 2026, godz. 20:00 · Klub SVERA, Gdynia · bilety od 89 zł. ATB")).toBe(true);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("labels free events and skips unknown prices", () => {
    expect(buildEventSeoDescription({ ...base, price_type: "free", price: "Bezpłatne" })).toContain("wstęp bezpłatny");
    const unknown = buildEventSeoDescription({ ...base, price_type: "unknown", price: "Cena nieznana", short_description: null });
    expect(unknown).not.toMatch(/bilety|nieznana/);
    expect(unknown).toContain("Sprawdź szczegóły");
  });
});
