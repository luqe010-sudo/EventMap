// Calendars (notably WordPress "The Events Calendar") often list a long-running
// exhibition or fair as one entry per opening day. Daily repeats of the same
// title at the same place become one event spanning first → last occurrence.
// Weekly or occasional repeats (e.g. a Sunday organ concert) stay separate.
// Only occurrences explicitly listed by the source are merged; nothing is invented.

import { createHash } from "node:crypto";
import { type EventFacts, localDay, normalizeText } from "../facts.ts";

const MIN_OCCURRENCES = 3;
const MAX_MEDIAN_GAP_DAYS = 2;
const MAX_SPAN_DAYS = 120;

export function seriesKey(facts: Pick<EventFacts, "title" | "venueName" | "address">): string {
  const base = [normalizeText(facts.title), normalizeText(facts.venueName ?? facts.address ?? "")].join("|");
  return `series:${createHash("sha256").update(base).digest("hex").slice(0, 24)}`;
}

function dayNumber(iso: string): number {
  return Date.parse(`${localDay(iso)}T00:00:00Z`) / 86400_000;
}

export function mergeDailySeries(events: EventFacts[]): EventFacts[] {
  const groups = new Map<string, EventFacts[]>();
  for (const event of events) {
    const key = seriesKey(event);
    const group = groups.get(key);
    if (group) group.push(event); else groups.set(key, [event]);
  }
  const out: EventFacts[] = [];
  for (const [key, group] of groups) {
    const days = [...new Set(group.map(event => dayNumber(event.startAt)))].sort((a, b) => a - b);
    if (days.length < MIN_OCCURRENCES) { out.push(...group); continue; }
    const gaps = days.slice(1).map((day, index) => day - days[index]).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    const span = days[days.length - 1] - days[0];
    if (median > MAX_MEDIAN_GAP_DAYS || span > MAX_SPAN_DAYS) { out.push(...group); continue; }
    const sorted = [...group].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    out.push({ ...first, externalId: key, endAt: last.endAt ?? last.startAt });
  }
  return out;
}

/** Union of two observations of the same series (e.g. split across API pages). */
export function unionSeries(previous: EventFacts, next: EventFacts, now: Date = new Date()): EventFacts {
  const prevStart = Date.parse(previous.startAt);
  const start = prevStart > now.getTime() && prevStart < Date.parse(next.startAt) ? previous.startAt : next.startAt;
  // Same cap as a single page: a series never spans more than MAX_SPAN_DAYS from its start.
  const cap = Date.parse(start) + MAX_SPAN_DAYS * 86400_000;
  const ends = [previous.endAt, next.endAt].filter((value): value is string => Boolean(value)).map(Date.parse).filter(value => value <= cap);
  const end = ends.length ? new Date(Math.max(...ends)).toISOString() : null;
  return { ...next, startAt: start, endAt: end && Date.parse(end) > Date.parse(start) ? end : null };
}
