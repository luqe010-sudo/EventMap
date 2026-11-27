// schema.org Event extraction from JSON-LD embedded by organisers. Only factual
// fields are read; `description` and `image` are deliberately ignored.

import { type EventFacts, canonicalUrl, cleanText, parseFlexibleDate } from "../facts.ts";
import { parseLocationString } from "./common.ts";

export type DomainQuirks = {
  /** Site writes local Warsaw time with a "Z"/UTC suffix (e.g. Progresja, Nov 2026). */
  treatUtcAsLocal?: boolean;
  /** endDate is a template default, not a real end (e.g. TAURON Arena, ERGO ARENA). */
  ignoreEndDate?: boolean;
};

const EVENT_TYPES = new Set([
  "event", "musicevent", "theaterevent", "sportsevent", "festival", "exhibitionevent", "comedyevent", "childrensevent",
  "educationevent", "socialevent", "danceevent", "literaryevent", "screeningevent", "businessevent", "foodevent",
  "saleevent", "visualartsevent", "courseinstance", "publicationevent", "hackathon"
]);

type Node = Record<string, unknown>;

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").replace(/[\u0000-\u001f]+/g, " ").trim();
    if (!raw) continue;
    try { blocks.push(JSON.parse(raw)); } catch { /* malformed block — skip */ }
  }
  return blocks;
}

function flatten(value: unknown, out: Node[] = [], depth = 0): Node[] {
  if (depth > 6 || value == null) return out;
  if (Array.isArray(value)) { for (const item of value) flatten(item, out, depth + 1); return out; }
  if (typeof value !== "object") return out;
  const node = value as Node;
  out.push(node);
  if (node["@graph"]) flatten(node["@graph"], out, depth + 1);
  if (node.subEvent) flatten(node.subEvent, out, depth + 1);
  if (node.itemListElement) flatten((node.itemListElement as unknown[] | Node), out, depth + 1);
  if (node.item && typeof node.item === "object") flatten(node.item, out, depth + 1);
  return out;
}

function types(node: Node): string[] {
  const value = node["@type"];
  return (Array.isArray(value) ? value : [value]).filter((t): t is string => typeof t === "string").map(t => t.replace(/^.*[/#]/, "").toLowerCase());
}

function first<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown, max = 300): string | null {
  if (typeof value === "string") return cleanText(value, max);
  if (value && typeof value === "object" && typeof (value as Node)["@value"] === "string") return cleanText((value as Node)["@value"] as string, max);
  return null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function placeFacts(raw: unknown): Pick<EventFacts, "venueName" | "address" | "city" | "postalCode" | "latitude" | "longitude"> & { online: boolean } {
  const empty = { venueName: null, address: null, city: null, postalCode: null, latitude: null, longitude: null, online: false };
  const place = first(raw as Node | Node[] | string | undefined);
  if (!place) return empty;
  if (typeof place === "string") return { ...empty, ...parseLocationString(place) };
  if (types(place).includes("virtuallocation")) return { ...empty, online: true };
  const address = first(place.address as Node | Node[] | string | undefined);
  let street: string | null = null;
  let city: string | null = null;
  let postalCode: string | null = null;
  if (typeof address === "string") {
    const parsed = parseLocationString(address);
    street = parsed.address ?? parsed.venueName; city = parsed.city; postalCode = parsed.postalCode;
  } else if (address) {
    street = text(address.streetAddress, 300);
    city = text(address.addressLocality, 120);
    postalCode = text(address.postalCode, 12);
    const country = text(address.addressCountry, 60) ?? text((address.addressCountry as Node | undefined)?.name, 60);
    if (country && !/^(pl|pol|polska|poland)$/i.test(country)) return { ...empty, venueName: "__foreign__" };
  }
  const geo = first(place.geo as Node | Node[] | undefined);
  const lat = geo ? number(geo.latitude) : null;
  const lon = geo ? number(geo.longitude) : null;
  return { venueName: text(place.name, 300), address: street, city, postalCode, latitude: lat, longitude: lon, online: false };
}

function offerFacts(node: Node): Pick<EventFacts, "priceType" | "priceMin" | "priceMax" | "currency"> {
  if (node.isAccessibleForFree === true || node.isAccessibleForFree === "true" || node.isAccessibleForFree === "True") {
    return { priceType: "free", priceMin: 0, priceMax: 0, currency: "PLN" };
  }
  const offers = flatten(node.offers ?? []).filter(offer => types(offer).some(t => t === "offer" || t === "aggregateoffer") || "price" in offer || "lowPrice" in offer);
  const prices: number[] = [];
  let currency = "PLN";
  for (const offer of offers) {
    for (const key of ["price", "lowPrice", "highPrice"]) {
      const value = number(offer[key]);
      if (value !== null && value >= 0 && value < 100000) prices.push(value);
    }
    const cur = text(offer.priceCurrency, 3);
    if (cur && /^[A-Z]{3}$/.test(cur)) currency = cur;
  }
  if (!prices.length) return { priceType: "unknown", priceMin: null, priceMax: null, currency };
  const max = Math.max(...prices);
  if (max === 0) return { priceType: "free", priceMin: 0, priceMax: 0, currency };
  const positive = prices.filter(value => value > 0);
  return { priceType: "paid", priceMin: Math.min(...positive), priceMax: max, currency };
}

function applyQuirks(value: unknown, quirks: DomainQuirks): unknown {
  if (quirks.treatUtcAsLocal && typeof value === "string") return value.replace(/(Z|[+-]00:?00)$/, "");
  return value;
}

export function extractJsonLdEvents(html: string, pageUrl: string, quirks: DomainQuirks = {}): { events: EventFacts[]; skipped: number } {
  const events: EventFacts[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const node of extractJsonLdBlocks(html).flatMap(block => flatten(block))) {
    const nodeTypes = types(node);
    if (!nodeTypes.some(t => EVENT_TYPES.has(t))) continue;
    const title = text(node.name, 300);
    const start = parseFlexibleDate(applyQuirks(node.startDate, quirks));
    if (!title || !start) { skipped += 1; continue; }
    const place = placeFacts(node.location);
    const attendance = String(node.eventAttendanceMode ?? "");
    if (place.online || /OnlineEventAttendanceMode/i.test(attendance) || place.venueName === "__foreign__") { skipped += 1; continue; }
    const end = quirks.ignoreEndDate ? null : parseFlexibleDate(applyQuirks(node.endDate, quirks));
    const statusText = String(node.eventStatus ?? "");
    const status = /EventCancelled/i.test(statusText) ? "cancelled" as const : /EventPostponed/i.test(statusText) ? "postponed" as const : "scheduled" as const;
    let url = pageUrl;
    try { const raw = text(node.url, 2000) ?? text(first(node.sameAs as string | string[] | undefined), 2000); if (raw) url = canonicalUrl(new URL(raw, pageUrl).toString()); } catch { /* keep page URL */ }
    const organizer = first(node.organizer as Node | Node[] | string | undefined);
    const externalId = text(node["@id"], 500) ?? `${url}|${start.iso}`;
    if (seen.has(`${externalId}|${start.iso}`)) continue;
    seen.add(`${externalId}|${start.iso}`);
    const { online: _online, ...placeOnly } = place;
    void _online;
    let endAt = end?.iso ?? null;
    if (endAt && Date.parse(endAt) <= Date.parse(start.iso)) endAt = null;
    events.push({
      externalId,
      title,
      startAt: start.iso,
      endAt,
      isAllDay: start.allDay,
      ...placeOnly,
      ...offerFacts(node),
      url,
      status,
      organizerName: typeof organizer === "string" ? cleanText(organizer, 200) : text(organizer?.name, 200),
      keywords: [...nodeTypes, title, ...(Array.isArray(node.keywords) ? node.keywords.map(String) : typeof node.keywords === "string" ? [node.keywords] : [])].slice(0, 20),
      method: "jsonld"
    });
  }
  return { events, skipped };
}
