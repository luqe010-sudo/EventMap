// iCalendar (RFC 5545) VEVENT extraction. Recurrence rules are not expanded:
// only explicitly listed occurrences are taken (see docs/content-supply.md —
// never invent future dates).

import { type EventFacts, cleanText, parseFlexibleDate } from "../facts.ts";
import { parseLocationString, priceFromText } from "./common.ts";

type Prop = { name: string; params: Record<string, string>; value: string };

export function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  const colon = findValueColon(line);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function findValueColon(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\"") quoted = !quoted;
    else if (line[i] === ":" && !quoted) return i;
  }
  return -1;
}

function unescape(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function zonedToIso(local: string, zone: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(part => Number(part ?? 0));
  // Find the UTC instant whose wall-clock in `zone` equals the given local time.
  let guess = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const target = Date.UTC(y, mo - 1, d, h, mi, s);
    if (wall === target) break;
    guess += target - wall;
  }
  return new Date(guess).toISOString();
}

export function parseIcsDate(prop: Prop): { iso: string; allDay: boolean } | null {
  const value = prop.value.trim();
  if (prop.params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    return m ? parseFlexibleDate(`${m[1]}-${m[2]}-${m[3]}`) : null;
  }
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z$/.exec(value);
  if (utc) return { iso: new Date(Date.UTC(+utc[1], +utc[2] - 1, +utc[3], +utc[4], +utc[5], +(utc[6] ?? 0))).toISOString(), allDay: false };
  const zone = prop.params.TZID;
  if (zone && zone !== "Europe/Warsaw") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      const iso = zonedToIso(value, zone);
      return iso ? { iso, allDay: false } : null;
    } catch { /* Unknown TZID (often Windows names) — fall back to Warsaw local time. */ }
  }
  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(value);
  return local ? parseFlexibleDate(`${local[1]}-${local[2]}-${local[3]}T${local[4]}:${local[5]}:${local[6] ?? "00"}`) : null;
}

export type IcsResult = { events: EventFacts[]; skippedRecurring: number; skipped: number };

export function parseIcs(text: string, pageUrl: string): IcsResult {
  const events: EventFacts[] = [];
  let skippedRecurring = 0;
  let skipped = 0;
  let current: Prop[] | null = null;
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT/i.test(line)) { current = []; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (current) {
        const facts = toFacts(current, pageUrl);
        if (facts === "recurring") skippedRecurring += 1;
        else if (facts) events.push(facts);
        else skipped += 1;
      }
      current = null;
      continue;
    }
    if (current) {
      const prop = parseLine(line);
      if (prop) current.push(prop);
    }
  }
  return { events, skippedRecurring, skipped };
}

function toFacts(props: Prop[], pageUrl: string): EventFacts | "recurring" | null {
  const get = (name: string) => props.find(prop => prop.name === name);
  if (get("RRULE") || get("RDATE")) return "recurring";
  const title = cleanText(unescape(get("SUMMARY")?.value ?? ""), 300);
  const start = get("DTSTART") ? parseIcsDate(get("DTSTART") as Prop) : null;
  if (!title || !start) return null;
  const end = get("DTEND") ? parseIcsDate(get("DTEND") as Prop) : null;
  const location = parseLocationString(unescape(get("LOCATION")?.value ?? ""));
  const geo = get("GEO")?.value.split(/[;,]/).map(Number);
  const description = unescape(get("DESCRIPTION")?.value ?? "");
  const price = priceFromText(`${title} ${description}`);
  const status = (get("STATUS")?.value ?? "").toUpperCase() === "CANCELLED" ? "cancelled" as const : "scheduled" as const;
  let url = pageUrl;
  try { const candidate = get("URL")?.value.trim(); if (candidate) url = new URL(candidate, pageUrl).toString(); } catch { /* keep page URL */ }
  const uid = get("UID")?.value.trim() || `${title}|${start.iso}`;
  const recurrence = get("RECURRENCE-ID")?.value.trim();
  let endAt = end?.iso ?? null;
  if (start.allDay && end?.allDay && endAt) {
    // DTEND for all-day events is exclusive; a one-day event has no separate end.
    const span = Date.parse(endAt) - Date.parse(start.iso);
    endAt = span <= 86400_000 ? null : new Date(Date.parse(endAt) - 60_000).toISOString();
  }
  if (endAt && Date.parse(endAt) <= Date.parse(start.iso)) endAt = null;
  return {
    externalId: recurrence ? `${uid}#${recurrence}` : uid,
    title,
    startAt: start.iso,
    endAt,
    isAllDay: start.allDay,
    ...location,
    latitude: geo && geo.length === 2 && geo.every(Number.isFinite) ? geo[0] : null,
    longitude: geo && geo.length === 2 && geo.every(Number.isFinite) ? geo[1] : null,
    ...price,
    currency: "PLN",
    url,
    status,
    organizerName: cleanText(get("ORGANIZER")?.params.CN ?? null, 200),
    keywords: [get("CATEGORIES")?.value ?? "", title].filter(Boolean),
    method: "ics"
  };
}
