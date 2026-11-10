import { describe, expect, it } from "vitest";
import { getSeason, groupEventsByCity, isSeasonIndexable, resolveSeasonEdition, type SeasonSlug } from "../lib/seasons";

function season(slug: SeasonSlug) {
  const value = getSeason(slug);
  if (!value) throw new Error(slug);
  return value;
}

const event = (title: string, startDate = "2026-12-05T10:00:00.000Z", extra: { short_description?: string; categorySlug?: string } = {}) => ({ title, startDate, ...extra });

describe("season editions", () => {
  it("uses the running edition and switches to next year once the window ends", () => {
    const jarmarki = season("jarmarki-bozonarodzeniowe");
    expect(resolveSeasonEdition(jarmarki, new Date("2026-11-10T12:00:00Z")).year).toBe(2026);
    expect(resolveSeasonEdition(jarmarki, new Date("2027-01-05T12:00:00Z")).year).toBe(2026);
    expect(resolveSeasonEdition(jarmarki, new Date("2027-01-09T12:00:00Z")).year).toBe(2027);
    const mikolajki = season("mikolajki");
    expect(resolveSeasonEdition(mikolajki, new Date("2026-12-20T12:00:00Z")).year).toBe(2027);
  });

  it("builds window bounds in Polish local time", () => {
    const edition = resolveSeasonEdition(season("sylwester"), new Date("2026-11-10T12:00:00Z"));
    expect(edition.start.toISOString()).toBe("2026-12-25T23:00:00.000Z");
    expect(edition.end.toISOString()).toBe("2027-01-15T23:00:00.000Z");
  });
});

describe("season matching", () => {
  it("keeps Christmas markets and skips ordinary flea markets", () => {
    const { matches } = season("jarmarki-bozonarodzeniowe");
    expect(matches(event("Jarmark Bożonarodzeniowy we Wrocławiu 2026"))).toBe(true);
    expect(matches(event("Jarmark Świąteczny na Targach w Poznaniu 2026"))).toBe(true);
    expect(matches(event("Wolny Jarmark Toruński i Pchli Targ — 6 grudnia"))).toBe(false);
    expect(matches(event("SztukaTERRiA — Jarmark Wyrobów Artystycznych", undefined, { short_description: "Prezenty świąteczne od lokalnych twórców" }))).toBe(true);
  });

  it("matches Christmas concerts but not markets or unrelated galas", () => {
    const { matches } = season("koncerty-swiateczne");
    expect(matches(event("Magic Christmas Concert", undefined, { categorySlug: "koncerty" }))).toBe(true);
    expect(matches(event("Melodie pod choinkę – Halina Mlynkova", undefined, { categorySlug: "koncerty" }))).toBe(true);
    expect(matches(event("Orkiestra Księżniczek — Koncert Wiedeński", undefined, { categorySlug: "koncerty" }))).toBe(false);
    expect(matches(event("Jarmark Bożonarodzeniowy w Gdańsku", undefined, { categorySlug: "koncerty" }))).toBe(false);
  });

  it("matches New Year's Eve by keyword or by an evening start on 31 December", () => {
    const { matches } = season("sylwester");
    expect(matches(event("Koncert sylwestrowy Filharmonii Poznańskiej 2026", "2026-12-31T18:00:00.000Z"))).toBe(true);
    expect(matches(event("Noworoczna Gala — Koncert Wiedeński", "2027-01-03T14:00:00.000Z"))).toBe(true);
    expect(matches(event("Wielka impreza w klubie", "2026-12-31T20:00:00.000Z"))).toBe(true);
    expect(matches(event("Poranek w muzeum", "2026-12-31T09:00:00.000Z"))).toBe(false);
  });

  it("matches Mikołajki events by title", () => {
    const { matches } = season("mikolajki");
    expect(matches(event("XIII Bieg Mikołajkowy w Katowicach 2026"))).toBe(true);
    expect(matches(event("Planszówki w WDK"))).toBe(false);
  });
});

describe("season page helpers", () => {
  it("groups by city with the busiest, then the largest city first", () => {
    const groups = groupEventsByCity([
      { id: 1, city: "Toruń", citySlug: "torun" },
      { id: 2, city: "Katowice", citySlug: "katowice" },
      { id: 3, city: "Toruń", citySlug: "torun" },
      { id: 4, city: "Gdynia", citySlug: "gdynia" },
    ]);
    expect(groups.map((group) => [group.citySlug, group.events.map((item) => item.id)])).toEqual([
      ["torun", [1, 3]], ["katowice", [2]], ["gdynia", [4]],
    ]);
    const ties = groupEventsByCity([
      { city: "Elbląg", citySlug: "elblag" }, { city: "Wrocław", citySlug: "wroclaw" }, { city: "Warszawa", citySlug: "warszawa" },
    ]);
    expect(ties.map((group) => group.citySlug)).toEqual(["warszawa", "wroclaw", "elblag"]);
  });

  it("indexes only pages with at least three events", () => {
    expect(isSeasonIndexable(2)).toBe(false);
    expect(isSeasonIndexable(3)).toBe(true);
  });
});
