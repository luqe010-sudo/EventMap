// "The Events Calendar" (WordPress) public REST API — very common on Polish
// cultural-centre sites. /wp-json/tribe/events/v1/events returns structured
// facts incl. venue address and coordinates. Descriptions/images are ignored.

import { type EventFacts, cleanText, parseFlexibleDate } from "../facts.ts";
import { priceFromText } from "./common.ts";

export function tribeEndpoint(siteUrl: string): string {
  const url = new URL("/wp-json/tribe/events/v1/events", siteUrl);
  url.searchParams.set("per_page", "50");
  url.searchParams.set("start_date", "now");
  return url.toString();
}

export function looksLikeTribe(html: string): boolean {
  return /wp-json\/tribe\/events\/v1|tribe-events-calendar|class=["'][^"']*tribe-events/i.test(html);
}

type TribeVenue = { venue?: string; address?: string; city?: string; zip?: string; country?: string; geo_lat?: number | string; geo_lng?: number | string };
type TribeEvent = {
  id?: number; title?: string; url?: string; start_date?: string; end_date?: string; utc_start_date?: string; utc_end_date?: string;
  all_day?: boolean; timezone?: string; cost?: string; cost_details?: { values?: Array<string | number> };
  venue?: TribeVenue | TribeVenue[] | []; categories?: Array<{ name?: string; slug?: string }>; organizer?: Array<{ organizer?: string }>;
};

function utcIso(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = parseFlexibleDate(`${value.replace(" ", "T")}Z`);
  return parsed?.iso ?? null;
}

export function parseTribe(json: string): { events: EventFacts[]; nextPage: string | null; skipped: number } {
  let payload: { events?: TribeEvent[]; next_rest_url?: string };
  try { payload = JSON.parse(json) as typeof payload; } catch { return { events: [], nextPage: null, skipped: 0 }; }
  const events: EventFacts[] = [];
  let skipped = 0;
  for (const item of payload.events ?? []) {
    const title = cleanText(item.title ?? "", 300);
    const allDay = item.all_day === true;
    const start = allDay ? parseFlexibleDate((item.start_date ?? "").slice(0, 10)) : (utcIso(item.utc_start_date) ? { iso: utcIso(item.utc_start_date) as string, allDay: false } : null);
    if (!title || !start || !item.url) { skipped += 1; continue; }
    const venue = Array.isArray(item.venue) ? item.venue[0] : item.venue;
    if (venue?.country && !/^(pl|polska|poland)$/i.test(venue.country.trim())) { skipped += 1; continue; }
    const lat = venue?.geo_lat != null ? Number(venue.geo_lat) : null;
    const lon = venue?.geo_lng != null ? Number(venue.geo_lng) : null;
    const amounts = (item.cost_details?.values ?? []).map(Number).filter(value => Number.isFinite(value) && value >= 0);
    const price = amounts.length
      ? (Math.max(...amounts) === 0 ? { priceType: "free" as const, priceMin: 0, priceMax: 0 } : { priceType: "paid" as const, priceMin: Math.min(...amounts.filter(v => v > 0)), priceMax: Math.max(...amounts) })
      : priceFromText(item.cost ?? "");
    const endIso = allDay ? null : utcIso(item.utc_end_date);
    events.push({
      externalId: `tribe:${item.id ?? item.url}`,
      title,
      startAt: start.iso,
      endAt: endIso && Date.parse(endIso) > Date.parse(start.iso) && Date.parse(endIso) - Date.parse(start.iso) < 120 * 86400_000 ? endIso : null,
      isAllDay: allDay,
      venueName: cleanText(venue?.venue ?? "", 300),
      address: cleanText(venue?.address ?? "", 300),
      city: cleanText(venue?.city ?? "", 120),
      postalCode: cleanText(venue?.zip ?? "", 12),
      latitude: lat !== null && Number.isFinite(lat) && lat !== 0 ? lat : null,
      longitude: lon !== null && Number.isFinite(lon) && lon !== 0 ? lon : null,
      ...price,
      currency: "PLN",
      url: item.url,
      status: "scheduled",
      organizerName: cleanText(item.organizer?.[0]?.organizer ?? "", 200),
      keywords: [title, ...(item.categories ?? []).map(category => category.name ?? "")].filter(Boolean),
      method: "json_api"
    });
  }
  return { events, nextPage: payload.next_rest_url ?? null, skipped };
}
