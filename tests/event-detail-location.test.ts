import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/components/EventDetailMap", () => ({ default: vi.fn(() => null) }));
vi.mock("@/lib/user-account-actions", () => ({ toggleSavedEventAction: vi.fn() }));

import EventDetailView from "../components/EventDetailView";
import EventDetailMap from "../components/EventDetailMap";
import type { EventItem } from "../lib/events";
import { createElement } from "react";

const event: EventItem = {
  id: "event-one", title: "Koncert bez punktu", slug: "koncert-bez-punktu", description: "Opis", short_description: null,
  start_at: "2027-05-01T18:00:00Z", end_at: null, is_all_day: false, main_image_url: null,
  price_type: "unknown", price_min: null, price_max: null, currency: "PLN", status: "published", visibility: "public",
  is_featured: false, is_verified: false, is_cancelled: false, updated_at: null, location: null, sources: [],
  imageUrl: "https://example.invalid/event.jpg", startDate: "2027-05-01T18:00:00Z", address: "Sala, Warszawa",
  city: "Warszawa", citySlug: "warszawa", latitude: null, longitude: null, categoryName: "Koncerty",
  categorySlug: "koncerty", categoryRelation: null, category: "Koncerty", categoryColor: "#123456",
  organizerName: "Organizator", organizer: "Organizator", organizerRelation: null, organizerUrl: "", price: "Cena nieznana",
  tags: [], sourceType: "supabase", isFeatured: false
};
const organizer = { name: "Organizator", slug: "organizator", website: null, facebook_url: null, phone: null, email: null, logo_url: null, type: "company", is_verified: true };

beforeEach(() => { vi.clearAllMocks(); });

it.each([
  { latitude: null, longitude: null }, { latitude: Number.NaN, longitude: 21 },
  { latitude: 91, longitude: 21 }, { latitude: 52, longitude: 181 }
])("does not render a guessed map point for missing or invalid coordinates %j", (coordinates) => {
  const html = renderToStaticMarkup(createElement(EventDetailView, { event: { ...event, ...coordinates } }));
  expect(EventDetailMap).not.toHaveBeenCalled();
  expect(html).toContain("Punkt na mapie nie jest dostępny.");
  expect(html).toContain("query=Sala%2C%20Warszawa");
  expect(html).toContain("Wyszukaj miejsce w Google Maps");
  expect(html).not.toContain('"GeoCoordinates"');
});

it("renders the event's real point and matching directions when coordinates are valid", () => {
  const html = renderToStaticMarkup(createElement(EventDetailView, { event: { ...event, latitude: 52.23, longitude: 21.01 } }));
  expect(EventDetailMap).toHaveBeenCalledWith(expect.objectContaining({ location: expect.objectContaining({ latitude: 52.23, longitude: 21.01 }) }), undefined);
  expect(html).toContain("query=52.23,21.01");
  expect(html).toContain('"GeoCoordinates"');
  expect(html).not.toContain("Punkt na mapie nie jest dostępny.");
});

it("keeps an explicit directions source even when the event has no coordinates", () => {
  const html = renderToStaticMarkup(createElement(EventDetailView, { event: { ...event, location: { google_maps_url: "https://maps.google.com/place/known-address" } as EventItem["location"] } }));
  expect(EventDetailMap).not.toHaveBeenCalled();
  expect(html).toContain('href="https://maps.google.com/place/known-address"');
});

it.each(["", "Polska", "Brak adresu", "Lokalizacja nieznana"])("does not offer directions to a placeholder %s", (address) => {
  const html = renderToStaticMarkup(createElement(EventDetailView, { event: { ...event, address, city: "Polska" } }));
  expect(EventDetailMap).not.toHaveBeenCalled();
  expect(html).not.toContain("maps/search/?api=1");
});

it("uses organizer verification independently of event verification", () => {
  const verifiedEvent = renderToStaticMarkup(createElement(EventDetailView, { event: { ...event, is_verified: true, organizerRelation: { ...organizer, is_verified: false } } }));
  expect(verifiedEvent).not.toContain("✓ Zweryfikowany organizator");
  const verifiedOrganizer = renderToStaticMarkup(createElement(EventDetailView, { event: { ...event, is_verified: false, organizerRelation: organizer } }));
  expect(verifiedOrganizer).toContain("✓ Zweryfikowany organizator");
  expect(verifiedOrganizer).toContain("Oznaczenie dotyczy profilu organizatora");
});
