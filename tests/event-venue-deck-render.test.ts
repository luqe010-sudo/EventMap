import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/components/EventCardSaveButton", () => ({
  default: vi.fn(({ eventId }: { eventId: string }) => createElement("button", { "data-save-event": eventId }, "Zapisz"))
}));

import EventVenueDeck from "../components/EventVenueDeck";
import EventCard from "../components/EventCard";
import EventCardSaveButton from "../components/EventCardSaveButton";
import type { EventItem } from "../lib/events";

function item(id: string) {
  return {
    distanceKm: 2,
    event: {
      id, title: `Koncert ${id}`, slug: `koncert-${id}`, description: "Opis koncertu", short_description: null,
      start_at: "2027-05-01T18:00:00Z", end_at: null, is_all_day: false, main_image_url: null,
      price_type: "free", price_min: null, price_max: null, currency: "PLN", status: "published", visibility: "public",
      is_featured: false, is_verified: false, is_cancelled: false, updated_at: null, location: null, sources: [],
      imageUrl: `https://example.invalid/${id}.jpg`, startDate: "2027-05-01T18:00:00Z", address: "Klub, Warszawa",
      city: "Warszawa", citySlug: "warszawa", latitude: null, longitude: null, categoryName: "Koncerty",
      categorySlug: "koncerty", categoryRelation: null, category: "Koncerty", categoryColor: "#123456",
      organizerName: "Organizator", organizer: "Organizator", organizerRelation: null, organizerUrl: "", price: "Bezpłatne",
      tags: [], sourceType: "supabase", isFeatured: false
    } satisfies EventItem
  };
}

beforeEach(() => vi.clearAllMocks());

/** Inspect SSR ancestry without a DOM dependency, so hit areas cannot become inert with their previews. */
function selectionButtonAncestors(html: string): string[][] {
  const stack: string[] = [];
  const ancestors: string[][] = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</")) { stack.pop(); continue; }
    if (tag.includes('class="eventVenueDeckSelect ')) ancestors.push([...stack]);
    if (!voidTags.has(match[1]) && !tag.endsWith("/>")) stack.push(tag);
  }
  return ancestors;
}

/** Return a complete card body despite its nested divs, without adding a browser dependency. */
function cardBody(html: string) {
  const start = html.indexOf('<div class="eventCardHBody">');
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const tag of html.slice(start).matchAll(/<\/?div\b[^>]*>/g)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, start + (tag.index ?? 0) + tag[0].length);
  }
  throw new Error("Event card body is not closed");
}

it("mounts one ordinary interactive card with complete inert previews and accessible card hit areas", () => {
  const html = renderToStaticMarkup(createElement(EventVenueDeck, { events: [item("a"), item("b"), item("c")], venue: "Klub" }));
  expect(EventCardSaveButton).toHaveBeenCalledTimes(1);
  expect(EventCardSaveButton).toHaveBeenCalledWith(expect.objectContaining({ eventId: "a" }), undefined);
  expect(html.match(/class="eventCardHLink"/g)).toHaveLength(3);
  expect(html.match(/<a /g)).toHaveLength(1);
  const previews = [...html.matchAll(/<article class="eventCardH eventVenueDeckPreview"[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
  expect(previews).toHaveLength(2);
  for (const [index, preview] of previews.entries()) {
    const id = ["b", "c"][index];
    expect(preview).toContain('aria-hidden="true" inert=""');
    expect(preview).not.toMatch(/<(?:a|button)\b/);
    expect(preview).toMatch(/<img\b[^>]*alt=""[^>]*class="eventCardHImage"[^>]*draggable="false"/);
    expect(preview).toContain(`<h3 class="eventCardHTitle">Koncert ${id}</h3>`);
    expect(preview).toContain('<p class="eventCardHDesc">Opis koncertu</p>');
    expect(preview).toContain('class="eventCardHCategory" style="color:#123456">Koncerty</span>');
    expect(preview).toMatch(/<time class="eventCardHDate" dateTime="2027-05-01T18:00:00Z">[\s\S]*?20:00<\/time>/);
    expect(preview).toContain("Warszawa · Klub");
    expect(preview).toContain('<span class="eventCardHDist">2,0 km</span>');
    expect(preview).toContain('class="eventCardHPrice eventCardHPriceFree">Bezpłatne</span>');
    expect(preview).not.toMatch(/data-save-event=|eventCardHMapButton/);
  }
  expect(previews.join("")).toContain('src="https://example.invalid/b.jpg"');
  expect(previews.join("")).toContain('src="https://example.invalid/c.jpg"');
  expect(html.match(/class="eventVenueDeckSelect /g)).toHaveLength(2);
  expect(html.match(/<button\b[^>]*class="eventVenueDeckSelect [^"]*"[^>]*><\/button>/g)).toHaveLength(2);
  const layers = [...html.matchAll(/<div\b[^>]*data-deck-event="([^"]+)"[^>]*>/g)];
  expect(layers[0][0]).not.toContain('inert=""');
  for (const layer of layers.slice(1)) expect(layer[0]).toContain('aria-hidden="true" inert=""');
  const hitAreaAncestors = selectionButtonAncestors(html);
  expect(hitAreaAncestors).toHaveLength(2);
  for (const ancestors of hitAreaAncestors) {
    expect(ancestors.at(-1)).toContain('class="eventVenueDeckStage"');
    expect(ancestors.every(tag => !tag.includes('inert=""') && !tag.includes('aria-hidden="true"'))).toBe(true);
    expect(ancestors.every(tag => !tag.includes("eventVenueDeckLayer"))).toBe(true);
  }
  expect(html).toContain('aria-label="Wybierz kartę: Koncert b"');
  expect(html).toContain('aria-label="Wybierz kartę: Koncert c"');
  expect(html).not.toContain('aria-label="Wybierz kartę: Koncert a"');
  expect(html).toContain("Koncert b");
  expect(html).toContain("Koncert c");
  expect(html).toContain("Wydarzenia w tym miejscu na liście: 3");
  expect(html).not.toContain("Poprzednie wydarzenie:");
  expect(html).not.toContain("Następne wydarzenie:");
  expect(html).not.toContain("eventVenueDeckPeekLabel");
  expect(html).not.toContain("eventVenueDeckNavigation");
});

it("keeps rear card information identical to a regular card for the same event", () => {
  const paid = item("paid");
  paid.distanceKm = Number.NaN;
  Object.assign(paid.event, {
    description: "Dłuższy opis, którego karta nie powinna pokazywać",
    short_description: "Krótki opis wydarzenia",
    price_type: "paid", price_min: 25, price_max: 40, price: "Bilety",
    is_all_day: true
  });
  const deck = renderToStaticMarkup(createElement(EventVenueDeck, { events: [item("front"), paid], venue: "Klub" }));
  const preview = deck.match(/<article class="eventCardH eventVenueDeckPreview"[^>]*>[\s\S]*?<\/article>/)?.[0];
  expect(preview).toBeDefined();
  const regular = renderToStaticMarkup(createElement(EventCard, paid));
  expect(cardBody(preview!)).toBe(cardBody(regular));
  expect(preview).toContain("Krótki opis wydarzenia");
  expect(preview).not.toContain("Dłuższy opis");
  expect(preview).toContain("Cały dzień");
  expect(preview).toContain("25–40");
  expect(preview).not.toContain("eventCardHDist");
  expect(regular).toContain('alt="Koncert paid"');
  expect(preview).toContain('alt=""');
});

it("labels the venue above its own deck and announces selection without visible footer controls", () => {
  const html = renderToStaticMarkup(createElement(EventVenueDeck, { events: [item("a"), item("b"), item("c")], venue: "Klub" }));
  const header = html.match(/<header class="eventVenueDeckHeader">([\s\S]*?)<\/header>/)?.[1];
  const counter = html.match(/<span class="eventVenueDeckCounter srOnly"([^>]*)>([\s\S]*?)<\/span>/);
  expect(header).toBeDefined();
  expect(header).toMatch(/<h3 id="[^"]+-venue">Klub<\/h3>/);
  expect(html.indexOf('class="eventVenueDeckHeader"')).toBeLessThan(html.indexOf('class="eventVenueDeckStage"'));
  expect(html).toMatch(/aria-labelledby="[^"]+-venue"/);
  expect(html).not.toContain("eventVenueDeckFooter");
  expect(html).not.toContain("eventVenueDeckNavigation");
  expect(counter).not.toBeNull();
  expect(counter?.[1]).toContain('aria-live="polite" aria-atomic="true"');
  expect(counter?.[2]).toBe("Koncert a. Wydarzenie 1 z 3 na tej liście.");
});

it("does not manufacture a second preview for a two-event group", () => {
  const html = renderToStaticMarkup(createElement(EventVenueDeck, { events: [item("a"), item("b")], venue: null }));
  expect(html.match(/<article class="eventCardH eventVenueDeckPreview"[^>]*aria-hidden="true" inert=""/g)).toHaveLength(1);
  expect(html.match(/data-deck-event=/g)).toHaveLength(2);
  expect(html.match(/class="eventVenueDeckSelect /g)).toHaveLength(1);
  expect(selectionButtonAncestors(html)).toHaveLength(1);
  expect(html).toContain('aria-label="Wybierz kartę: Koncert b"');
  expect(EventCardSaveButton).toHaveBeenCalledTimes(1);
  expect(html).toContain("To samo miejsce");
});

it("retains hidden event layers in a large group without adding their controls or preview content", () => {
  const ids = Array.from({ length: 12 }, (_, index) => `event-${index}`);
  const html = renderToStaticMarkup(createElement(EventVenueDeck, { events: ids.map(item), venue: "Klub" }));
  const layers = [...html.matchAll(/<div\b[^>]*data-deck-event="([^"]+)"[^>]*>/g)];
  expect(layers.map(match => match[1])).toEqual(ids);
  expect(layers.filter(match => match[0].includes("visibility:visible"))).toHaveLength(7);
  const hiddenLayers = layers.filter(match => match[0].includes("visibility:hidden"));
  expect(hiddenLayers).toHaveLength(5);
  for (const layer of layers.slice(1)) {
    expect(layer[0]).toContain('aria-hidden="true" inert=""');
  }
  expect(html.match(/class="eventCardH eventVenueDeckPreview"/g)).toHaveLength(6);
  expect(html.match(/class="eventVenueDeckSelect /g)).toHaveLength(2);
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(EventCardSaveButton).toHaveBeenCalledTimes(1);
});

it("uses a regular card for a single result and renders nothing for an empty group", () => {
  const html = renderToStaticMarkup(createElement(EventVenueDeck, { events: [item("a")], venue: "Klub" }));
  expect(html).toContain('class="eventCardH"');
  expect(html).not.toContain("eventVenueDeckStage");
  expect(renderToStaticMarkup(createElement(EventVenueDeck, { events: [], venue: "Klub" }))).toBe("");
});
