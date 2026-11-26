// Integration, Crawler and Extraction agents — all deterministic code.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "../db.ts";
import { nowIso } from "../db.ts";
import { eventDetailLinks, parseRss } from "../extract/discover.ts";
import { parseIcs } from "../extract/ics.ts";
import { type DomainQuirks, extractJsonLdEvents } from "../extract/jsonld.ts";
import { mergeDailySeries, unionSeries } from "../extract/series.ts";
import { parseTribe } from "../extract/tribe.ts";
import { type EventFacts, occurrenceFingerprint, sha256 } from "../facts.ts";
import { FetchRefused } from "../net/fetcher.ts";
import { getSource, type SourceRow, updateSource } from "../sources.ts";
import { bumpMetric, recall, remember, resolveIncidents } from "../store.ts";
import { type AgentContext, type AgentDefinition, DAY, HOUR, PermanentError } from "./types.ts";

const MAX_DETAIL_PAGES_PER_CRAWL = 30;
const RAW_BODY_LIMIT = 2_000_000;

let fileQuirks: Record<string, DomainQuirks> | null = null;

export function quirksFor(db: Db, domain: string): DomainQuirks {
  if (!fileQuirks) {
    const path = fileURLToPath(new URL("../../data/domain-quirks.json", import.meta.url));
    fileQuirks = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Record<string, DomainQuirks> : {};
  }
  return { ...(fileQuirks[domain] ?? {}), ...recall<DomainQuirks>(db, "quirks", domain, {}) };
}

export type Extraction = { events: EventFacts[]; detailLinks: string[]; skipped: number };

export function extractFromBody(integration: string, body: string, url: string, quirks: DomainQuirks, now: Date = new Date()): Extraction {
  const future = (events: EventFacts[]) => mergeDailySeries(events.filter(event => Date.parse(event.startAt) > now.getTime())).slice(0, 500);
  if (integration === "json_api" || /^\s*\{[\s\S]{0,200}"events"\s*:/.test(body.slice(0, 400))) {
    const result = parseTribe(body);
    // The API paginates; the next page is followed like a detail link (same domain only).
    return { events: future(result.events), detailLinks: result.nextPage ? [result.nextPage] : [], skipped: result.skipped };
  }
  if (integration === "ics" || /^BEGIN:VCALENDAR/m.test(body.slice(0, 2000))) {
    const result = parseIcs(body, url);
    return { events: future(result.events), detailLinks: [], skipped: result.skipped + result.skippedRecurring };
  }
  if (integration === "rss" && /<(rss|feed)\b/i.test(body.slice(0, 5000))) {
    const items = parseRss(body, url);
    return { events: [], detailLinks: items.map(item => item.link), skipped: 0 };
  }
  const result = extractJsonLdEvents(body, url, quirks);
  return { events: future(result.events), detailLinks: result.events.length ? [] : eventDetailLinks(body, url), skipped: result.skipped };
}

function storeRaw(db: Db, sourceId: number, url: string, contentType: string | null, body: string): number {
  const result = db.prepare("INSERT INTO raw_items (source_id, url, content_type, content_hash, bytes, body, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(sourceId, url, contentType, sha256(body), Buffer.byteLength(body), body.slice(0, RAW_BODY_LIMIT), nowIso());
  return Number(result.lastInsertRowid);
}

export function upsertCandidate(db: Db, source: SourceRow, observed: EventFacts, rawItemId: number | null, nowDate: Date = new Date()): { id: number; isNew: boolean; changed: boolean } {
  const now = nowIso(nowDate);
  const existing = db.prepare("SELECT id, facts, status, source_hash FROM candidates WHERE source_id = ? AND external_id = ?").get(source.id, observed.externalId) as { id: number; facts: string; status: string; source_hash: string | null } | undefined;
  // A merged series seen in parts (API pagination) keeps the union of its range.
  const facts = existing && observed.externalId.startsWith("series:") ? unionSeries(JSON.parse(existing.facts) as EventFacts, observed, nowDate) : observed;
  const factsJson = JSON.stringify(facts);
  const sourceHash = sha256(factsJson);
  const fingerprint = occurrenceFingerprint(facts.title, facts.city ?? source.city ?? "", facts.startAt);
  if (existing) {
    if (existing.source_hash === sourceHash) {
      db.prepare("UPDATE candidates SET last_seen_at = ? WHERE id = ?").run(now, existing.id);
      return { id: existing.id, isNew: false, changed: false };
    }
    db.prepare("UPDATE candidates SET facts = ?, source_hash = ?, fingerprint = ?, status = CASE WHEN status = 'retracted' THEN status ELSE 'extracted' END, last_seen_at = ?, updated_at = ? WHERE id = ?")
      .run(factsJson, sourceHash, fingerprint, now, now, existing.id);
    db.prepare("INSERT INTO provenance (candidate_id, source_id, raw_item_id, url, content_hash, legal_rule, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(existing.id, source.id, rawItemId, facts.url, sha256(factsJson), source.legal_rule, now);
    return { id: existing.id, isNew: false, changed: true };
  }
  const result = db.prepare(`INSERT INTO candidates (source_id, external_id, fingerprint, facts, source_hash, status, first_seen_at, last_seen_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'extracted', ?, ?, ?)`).run(source.id, facts.externalId, fingerprint, factsJson, sourceHash, now, now, now);
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO provenance (candidate_id, source_id, raw_item_id, url, content_hash, legal_rule, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, source.id, rawItemId, facts.url, sha256(factsJson), source.legal_rule, now);
  return { id, isNew: true, changed: true };
}

function requireUsable(ctx: AgentContext, id: number): SourceRow {
  const source = getSource(ctx.db, id);
  if (!source) throw new PermanentError("Źródło nie istnieje.");
  if (!["approved", "active", "failing"].includes(source.status)) throw new PermanentError(`Źródło ma status ${source.status}; pobieranie zablokowane.`);
  return source;
}

export const integrationAgent: AgentDefinition = {
  name: "integration",
  title: "Integration Agent",
  description: "Dobiera kanał integracji (ICS > schema.org JSON-LD > RSS), testuje ekstrakcję i aktywuje źródło z harmonogramem.",
  role: "worker",
  handlers: {
    async "integration.activate"(job, ctx) {
      const source = requireUsable(ctx, Number(job.payload.sourceId));
      const probe = recall<{ tribeApi?: string | null; icsFeeds: string[]; rssFeeds: string[]; listingPages: string[]; hasJsonLdEvents: boolean } | null>(ctx.db, "probe", String(source.id), null);
      const channels: Array<{ type: string; url: string }> = [];
      if (probe?.tribeApi) channels.push({ type: "json_api", url: probe.tribeApi });
      for (const url of probe?.icsFeeds ?? []) channels.push({ type: "ics", url });
      if (probe?.hasJsonLdEvents) for (const url of probe.listingPages.length ? probe.listingPages : [source.url]) channels.push({ type: "jsonld", url });
      for (const url of probe?.listingPages ?? []) channels.push({ type: "jsonld", url });
      for (const url of probe?.rssFeeds ?? []) channels.push({ type: "rss", url });
      const quirks = quirksFor(ctx.db, source.domain);
      const tried = new Set<string>();
      for (const channel of channels) {
        if (tried.has(channel.url)) continue;
        tried.add(channel.url);
        try {
          const response = await ctx.fetcher.get(channel.url);
          if (!response.ok) continue;
          let extraction = extractFromBody(channel.type, response.body, response.url, quirks, ctx.now());
          if (!extraction.events.length && extraction.detailLinks.length) {
            for (const link of extraction.detailLinks.slice(0, 3)) {
              const detail = await ctx.fetcher.get(link).catch(() => null);
              if (detail?.ok) {
                const inner = extractFromBody("jsonld", detail.body, detail.url, quirks, ctx.now());
                if (inner.events.length) { extraction = { ...extraction, events: inner.events }; break; }
              }
            }
          }
          if (!extraction.events.length) continue;
          const integration = channel.type === "rss" ? "rss" : channel.type;
          updateSource(ctx.db, source.id, { status: "active", integration_type: integration, feed_url: channel.url, next_crawl_at: ctx.now().toISOString(), consecutive_failures: 0, last_error: null });
          remember(ctx.db, "extraction_methods", source.domain, { integration, feedUrl: channel.url, sampleEvents: extraction.events.length, at: ctx.now().toISOString() });
          ctx.log("info", `Aktywowano ${source.domain} (${integration}), próbka ${extraction.events.length} wydarzeń.`);
          return { activated: integration, sample: extraction.events.length };
        } catch (error) {
          if (error instanceof FetchRefused && error.code !== "robots") continue;
          if (error instanceof FetchRefused) { updateSource(ctx.db, source.id, { status: "blocked", legal_rule: "L2_robots", legal_basis: error.message }); return { blocked: "robots" }; }
          throw error;
        }
      }
      updateSource(ctx.db, source.id, { status: "no_integration", last_error: "Brak kanału z przyszłymi wydarzeniami (ICS/JSON-LD/RSS)." });
      return { activated: null };
    }
  }
};

export const crawlerAgent: AgentDefinition = {
  name: "crawler",
  title: "Crawler",
  description: "Cyklicznie pobiera dozwolone kanały (warunkowe GET, limity na host, robots.txt), zapisuje surowe dane do ekstrakcji.",
  role: "worker",
  schedules: [{ jobType: "crawl.due", everyMs: 5 * 60_000 }],
  handlers: {
    async "crawl.due"(_job, ctx) {
      const due = ctx.db.prepare("SELECT id FROM sources WHERE status IN ('active','failing') AND (next_crawl_at IS NULL OR next_crawl_at <= ?) ORDER BY priority ASC, next_crawl_at ASC LIMIT 200")
        .all(ctx.now().toISOString()) as Array<{ id: number }>;
      let queued = 0;
      for (const row of due) if (ctx.enqueue("crawl.source", { sourceId: row.id }, { dedupeKey: `crawl:${row.id}`, priority: 50 })) queued += 1;
      return { due: due.length, queued };
    },

    async "crawl.source"(job, ctx) {
      const source = requireUsable(ctx, Number(job.payload.sourceId));
      if (!source.feed_url) throw new PermanentError("Brak feed_url.");
      const started = ctx.now();
      try {
        const response = await ctx.fetcher.get(source.feed_url, { etag: source.etag, lastModified: source.last_modified });
        const nextInterval = (factor: number) => Math.min(7 * DAY, Math.max(6 * HOUR, Math.round(source.crawl_interval_ms * factor)));
        if (response.notModified) {
          const interval = nextInterval(1.5);
          updateSource(ctx.db, source.id, { last_crawl_at: started.toISOString(), last_success_at: started.toISOString(), consecutive_failures: 0, crawl_interval_ms: interval, next_crawl_at: new Date(started.getTime() + interval).toISOString(), status: "active", last_error: null });
          bumpMetric(ctx.db, "crawl_not_modified");
          return { notModified: true };
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const hash = sha256(response.body);
        const unchanged = hash === source.content_hash;
        const interval = unchanged ? nextInterval(1.5) : nextInterval(0.75);
        updateSource(ctx.db, source.id, {
          last_crawl_at: started.toISOString(), last_success_at: started.toISOString(), consecutive_failures: 0, etag: response.etag,
          last_modified: response.lastModified, content_hash: hash, crawl_interval_ms: interval, next_crawl_at: new Date(started.getTime() + interval).toISOString(),
          status: "active", last_error: null
        });
        resolveIncidents(ctx.db, "source_failing", source.id);
        bumpMetric(ctx.db, "crawl_ok");
        if (unchanged) return { unchanged: true };
        const rawId = storeRaw(ctx.db, source.id, response.url, response.contentType, response.body);
        ctx.enqueue("extract.raw", { rawItemId: rawId, listing: true }, { priority: 40 });
        return { rawItemId: rawId, bytes: response.bytes };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failures = source.consecutive_failures + 1;
        updateSource(ctx.db, source.id, {
          last_crawl_at: started.toISOString(), consecutive_failures: failures, last_error: message.slice(0, 500),
          status: failures >= 3 ? "failing" : source.status, next_crawl_at: new Date(started.getTime() + Math.min(DAY, HOUR * 2 ** failures)).toISOString()
        });
        bumpMetric(ctx.db, "crawl_failed");
        if (error instanceof FetchRefused && error.code === "robots") {
          updateSource(ctx.db, source.id, { status: "blocked", legal_rule: "L2_robots", legal_basis: message });
          return { blocked: "robots" };
        }
        if (error instanceof FetchRefused) return { refused: error.code };
        return { failed: message };
      }
    },

    async "crawl.page"(job, ctx) {
      const source = requireUsable(ctx, Number(job.payload.sourceId));
      const url = String(job.payload.url);
      if (new URL(url).hostname.replace(/^www\./, "").split(".").slice(-2).join(".") !== source.domain.split(".").slice(-2).join(".")) throw new PermanentError("Strona spoza domeny źródła.");
      try {
        const response = await ctx.fetcher.get(url);
        ctx.db.prepare("INSERT INTO pages (url, source_id, last_fetched_at, content_hash) VALUES (?, ?, ?, ?) ON CONFLICT(url) DO UPDATE SET last_fetched_at = excluded.last_fetched_at, content_hash = excluded.content_hash")
          .run(url, source.id, nowIso(), response.ok ? sha256(response.body) : null);
        if (!response.ok) return { status: response.status };
        const rawId = storeRaw(ctx.db, source.id, response.url, response.contentType, response.body);
        ctx.enqueue("extract.raw", { rawItemId: rawId, listing: false }, { priority: 40 });
        return { rawItemId: rawId };
      } catch (error) {
        if (error instanceof FetchRefused) return { refused: error.code };
        throw error;
      }
    }
  }
};

export const extractionAgent: AgentDefinition = {
  name: "extraction",
  title: "Extraction Agent",
  description: "Wyodrębnia fakty (tytuł, termin, miejsce, cena, status) z ICS i schema.org — bez opisów i obrazów źródła.",
  role: "worker",
  handlers: {
    async "extract.raw"(job, ctx) {
      const raw = ctx.db.prepare("SELECT id, source_id, url, body FROM raw_items WHERE id = ?").get(Number(job.payload.rawItemId)) as { id: number; source_id: number; url: string; body: string } | undefined;
      if (!raw) throw new PermanentError("Brak surowego rekordu.");
      const source = getSource(ctx.db, raw.source_id);
      if (!source) throw new PermanentError("Źródło nie istnieje.");
      const extraction = extractFromBody(job.payload.listing ? source.integration_type : "jsonld", raw.body, raw.url, quirksFor(ctx.db, source.domain), ctx.now());
      let fresh = 0;
      let changed = 0;
      for (const facts of extraction.events) {
        const result = upsertCandidate(ctx.db, source, facts, raw.id, ctx.now());
        if (result.isNew) fresh += 1;
        if (result.changed) { changed += 1; ctx.enqueue("geo.resolve", { candidateId: result.id }, { dedupeKey: `geo:${result.id}`, priority: 45 }); }
      }
      const apiPage = source.integration_type === "json_api";
      if ((job.payload.listing || apiPage) && extraction.detailLinks.length) {
        const recentCutoff = new Date(ctx.now().getTime() - 7 * DAY).toISOString();
        let queued = 0;
        for (const link of extraction.detailLinks) {
          if (queued >= MAX_DETAIL_PAGES_PER_CRAWL) break;
          const seen = ctx.db.prepare("SELECT last_fetched_at FROM pages WHERE url = ?").get(link) as { last_fetched_at: string } | undefined;
          if (seen && seen.last_fetched_at > recentCutoff) continue;
          if (ctx.enqueue("crawl.page", { sourceId: source.id, url: link }, { dedupeKey: `page:${link}`, priority: 55 })) queued += 1;
        }
      }
      ctx.db.prepare("UPDATE raw_items SET status = 'processed' WHERE id = ?").run(raw.id);
      if (job.payload.listing) {
        const yieldNow = extraction.events.length + extraction.detailLinks.length;
        ctx.db.prepare("UPDATE sources SET last_yield = ?, best_yield = MAX(best_yield, ?), events_found_total = events_found_total + ? WHERE id = ?")
          .run(yieldNow, yieldNow, fresh, source.id);
      } else if (fresh) {
        ctx.db.prepare("UPDATE sources SET events_found_total = events_found_total + ? WHERE id = ?").run(fresh, source.id);
      }
      // Keep only the last 5 raw items per source as diagnostic fixtures.
      ctx.db.prepare("DELETE FROM raw_items WHERE source_id = ? AND id NOT IN (SELECT id FROM raw_items WHERE source_id = ? ORDER BY id DESC LIMIT 5)").run(source.id, source.id);
      bumpMetric(ctx.db, "events_extracted", fresh);
      bumpMetric(ctx.db, "events_changed", changed - fresh);
      return { events: extraction.events.length, fresh, changed, detailLinks: extraction.detailLinks.length };
    }
  }
};
