import { describe, expect, it } from "vitest";
import { upsertCandidate } from "../src/agents/ingest.ts";
import { writeDescriptions } from "../src/content.ts";
import { openDb } from "../src/db.ts";
import { mergeDailySeries } from "../src/extract/series.ts";
import type { EventFacts } from "../src/facts.ts";
import { assessQuality, classifyCategory, fallbackCategory } from "../src/quality.ts";
import { getSource, registerSource } from "../src/sources.ts";

const base: EventFacts = {
  externalId: "1", title: "Wystawa „Szopki krakowskie”", startAt: "2026-12-07T09:00:00.000Z", endAt: null, isAllDay: false,
  venueName: "Resursa", address: "ul. Malczewskiego 7", city: "Radom", postalCode: null, latitude: 51.4, longitude: 21.15,
  priceType: "unknown", priceMin: null, priceMax: null, currency: "PLN", url: "https://resursa.example.pl/w", status: "scheduled",
  organizerName: null, keywords: [], method: "json_api"
};
const at = (day: number, id = String(day)) => ({ ...base, externalId: `tribe:${id}`, startAt: new Date(Date.UTC(2026, 11, day, 9)).toISOString() });
const slugs = new Set(["koncerty", "kultura", "imprezy", "sport", "targi", "rodzinne", "inne"]);
const now = new Date("2026-11-26T12:00:00Z");

describe("daily series", () => {
  it("merges daily repeats of one exhibition into a single event with an end date", () => {
    const merged = mergeDailySeries([at(7), at(8), at(9), at(11), at(12)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].startAt).toBe("2026-12-07T09:00:00.000Z");
    expect(merged[0].endAt).toBe("2026-12-12T09:00:00.000Z");
    expect(merged[0].externalId).toMatch(/^series:/);
  });

  it("keeps weekly repeats and pairs separate", () => {
    expect(mergeDailySeries([at(6), at(13), at(20), at(27)])).toHaveLength(4);
    expect(mergeDailySeries([at(7), at(8)])).toHaveLength(2);
    expect(mergeDailySeries([at(7), { ...at(8), title: "Inny koncert" }, at(9)])).toHaveLength(3);
  });

  it("never extends a joined series beyond 120 days from its start", async () => {
    const { unionSeries } = await import("../src/extract/series.ts");
    const joined = unionSeries({ ...at(7), endAt: "2027-02-01T09:00:00.000Z" }, { ...at(8), endAt: "2028-11-26T09:00:00.000Z" }, now);
    expect(joined.endAt).toBe("2027-02-01T09:00:00.000Z");
  });

  it("joins parts of one series seen on different API pages and ignores geo enrichment", () => {
    const db = openDb(":memory:");
    const source = getSource(db, registerSource(db, { url: "https://resursa.example.pl", discoveredVia: "test" })!.id)!;
    const first = mergeDailySeries([at(7), at(8), at(9)])[0];
    const second = mergeDailySeries([at(10), at(11), at(12)])[0];
    const created = upsertCandidate(db, source, first, null, now);
    const joined = upsertCandidate(db, source, second, null, now);
    expect(joined).toMatchObject({ id: created.id, changed: true });
    const facts = JSON.parse((db.prepare("SELECT facts FROM candidates WHERE id = ?").get(created.id) as { facts: string }).facts) as EventFacts;
    expect([facts.startAt, facts.endAt]).toEqual(["2026-12-07T09:00:00.000Z", "2026-12-12T09:00:00.000Z"]);
    // Geo later rewrites facts (coordinates); the same source observation must not count as a change.
    db.prepare("UPDATE candidates SET facts = ? WHERE id = ?").run(JSON.stringify({ ...facts, latitude: 51.41 }), created.id);
    const plain = upsertCandidate(db, source, at(20, "x"), null, now);
    expect(upsertCandidate(db, source, at(20, "x"), null, now)).toMatchObject({ id: plain.id, changed: false });
    db.prepare("UPDATE candidates SET facts = ? WHERE id = ?").run(JSON.stringify({ ...at(20, "x"), latitude: 51.5 }), plain.id);
    expect(upsertCandidate(db, source, at(20, "x"), null, now).changed).toBe(false);
  });
});

describe("categories", () => {
  it("recognises the titles that ended up in 'inne' during the live run", () => {
    const category = (title: string, keywords: string[] = []) => classifyCategory({ ...base, title, keywords }, slugs);
    expect(category("The Italian Tenors – pierwszy raz w Polsce!")).toBe("koncerty");
    expect(category("„Goniąc kormorany” – największe polskie przeboje")).toBe("koncerty");
    expect(category("Konkurs Kolęd i Pastorałek")).toBe("koncerty");
    expect(category("Gala Andrzejkowa na GŁÓWNYM")).toBe("imprezy");
    expect(category("Parkrun")).toBe("sport");
    expect(category("Dolnośląski Targ Rolny")).toBe("targi");
    expect(category("Retrospotkanie 83 – W Resursie jak w domu")).toBe("kultura");
    expect(category("Czarno to widzę - komedia improwizowana")).toBe("kultura");
    expect(category("Afrykańska przygoda | 1-3 lata")).toBe("rodzinne");
    expect(category("Jedna noc w Wiedniu z Orchestre de la Cour")).toBe("koncerty");
    expect(category("MOCferencja 2026 – jak budować markę w czasach AI")).toBe("inne");
  });

  it("uses a source default only for programme events, never for galas or conferences", () => {
    expect(fallbackCategory({ ...base, title: "IRA" }, "koncerty", "Klub Stodoła", slugs)).toBe("koncerty");
    expect(fallbackCategory({ ...base, title: "Gala Wolontariusza Roku" }, "koncerty", "Teatr", slugs)).toBeNull();
    expect(fallbackCategory({ ...base, title: "Kudo | Chrenowicz" }, null, "Filharmonia Koszalińska", slugs)).toBe("koncerty");
    expect(fallbackCategory({ ...base, title: "Spotkanie" }, null, "Urząd Miasta", slugs)).toBeNull();
    const scored = assessQuality(base, { cityId: "c", categorySlug: "koncerty", categoryFromFallback: true, now });
    expect(scored.score).toBe(0.9);
  });
});

describe("quality guards", () => {
  const blocking = (facts: Partial<EventFacts>) => assessQuality({ ...base, ...facts }, { cityId: "c", categorySlug: "kultura", now }).issues.filter(issue => issue.blocking).map(issue => issue.code);
  it("blocks closed events, announcements and venues abroad", () => {
    expect(blocking({ title: "La Rive – uroczystość zamknięta" })).toContain("not_public");
    expect(blocking({ title: "Bankiet", keywords: ["Impreza zamknięta"] })).toContain("not_public");
    // Teatr Grudziądz tags external organisers' public concerts as "Wynajem".
    expect(blocking({ title: "Zenek Grabowski", keywords: ["Koncert", "Wynajem"] })).not.toContain("not_public");
    expect(blocking({ title: "Specjalne ceny biletów dla seniorów do NFM" })).toContain("not_event");
    expect(blocking({ title: "Śląski Jarmark Bożonarodzeniowy", venueName: "Görlitz (DE)" })).toContain("foreign_venue");
    expect(blocking({ title: "Koncert", city: "Český Těšín", venueName: "Dom Kultury", address: "Czechy" })).toContain("foreign_venue");
    expect(blocking({})).toEqual([]);
  });
});

describe("descriptions", () => {
  it("never prints 00:00 and phrases multi-day events as 'potrwa do'", () => {
    const midnight = writeDescriptions({ ...base, title: "Andrzej Piaseczny", startAt: "2026-12-14T23:00:00.000Z" }, "koncerty", "Bielsko-Biała");
    expect(midnight.short).not.toContain("00:00");
    expect(midnight.long).toContain("odbędzie się we wtorek, 15 grudnia 2026 r.");
    const series = writeDescriptions({ ...base, endAt: "2027-01-15T09:00:00.000Z" }, "kultura", "Radom");
    expect(series.long).toContain("Potrwa do 15 stycznia 2027 r.");
    const evening = writeDescriptions({ ...base, startAt: "2026-12-12T17:00:00.000Z", endAt: "2026-12-12T21:00:00.000Z" }, "koncerty", "Radom");
    expect(evening.long).toContain("Zakończenie: godz. 22:00.");
  });
});

describe("title quoting", () => {
  it("does not double the quotation marks of titles that already have them", () => {
    const text = writeDescriptions({ ...base, title: "Wystawa „Szopki krakowskie”" }, "kultura", "Radom");
    expect(text.long).toContain("Wydarzenie kulturalne Wystawa „Szopki krakowskie” odbędzie się");
    expect(writeDescriptions({ ...base, title: "IRA" }, "koncerty", "Warszawa").long).toContain("Koncert „IRA” odbędzie się");
  });
});
