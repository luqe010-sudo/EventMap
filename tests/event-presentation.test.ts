import { expect, it } from "vitest";
import type { EventItem } from "../lib/events";
import { formatEventCardDate, formatEventCardLocation, formatEventCardPrice } from "../lib/event-presentation";

const price = { price_type: "paid", price_min: 117.9, price_max: 117.9, currency: "PLN", price: "117.9 PLN" };
const normalized = (value: string) => value.replace(/\s/g, " ");

it("formats a known price and range in Polish without losing the currency", () => {
  expect(normalized(formatEventCardPrice(price))).toBe("117,9 zł");
  expect(normalized(formatEventCardPrice({ ...price, price_min: 100, price_max: 117.9 }))).toBe("100–117,9 zł");
  expect(normalized(formatEventCardPrice({ ...price, currency: "EUR" }))).toBe("117,9 €");
});

it("labels a price limit without implying an exact price", () => {
  expect(normalized(formatEventCardPrice({ ...price, price_max: null }))).toBe("od 117,9 zł");
  expect(normalized(formatEventCardPrice({ ...price, price_min: null }))).toBe("do 117,9 zł");
});

it("keeps the source label when the currency or price is unknown or contradictory", () => {
  expect(formatEventCardPrice({ ...price, currency: null })).toBe(price.price);
  expect(formatEventCardPrice({ ...price, price_min: null, price_max: null, price: "Cena wkrótce" })).toBe("Cena wkrótce");
  expect(formatEventCardPrice({ ...price, price_type: "unknown", price: "Cena nieznana" })).toBe("Cena nieznana");
  expect(formatEventCardPrice({ ...price, price_min: 200, price_max: 100 })).toBe(price.price);
});

it("uses the explicit free label even if old price fields remain populated", () => {
  expect(formatEventCardPrice({ ...price, price_type: "free" })).toBe("Bezpłatne");
});

it("uses the Warsaw time and a shared date label in both card types", () => {
  expect(formatEventCardDate({ startDate: "2026-10-05T20:30:00Z", is_all_day: false })).toMatch(/5 paź.*22:30/);
});

it("does not display a guessed midnight time for an all-day event", () => {
  expect(formatEventCardDate({ startDate: "2026-10-05T00:00:00Z", is_all_day: true })).toMatch(/5 paź.*Cały dzień$/);
});

it("shows city and the real venue name, falling back to the known address", () => {
  const location = { city: "Warszawa", address: "Złota 10, Warszawa", location: { name: "Sala koncertowa" } as EventItem["location"] };
  expect(formatEventCardLocation(location)).toBe("Warszawa · Sala koncertowa");
  expect(formatEventCardLocation({ ...location, location: null })).toBe("Warszawa · Złota 10");
  expect(formatEventCardLocation({ ...location, address: "warszawa", location: null })).toBe("Warszawa");
});
