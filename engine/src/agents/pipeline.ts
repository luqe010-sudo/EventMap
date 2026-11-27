// Geolocation, Quality, Content and Publisher agents.

import { writeDescriptions } from "../content.ts";
import { type Db, json, nowIso } from "../db.ts";
import { type EventFacts, titleSimilarity } from "../facts.ts";
import { assessQuality, classifyCategory, fallbackCategory, inPoland, sameOccurrence } from "../quality.ts";
import { getSource } from "../sources.ts";
import type { DefaultVenue } from "./discovery.ts";
import { audit, bumpMetric, metricsForDay, recall, remember, warsawDay } from "../store.ts";
import { archiveOwnedEvent, insertEvent, matchCity, sameDayEvents, updateOwnedEvent } from "../supabase.ts";
import { type AgentDefinition, DeferError, HOUR, PermanentError } from "./types.ts";

type CandidateRow = {
  id: number; source_id: number; external_id: string; fingerprint: string; facts: string; status: string; quality_score: number | null;
  category_slug: string | null; city_id: string | null; city_name: string | null; voivodeship: string | null; short_description: string | null;
  description: string | null; supabase_event_id: string | null; supabase_updated_at: string | null;
};

function loadCandidate(db: Db, id: number): { row: CandidateRow; facts: EventFacts } {
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id) as unknown as CandidateRow | undefined;
  if (!row) throw new PermanentError("Kandydat nie istnieje.");
  return { row, facts: json<EventFacts>(row.facts, null as unknown as EventFacts) };
}

function setCandidate(db: Db, id: number, patch: Record<string, string | number | null>): void {
  const keys = Object.keys(patch);
  db.prepare(`UPDATE candidates SET ${keys.map(key => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...keys.map(key => patch[key]), nowIso(), id);
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const MAX_KM_FROM_CITY = 35;

export const geoAgent: AgentDefinition = {
  name: "geo",
  title: "Geolocation Agent",
  description: "Dopasowuje miasto do tabeli cities (bez tworzenia nowych), weryfikuje lub geokoduje współrzędne (Nominatim, 1 req/s, cache) i odrzuca pinezki spoza miasta.",
  role: "worker",
  handlers: {
    async "geo.resolve"(job, ctx) {
      const loaded = loadCandidate(ctx.db, Number(job.payload.candidateId));
      const row = loaded.row;
      let facts = loaded.facts;
      if (row.status === "retracted") return { skipped: "retracted" };
      const source = getSource(ctx.db, row.source_id);
      const venue = recall<DefaultVenue | null>(ctx.db, "venue", String(row.source_id), null);
      if (venue && !facts.venueName && !facts.address) {
        // Single-venue source (verified in curated history) whose markup omits the location.
        facts = { ...facts, venueName: venue.name, address: venue.address, city: facts.city ?? venue.city, latitude: venue.latitude, longitude: venue.longitude };
      }
      const catalog = await ctx.services.catalog();
      if (!catalog) throw new DeferError("Brak dostępu do katalogu miast (Supabase).", HOUR);
      const cityName = facts.city ?? source?.city ?? null;
      const city = matchCity(catalog, cityName, source?.voivodeship);
      if (!city) {
        setCandidate(ctx.db, row.id, { status: "needs_city", city_name: cityName });
        if (cityName) {
          const missing = recall<Record<string, { name: string; voivodeship: string | null; count: number }>>(ctx.db, "geo", "missing_cities", {});
          const key = cityName.toLowerCase();
          missing[key] = { name: cityName, voivodeship: source?.voivodeship ?? null, count: (missing[key]?.count ?? 0) + 1 };
          remember(ctx.db, "geo", "missing_cities", missing);
        }
        bumpMetric(ctx.db, "needs_city");
        return { needsCity: cityName };
      }
      const near = (lat: number, lon: number) => inPoland(lat, lon) && (city.latitude == null || city.longitude == null || distanceKm(lat, lon, city.latitude, city.longitude) <= MAX_KM_FROM_CITY);
      let { latitude, longitude } = facts;
      if (latitude == null || longitude == null || !near(latitude, longitude)) {
        latitude = null; longitude = null;
        if (facts.venueName || facts.address) {
          const hit = await ctx.services.geocode({ venue: facts.venueName, street: facts.address, city: city.name, postalCode: facts.postalCode });
          if (hit && near(hit.lat, hit.lon)) { latitude = hit.lat; longitude = hit.lon; }
        }
      }
      if (latitude == null || longitude == null) {
        setCandidate(ctx.db, row.id, { status: "needs_geo", city_id: city.id, city_name: city.name, voivodeship: city.voivodeship });
        bumpMetric(ctx.db, "needs_geo");
        return { needsGeo: true };
      }
      const updated: EventFacts = { ...facts, latitude, longitude, city: city.name };
      setCandidate(ctx.db, row.id, { status: "geo_ok", facts: JSON.stringify(updated), city_id: city.id, city_name: city.name, voivodeship: city.voivodeship });
      ctx.enqueue("quality.check", { candidateId: row.id }, { dedupeKey: `quality:${row.id}`, priority: 44 });
      return { cityId: city.id };
    }
  }
};

export const qualityAgent: AgentDefinition = {
  name: "quality",
  title: "Quality Agent",
  description: "Waliduje fakty, liczy wynik jakości, przypisuje kategorię regułami i usuwa duplikaty między źródłami.",
  role: "worker",
  handlers: {
    async "quality.check"(job, ctx) {
      const { row, facts } = loadCandidate(ctx.db, Number(job.payload.candidateId));
      if (row.status === "retracted") return { skipped: "retracted" };
      if (row.supabase_event_id && facts.status === "cancelled") {
        ctx.enqueue("publish.cancel", { candidateId: row.id }, { dedupeKey: `cancel:${row.id}`, priority: 30 });
        return { cancellation: true };
      }
      const catalog = await ctx.services.catalog();
      if (!catalog) throw new DeferError("Brak katalogu kategorii.", HOUR);
      const available = new Set(catalog.categories.keys());
      let categorySlug = classifyCategory(facts, available);
      let categoryFromFallback = false;
      if (categorySlug === "inne" || !categorySlug) {
        const source = getSource(ctx.db, row.source_id);
        const fallback = fallbackCategory(facts, recall<string | null>(ctx.db, "default_category", String(row.source_id), null), source?.name ?? null, available);
        if (fallback) { categorySlug = fallback; categoryFromFallback = true; }
      }
      const { score, issues } = assessQuality(facts, { cityId: row.city_id, categorySlug, categoryFromFallback, now: ctx.now() });
      const blocking = issues.filter(issue => issue.blocking);
      if (blocking.length) {
        setCandidate(ctx.db, row.id, { status: "quality_failed", quality_score: score, quality_issues: JSON.stringify(issues), category_slug: categorySlug });
        bumpMetric(ctx.db, "quality_failed");
        return { failed: blocking.map(issue => issue.code) };
      }
      if (!row.supabase_event_id) {
        // Cross-source duplicate inside the engine: same occurrence or very similar title the same day in the same city.
        const others = ctx.db.prepare(`SELECT id, facts, city_name, quality_score FROM candidates
          WHERE city_id = ? AND id != ? AND source_id != ? AND status IN ('ready','published','pending_review','quality_ok')`).all(row.city_id, row.id, row.source_id) as Array<{ id: number; facts: string; city_name: string; quality_score: number | null }>;
        const city = row.city_name ?? "";
        const duplicate = others.find(other => {
          const otherFacts = json<EventFacts>(other.facts, null as unknown as EventFacts);
          if (!otherFacts) return false;
          return sameOccurrence({ title: facts.title, startAt: facts.startAt, city }, { title: otherFacts.title, startAt: otherFacts.startAt, city: other.city_name })
            || (titleSimilarity(facts.title, otherFacts.title) >= 0.8 && Math.abs(Date.parse(facts.startAt) - Date.parse(otherFacts.startAt)) <= 3 * HOUR);
        });
        if (duplicate) {
          setCandidate(ctx.db, row.id, { status: "duplicate", quality_score: score, quality_issues: JSON.stringify([{ code: "duplicate", blocking: true, message: `Duplikat kandydata ${duplicate.id}` }]) });
          bumpMetric(ctx.db, "duplicates");
          return { duplicateOf: duplicate.id };
        }
      }
      setCandidate(ctx.db, row.id, { status: "quality_ok", quality_score: score, quality_issues: JSON.stringify(issues), category_slug: categorySlug });
      ctx.db.prepare("UPDATE sources SET events_valid_total = events_valid_total + ? WHERE id = ?").run(row.supabase_event_id ? 0 : 1, row.source_id);
      ctx.enqueue("content.write", { candidateId: row.id }, { dedupeKey: `content:${row.id}`, priority: 43 });
      return { score, category: categorySlug };
    }
  }
};

export const contentAgent: AgentDefinition = {
  name: "content",
  title: "Content Agent",
  description: "Pisze własne krótkie opisy wyłącznie z faktów (szablony, bez modelu językowego). Nie czyta opisów źródła.",
  role: "worker",
  handlers: {
    async "content.write"(job, ctx) {
      const { row, facts } = loadCandidate(ctx.db, Number(job.payload.candidateId));
      if (row.status !== "quality_ok") return { skipped: row.status };
      const text = writeDescriptions(facts, row.category_slug ?? "inne", row.city_name ?? facts.city ?? "");
      setCandidate(ctx.db, row.id, { status: "ready", short_description: text.short, description: text.long });
      ctx.enqueue("publish.candidate", { candidateId: row.id }, { dedupeKey: `publish:${row.id}`, priority: 42 });
      return { ok: true };
    }
  }
};

function writtenToday(db: Db): number {
  const metrics = metricsForDay(db, warsawDay());
  return (metrics.events_published ?? 0) + (metrics.events_pending_review ?? 0);
}

export const publisherAgent: AgentDefinition = {
  name: "publisher",
  title: "Publisher",
  description: "Zapisuje gotowe wydarzenia do Supabase (pending_review lub publikacja wg trybu i progu jakości), aktualizuje zmiany, odwołania i wycofuje rekordy źródła.",
  role: "publisher",
  schedules: [{ jobType: "publish.sweep", everyMs: 15 * 60_000 }],
  handlers: {
    async "publish.sweep"(_job, ctx) {
      if (ctx.config.publishMode === "off") return { mode: "off" };
      const rows = ctx.db.prepare("SELECT id FROM candidates WHERE status = 'ready' ORDER BY quality_score DESC, id ASC LIMIT 500").all() as Array<{ id: number }>;
      for (const row of rows) ctx.enqueue("publish.candidate", { candidateId: row.id }, { dedupeKey: `publish:${row.id}`, priority: 42 });
      return { queued: rows.length };
    },

    async "publish.candidate"(job, ctx) {
      const mode = ctx.config.publishMode;
      if (mode === "off") return { mode };
      const { row, facts } = loadCandidate(ctx.db, Number(job.payload.candidateId));
      if (row.status !== "ready") return { skipped: row.status };
      const source = getSource(ctx.db, row.source_id);
      if (!source || !["active", "approved", "failing"].includes(source.status)) {
        setCandidate(ctx.db, row.id, { status: "skipped" });
        return { skipped: "source_not_active" };
      }
      const client = ctx.services.serviceDb;
      if (!client) throw new DeferError("Brak klucza serwisowego Supabase w kontenerze publisher.", 6 * HOUR);
      const catalog = await ctx.services.catalog();
      const categoryId = catalog?.categories.get(row.category_slug ?? "");
      if (!catalog || !categoryId || !row.city_id || !row.city_name) throw new DeferError("Brak katalogu lub kategorii.", HOUR);

      if (row.supabase_event_id) {
        const result = await updateOwnedEvent(client, row.supabase_event_id, row.supabase_updated_at, {
          start_at: facts.startAt, end_at: facts.endAt, is_all_day: facts.isAllDay, price_type: facts.priceType, price_min: facts.priceMin,
          price_max: facts.priceMax, currency: facts.currency, short_description: row.short_description, description: row.description
        });
        setCandidate(ctx.db, row.id, { status: result.applied ? "published" : "update_conflict", supabase_updated_at: result.updatedAt ?? row.supabase_updated_at });
        bumpMetric(ctx.db, result.applied ? "events_updated" : "update_conflicts");
        return { updated: result.applied };
      }

      if (mode !== "dry_run" && writtenToday(ctx.db) >= ctx.config.publishDailyCap) {
        throw new DeferError(`Dzienny limit zapisów (${ctx.config.publishDailyCap}) osiągnięty.`, 3 * HOUR);
      }
      const existing = await sameDayEvents(client, row.city_id, facts.startAt);
      const duplicate = existing.find(event => sameOccurrence({ title: event.title, startAt: event.start_at, city: row.city_name ?? "" }, { title: facts.title, startAt: facts.startAt, city: row.city_name ?? "" })
        || (titleSimilarity(event.title, facts.title) >= 0.8 && Math.abs(Date.parse(event.start_at) - Date.parse(facts.startAt)) <= 3 * HOUR));
      if (duplicate) {
        setCandidate(ctx.db, row.id, { status: "duplicate", quality_issues: JSON.stringify([{ code: "duplicate_supabase", blocking: true, message: `Istnieje wydarzenie ${duplicate.id}` }]) });
        bumpMetric(ctx.db, "duplicates");
        return { duplicateOf: duplicate.id };
      }
      const autopublish = mode === "publish" && source.autopublish === 1 && (row.quality_score ?? 0) >= ctx.config.autoPublishMinScore;
      if (mode === "dry_run") {
        ctx.log("info", `[dry-run] ${autopublish ? "publikacja" : "pending_review"}: ${facts.title} (${row.city_name}, ${facts.startAt})`);
        bumpMetric(ctx.db, "dry_run_ready");
        return { dryRun: true, autopublish };
      }
      const result = await insertEvent(client, {
        sourceId: source.id, sourceName: source.name ?? source.domain, facts, cityId: row.city_id, cityName: row.city_name, categoryId,
        shortDescription: row.short_description ?? "", description: row.description ?? "", publish: autopublish, checkedAt: nowIso()
      });
      setCandidate(ctx.db, row.id, { status: result.status, supabase_event_id: result.eventId, supabase_updated_at: result.updatedAt, published_at: result.status === "published" ? nowIso() : null });
      if (result.status === "published") {
        ctx.db.prepare("UPDATE sources SET events_published_total = events_published_total + 1 WHERE id = ?").run(source.id);
        bumpMetric(ctx.db, "events_published");
      } else bumpMetric(ctx.db, "events_pending_review");
      return { eventId: result.eventId, status: result.status };
    },

    async "publish.cancel"(job, ctx) {
      const { row } = loadCandidate(ctx.db, Number(job.payload.candidateId));
      const client = ctx.services.serviceDb;
      if (!client) throw new DeferError("Brak klucza serwisowego.", 6 * HOUR);
      if (!row.supabase_event_id || ctx.config.publishMode === "off" || ctx.config.publishMode === "dry_run") return { skipped: true };
      const result = await updateOwnedEvent(client, row.supabase_event_id, row.supabase_updated_at, { is_cancelled: true });
      setCandidate(ctx.db, row.id, { status: result.applied ? "cancelled" : "update_conflict", supabase_updated_at: result.updatedAt ?? row.supabase_updated_at });
      bumpMetric(ctx.db, result.applied ? "events_cancelled" : "update_conflicts");
      return { cancelled: result.applied };
    },

    async "publish.retract_source"(job, ctx) {
      const sourceId = Number(job.payload.sourceId);
      const client = ctx.services.serviceDb;
      if (!client) throw new DeferError("Brak klucza serwisowego.", 6 * HOUR);
      const rows = ctx.db.prepare("SELECT id, supabase_event_id FROM candidates WHERE source_id = ? AND supabase_event_id IS NOT NULL AND status != 'retracted'").all(sourceId) as Array<{ id: number; supabase_event_id: string }>;
      let archived = 0;
      for (const candidate of rows) {
        if (await archiveOwnedEvent(client, candidate.supabase_event_id, sourceId)) archived += 1;
        setCandidate(ctx.db, candidate.id, { status: "retracted" });
      }
      ctx.db.prepare("UPDATE candidates SET status = 'retracted' WHERE source_id = ?").run(sourceId);
      audit(ctx.db, String(job.payload.actor ?? "system"), "source.retracted", { sourceId, archived, candidates: rows.length });
      ctx.log("warn", `Wycofano źródło ${sourceId}: zarchiwizowano ${archived} wydarzeń.`);
      return { archived };
    }
  }
};
