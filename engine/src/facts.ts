// Canonical event facts extracted from a source. Only facts — never creative text,
// images or posters from the source. Descriptions are written later by the
// Content agent from these fields only.

import { createHash } from "node:crypto";

export const TIMEZONE = "Europe/Warsaw";

export type EventFacts = {
  externalId: string;
  title: string;
  startAt: string; // ISO 8601 UTC
  endAt: string | null;
  isAllDay: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  priceType: "free" | "paid" | "unknown";
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  url: string; // canonical page of this event at the source (organiser)
  status: "scheduled" | "cancelled" | "postponed";
  organizerName: string | null;
  /** Free-text keywords used only for category classification; never published. */
  keywords: string[];
  method: "ics" | "jsonld" | "rss" | "json_api";
};

export function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("pl-PL").replaceAll("ł", "l")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function localDay(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** Same formula as scripts/import-curated-events.mjs, so curated and engine records share keys. */
export function eventKey(title: string, city: string, startAt: string): string {
  return createHash("sha256").update([normalizeText(title), normalizeText(city), new Date(startAt).toISOString()].join("|")).digest("hex");
}

/** Occurrence fingerprint used for cross-source deduplication (title + local day + city). */
export function occurrenceFingerprint(title: string, city: string, startAt: string): string {
  return createHash("sha256").update([normalizeText(title), normalizeText(city), localDay(startAt)].join("|")).digest("hex").slice(0, 32);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Token-set similarity for near-duplicate titles ("Koncert: X" vs "X – koncert"). */
export function titleSimilarity(a: string, b: string): number {
  const stop = new Set(["i", "w", "na", "z", "do", "koncert", "spektakl", "wystawa", "the", "a", "o", "oraz", "pl"]);
  const tokens = (value: string) => new Set(normalizeText(value).split(" ").filter(token => token.length > 1 && !stop.has(token)));
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const containment = shared / Math.min(left.size, right.size);
  const dice = 2 * shared / (left.size + right.size);
  return (containment + dice) / 2;
}

/** Offset of Europe/Warsaw at a given wall-clock moment, e.g. "+01:00" or "+02:00". */
export function warsawOffset(year: number, month: number, day: number, hour = 12, minute = 0): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" }).formatToParts(new Date(guess));
  const name = parts.find(part => part.type === "timeZoneName")?.value ?? "GMT+01:00";
  const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return match ? `${match[1]}:${match[2] ?? "00"}` : "+01:00";
}

/** Converts a local Warsaw wall-clock time to ISO UTC. */
export function warsawLocalToIso(year: number, month: number, day: number, hour: number, minute: number, second = 0): string {
  const offset = warsawOffset(year, month, day, hour, minute);
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${offset}`).toISOString();
}

/**
 * Parses a schema.org/ISO date. Values without an offset are treated as local
 * Warsaw time. Date-only values are all-day. Returns null for unusable input.
 */
export function parseFlexibleDate(value: unknown): { iso: string; allDay: boolean } | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const [, y, m, d] = dateOnly.map(Number);
    if (!validDay(y, m, d)) return null;
    return { iso: warsawLocalToIso(y, m, d, 0, 0), allDay: true };
  }
  const full = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if (!full) return null;
  const [y, m, d, hh, mm, ss] = full.slice(1, 7).map(part => Number(part ?? 0));
  if (!validDay(y, m, d) || hh > 23 || mm > 59) return null;
  if (full[7]) {
    const zone = full[7] === "Z" ? "Z" : full[7].replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
    const parsed = Date.parse(`${full[1]}-${full[2]}-${full[3]}T${full[4]}:${full[5]}:${full[6] ?? "00"}${zone}`);
    return Number.isFinite(parsed) ? { iso: new Date(parsed).toISOString(), allDay: false } : null;
  }
  return { iso: warsawLocalToIso(y, m, d, hh, mm, ss), allDay: false };
}

function validDay(y: number, m: number, d: number): boolean {
  return y > 2000 && y < 2100 && new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function cleanText(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const text = decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}
