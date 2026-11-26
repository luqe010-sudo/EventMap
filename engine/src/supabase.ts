// Gateway to the existing MapaImprez Supabase. Uses only existing tables and
// columns (events, locations, event_sources, categories, cities); no schema
// change is needed. Reads use the publishable key; writes need the service key,
// which is only present in the `publisher` container.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import type { EngineConfig } from "./config.ts";
import { type EventFacts, eventKey, localDay, normalizeText } from "./facts.ts";

export type Client = SupabaseClient<Database>;
export type City = { id: string; name: string; slug: string; voivodeship: string | null; county: string | null; latitude: number | null; longitude: number | null };
export type Catalog = { categories: Map<string, string>; cities: City[]; loadedAt: number };

export const ENGINE_MARKER_PREFIX = "EventMap engine v1;";

export function publicClient(config: EngineConfig): Client | null {
  if (!config.supabaseUrl || !config.supabasePublishableKey) return null;
  return createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serviceClient(config: EngineConfig): Client | null {
  if (!config.supabaseUrl || !config.supabaseServiceKey) return null;
  return createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 50000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function loadCatalog(client: Client): Promise<Catalog> {
  const [categories, cities] = await Promise.all([
    readAll((from, to) => client.from("categories").select("id,slug").order("id").range(from, to)),
    readAll((from, to) => client.from("cities").select("id,name,slug,voivodeship,county,latitude,longitude").eq("is_active", true).order("id").range(from, to))
  ]);
  return { categories: new Map(categories.map(row => [row.slug, row.id])), cities: cities as City[], loadedAt: Date.now() };
}

/** Exact, unambiguous city match; optional voivodeship narrows homonyms (e.g. several "Nowa Wieś"). */
export function matchCity(catalog: Catalog, cityName: string | null, voivodeship?: string | null): City | null {
  if (!cityName) return null;
  const wanted = normalizeText(cityName);
  let matches = catalog.cities.filter(city => normalizeText(city.name) === wanted);
  if (matches.length > 1 && voivodeship) {
    const narrowed = matches.filter(city => normalizeText(city.voivodeship) === normalizeText(voivodeship));
    if (narrowed.length) matches = narrowed;
  }
  return matches.length === 1 ? matches[0] : null;
}

export function engineMarker(sourceId: number, key: string, url: string): string {
  return `${ENGINE_MARKER_PREFIX} source=${sourceId}; key=${key}; url=${url}`.slice(0, 3900);
}

export function engineSlug(title: string, city: string, startAt: string, key: string): string {
  const base = normalizeText(`${title} ${city} ${localDay(startAt)}`).replaceAll(" ", "-").slice(0, 140).replace(/-+$/, "");
  return `${base}-${key.slice(0, 10)}`;
}

/** Existing events in the same city on the same local day — for cross-source deduplication. */
export async function sameDayEvents(client: Client, cityId: string, startAt: string): Promise<Array<{ id: string; title: string; start_at: string; review_note: string | null }>> {
  const day = localDay(startAt);
  const from = new Date(`${day}T00:00:00Z`).getTime() - 3 * 3600_000;
  const to = from + 30 * 3600_000;
  const { data, error } = await client.from("events")
    .select("id,title,start_at,review_note,status,locations!inner(city_id)")
    .eq("locations.city_id", cityId)
    .gte("start_at", new Date(from).toISOString()).lt("start_at", new Date(to).toISOString())
    .neq("status", "rejected").limit(500);
  if (error) throw new Error(`Odczyt duplikatów: ${error.message}`);
  return (data ?? []).filter(row => localDay(row.start_at) === day).map(row => ({ id: row.id, title: row.title, start_at: row.start_at, review_note: row.review_note }));
}

export async function ensureLocation(client: Client, cityId: string, facts: EventFacts): Promise<string> {
  const name = facts.venueName ?? facts.address ?? "";
  const { data, error } = await client.from("locations").select("id,name,address").eq("city_id", cityId).limit(2000);
  if (error) throw new Error(`Odczyt lokalizacji: ${error.message}`);
  const existing = (data ?? []).find(row => normalizeText(row.name) === normalizeText(name)
    && (!facts.address || !row.address || normalizeText(row.address) === normalizeText(facts.address)));
  if (existing) return existing.id;
  const inserted = await client.from("locations").insert({
    name, address: facts.address, city_id: cityId, latitude: facts.latitude, longitude: facts.longitude, postal_code: facts.postalCode
  }).select("id").single();
  if (inserted.error || !inserted.data) throw new Error(`Zapis lokalizacji: ${inserted.error?.message ?? "brak ID"}`);
  return inserted.data.id;
}

export type PublishInput = {
  sourceId: number; sourceName: string; facts: EventFacts; cityId: string; cityName: string; categoryId: string;
  shortDescription: string; description: string; publish: boolean; checkedAt: string;
};

export type PublishResult = { eventId: string; status: "published" | "pending_review"; updatedAt: string | null; slug: string };

/**
 * Same safe order as scripts/import-curated-events.mjs: insert as pending_review,
 * attach the source, confirm it, and only then publish with an optimistic guard.
 * Images are never set (main_image_url stays null → licensed EventVisual covers).
 */
export async function insertEvent(client: Client, input: PublishInput): Promise<PublishResult> {
  const key = eventKey(input.facts.title, input.cityName, input.facts.startAt);
  const marker = engineMarker(input.sourceId, key, input.facts.url);
  const slug = engineSlug(input.facts.title, input.cityName, input.facts.startAt, key);
  const locationId = await ensureLocation(client, input.cityId, input.facts);
  const created = await client.from("events").insert({
    title: input.facts.title, slug, category_id: input.categoryId, location_id: locationId,
    start_at: input.facts.startAt, end_at: input.facts.endAt, timezone: "Europe/Warsaw", is_all_day: input.facts.isAllDay,
    short_description: input.shortDescription, description: input.description,
    price_type: input.facts.priceType, price_min: input.facts.priceMin, price_max: input.facts.priceMax, currency: input.facts.currency,
    organizer_id: null, submitted_by_organizer_id: null, status: "pending_review", visibility: "public",
    is_cancelled: false, is_featured: false, is_verified: false, published_at: null, main_image_url: null, review_note: marker
  }).select("id,updated_at").single();
  if (created.error || !created.data) throw new Error(`Zapis wydarzenia: ${created.error?.message ?? "brak ID"}`);
  const eventId = created.data.id;
  const source = await client.from("event_sources").insert({
    event_id: eventId, source_type: "engine", source_name: input.sourceName.slice(0, 300), source_url: input.facts.url,
    external_id: `engine:${input.sourceId}:${input.facts.externalId}`.slice(0, 500), raw_title: input.facts.title,
    raw_date: input.facts.startAt, raw_location: [input.facts.venueName, input.facts.address, input.cityName].filter(Boolean).join(", "),
    scraped_at: input.checkedAt, last_seen_at: input.checkedAt, is_active: true
  }).select("id").single();
  if (source.error || !source.data) throw new Error(`Zapis źródła (wydarzenie ${eventId} pozostaje pending_review): ${source.error?.message ?? "brak ID"}`);
  if (!input.publish) return { eventId, status: "pending_review", updatedAt: created.data.updated_at, slug };
  let publication = client.from("events").update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", eventId).eq("status", "pending_review").eq("review_note", marker).is("submitted_by_organizer_id", null);
  publication = created.data.updated_at ? publication.eq("updated_at", created.data.updated_at) : publication.is("updated_at", null);
  const published = await publication.select("id,status,updated_at").maybeSingle();
  if (published.error || !published.data || published.data.status !== "published") {
    return { eventId, status: "pending_review", updatedAt: created.data.updated_at, slug };
  }
  return { eventId, status: "published", updatedAt: published.data.updated_at, slug };
}

/**
 * Applies a factual change from the source (date, place, price, cancellation) only
 * if nobody edited the record since our last write (updated_at guard) and the
 * record still carries our marker. Otherwise the change becomes a review item.
 */
export async function updateOwnedEvent(client: Client, eventId: string, expectedUpdatedAt: string | null, patch: Database["public"]["Tables"]["events"]["Update"]): Promise<{ applied: boolean; updatedAt: string | null }> {
  let query = client.from("events").update(patch).eq("id", eventId).like("review_note", `${ENGINE_MARKER_PREFIX}%`);
  query = expectedUpdatedAt ? query.eq("updated_at", expectedUpdatedAt) : query.is("updated_at", null);
  const { data, error } = await query.select("id,updated_at").maybeSingle();
  if (error) throw new Error(`Aktualizacja wydarzenia: ${error.message}`);
  return { applied: Boolean(data), updatedAt: data?.updated_at ?? null };
}

/** Retraction (per source): archive, never delete — reversible by the admin. */
export async function archiveOwnedEvent(client: Client, eventId: string, sourceId: number): Promise<boolean> {
  const { data, error } = await client.from("events").update({ status: "archived" })
    .eq("id", eventId).like("review_note", `${ENGINE_MARKER_PREFIX} source=${sourceId};%`).select("id").maybeSingle();
  if (error) throw new Error(`Wycofanie wydarzenia: ${error.message}`);
  if (data) await client.from("event_sources").update({ is_active: false }).eq("event_id", eventId).like("external_id", `engine:${sourceId}:%`);
  return Boolean(data);
}

/** Public, upcoming events for coverage analysis (publishable key; published/public/not cancelled). */
export async function upcomingCoverage(client: Client, days = 60): Promise<Array<{ category: string | null; voivodeship: string | null; city: string | null }>> {
  const now = new Date();
  const until = new Date(now.getTime() + days * 86400_000);
  const rows = await readAll((from, to) => client.from("events")
    .select("id,category:categories(slug),location:locations(city:cities(name,voivodeship))")
    .eq("status", "published").eq("visibility", "public").or("is_cancelled.is.null,is_cancelled.eq.false")
    .gte("start_at", now.toISOString()).lt("start_at", until.toISOString()).order("id").range(from, to), 100000);
  type Row = { category: { slug: string } | { slug: string }[] | null; location: { city: { name: string; voivodeship: string | null } | { name: string; voivodeship: string | null }[] | null } | { city: unknown }[] | null };
  const one = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  return (rows as unknown as Row[]).map(row => {
    const location = one(row.location as { city: { name: string; voivodeship: string | null } | { name: string; voivodeship: string | null }[] | null } | null);
    const city = one(location?.city ?? null);
    return { category: one(row.category)?.slug ?? null, voivodeship: city?.voivodeship ?? null, city: city?.name ?? null };
  });
}
