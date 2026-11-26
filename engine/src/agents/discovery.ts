// Source Discovery: expands the source registry from legal, open datasets.
// - Wikidata (CC0): official websites of all Polish gminas/powiats (TERC code)
//   and of cultural/sports institutions.
// - Verified organiser domains from past curated batches (engine/data/seed-sources.json).
// Discovery only registers candidates; nothing is crawled before legal review.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eventDetailLinks, probeSite } from "../extract/discover.ts";
import { isBlockedDomain } from "../legal/policy.ts";
import { FetchRefused } from "../net/fetcher.ts";
import { domainOf, getSource, registerSource, updateSource, VOIVODESHIP_BY_TERC } from "../sources.ts";
import { recall, remember } from "../store.ts";
import { type AgentDefinition, DAY, PermanentError } from "./types.ts";

export const WIKIDATA_CLASSES: Record<string, { kind: string; qids: string[]; label: string }> = {
  culture: { kind: "institution", label: "instytucje kultury", qids: ["Q5061188", "Q3152824", "Q33506", "Q1595639", "Q207694", "Q7075", "Q24354", "Q153562", "Q1060829"] },
  festivals: { kind: "organizer", label: "festiwale", qids: ["Q868557", "Q132241"] },
  sports: { kind: "organizer", label: "kluby sportowe", qids: ["Q476028", "Q847017"] },
  cities: { kind: "municipality", label: "miasta", qids: ["Q515", "Q3957", "Q925381"] }
};

type Binding = Record<string, { value: string } | undefined>;

export type DefaultVenue = { name: string; address: string; city: string; latitude: number; longitude: number };

function sparqlMunicipalities(limit: number, offset: number): string {
  return `SELECT ?i ?iLabel ?site ?terc WHERE { ?i wdt:P1653 ?terc ; wdt:P856 ?site . FILTER NOT EXISTS { ?i wdt:P576 ?dissolved } SERVICE wikibase:label { bd:serviceParam wikibase:language "pl". } } ORDER BY ?terc LIMIT ${limit} OFFSET ${offset}`;
}

function sparqlClass(qids: string[], limit: number, offset: number): string {
  return `SELECT ?i ?iLabel ?site ?terc ?admLabel WHERE { VALUES ?cls { ${qids.map(q => `wd:${q}`).join(" ")} } ?i wdt:P31 ?cls ; wdt:P17 wd:Q36 ; wdt:P856 ?site . FILTER NOT EXISTS { ?i wdt:P576 ?dissolved } OPTIONAL { ?i wdt:P131 ?adm . OPTIONAL { ?adm wdt:P1653 ?terc } } SERVICE wikibase:label { bd:serviceParam wikibase:language "pl". } } ORDER BY ?i LIMIT ${limit} OFFSET ${offset}`;
}

export function voivodeshipFromTerc(terc: string | null | undefined): string | null {
  return terc ? VOIVODESHIP_BY_TERC[terc.slice(0, 2)] ?? null : null;
}

export const discoveryAgent: AgentDefinition = {
  name: "discovery",
  title: "Source Discovery",
  description: "Wyszukuje nowe źródła: Wikidata (CC0) — strony gmin, powiatów i instytucji; zweryfikowane domeny organizatorów; sondowanie stron pod kątem kalendarzy ICS/RSS/schema.org.",
  role: "worker",
  schedules: [
    { jobType: "discovery.seed", everyMs: 7 * DAY },
    { jobType: "discovery.wikidata_cycle", everyMs: 7 * DAY },
    { jobType: "discovery.probe_due", everyMs: 15 * 60_000 }
  ],
  handlers: {
    async "discovery.seed"(_job, ctx) {
      const path = fileURLToPath(new URL("../../data/seed-sources.json", import.meta.url));
      if (!existsSync(path)) return { registered: 0, note: "brak pliku seed" };
      const seeds = JSON.parse(readFileSync(path, "utf8")) as Array<{ url: string; name?: string; city?: string; kind?: string; venue?: DefaultVenue; category?: string }>;
      let created = 0;
      for (const seed of seeds) {
        if (isBlockedDomain(domainOf(seed.url))) continue;
        const result = registerSource(ctx.db, { url: seed.url, name: seed.name, city: seed.city, kind: seed.kind ?? "organizer", discoveredVia: "curated_history", priority: 50 });
        if (result?.created) created += 1;
        // Venue verified in earlier curated batches: used when a page's schema.org lacks a location.
        if (result && seed.venue) remember(ctx.db, "venue", String(result.id), seed.venue);
        // Dominant category of this organiser in curated history (≥70% of its events).
        if (result) remember(ctx.db, "default_category", String(result.id), seed.category ?? null);
      }
      ctx.log("info", `Seed: zarejestrowano ${created} nowych źródeł z historii kuratorskiej.`);
      return { registered: created };
    },

    async "discovery.wikidata_cycle"(_job, ctx) {
      ctx.enqueue("discovery.wikidata", { set: "municipalities", offset: 0 }, { dedupeKey: "wd:municipalities:0", priority: 80 });
      for (const key of Object.keys(WIKIDATA_CLASSES)) ctx.enqueue("discovery.wikidata", { set: key, offset: 0 }, { dedupeKey: `wd:${key}:0`, priority: 85 });
      return { queued: Object.keys(WIKIDATA_CLASSES).length + 1 };
    },

    async "discovery.wikidata"(job, ctx) {
      const set = String(job.payload.set);
      const offset = Number(job.payload.offset ?? 0);
      const limit = 500;
      const priorityBoost = (job.payload.voivodeships as string[] | undefined) ?? [];
      const query = set === "municipalities" ? sparqlMunicipalities(limit, offset) : WIKIDATA_CLASSES[set] ? sparqlClass(WIKIDATA_CLASSES[set].qids, limit, offset) : null;
      if (!query) throw new PermanentError(`Nieznany zbiór Wikidata: ${set}`);
      const url = `${ctx.config.wikidataSparqlUrl}?format=json&query=${encodeURIComponent(query)}`;
      const result = await ctx.fetcher.get(url, { accept: "application/sparql-results+json", skipRobots: true });
      if (!result.ok) throw new Error(`Wikidata HTTP ${result.status}`);
      const rows = (JSON.parse(result.body) as { results: { bindings: Binding[] } }).results.bindings;
      let created = 0;
      const kind = set === "municipalities" ? "municipality" : WIKIDATA_CLASSES[set].kind;
      for (const row of rows) {
        const site = row.site?.value;
        if (!site || isBlockedDomain(safeDomain(site))) continue;
        const terc = row.terc?.value ?? null;
        const voivodeship = voivodeshipFromTerc(terc);
        const registered = registerSource(ctx.db, {
          url: site, name: row.iLabel?.value ?? null, kind, teryt: terc, voivodeship, city: row.admLabel?.value ?? null,
          wikidataId: row.i?.value.split("/").pop() ?? null, discoveredVia: `wikidata:${set}`,
          priority: voivodeship && priorityBoost.includes(voivodeship) ? 60 : 100
        });
        if (registered?.created) created += 1;
      }
      remember(ctx.db, "discovery", `wikidata:${set}`, { offset, rows: rows.length, created, at: ctx.now().toISOString() });
      if (rows.length === limit) ctx.enqueue("discovery.wikidata", { set, offset: offset + limit, voivodeships: priorityBoost }, { dedupeKey: `wd:${set}:${offset + limit}`, priority: 85 });
      ctx.log("info", `Wikidata ${set} offset ${offset}: ${rows.length} rekordów, ${created} nowych źródeł.`);
      return { rows: rows.length, created };
    },

    async "discovery.probe_due"(_job, ctx) {
      // Probe a bounded number of discovered sources per tick (priority first).
      const rows = ctx.db.prepare("SELECT id FROM sources WHERE status = 'discovered' ORDER BY priority ASC, id ASC LIMIT 40").all() as Array<{ id: number }>;
      for (const row of rows) {
        updateSource(ctx.db, row.id, { status: "probing" });
        ctx.enqueue("discovery.probe", { sourceId: row.id }, { dedupeKey: `probe:${row.id}`, priority: 90 });
      }
      // Re-probe sources without integration after 30 days.
      const stale = ctx.db.prepare("SELECT id FROM sources WHERE status = 'no_integration' AND updated_at < ? LIMIT 20").all(new Date(ctx.now().getTime() - 30 * DAY).toISOString()) as Array<{ id: number }>;
      for (const row of stale) ctx.enqueue("discovery.probe", { sourceId: row.id }, { dedupeKey: `probe:${row.id}`, priority: 120 });
      return { probing: rows.length, reprobe: stale.length };
    },

    async "discovery.probe"(job, ctx) {
      const source = getSource(ctx.db, Number(job.payload.sourceId));
      if (!source) throw new PermanentError("Źródło nie istnieje.");
      try {
        const home = await ctx.fetcher.get(source.url);
        if (!home.ok) throw new Error(`HTTP ${home.status}`);
        const probe = probeSite(home.body, home.url);
        // Second hop: the first listing page often carries the feed links / JSON-LD.
        if (!probe.icsFeeds.length && !probe.hasJsonLdEvents && probe.listingPages[0]) {
          try {
            const listing = await ctx.fetcher.get(probe.listingPages[0]);
            if (listing.ok) {
              const inner = probeSite(listing.body, listing.url);
              probe.icsFeeds.push(...inner.icsFeeds);
              probe.rssFeeds.push(...inner.rssFeeds);
              if (inner.hasJsonLdEvents) { probe.hasJsonLdEvents = true; probe.listingPages.unshift(listing.url); }
              else {
                // Many venues publish schema.org Event only on detail pages: sample two of them.
                for (const link of eventDetailLinks(listing.body, listing.url).slice(0, 2)) {
                  const detail = await ctx.fetcher.get(link).catch(() => null);
                  if (detail?.ok && probeSite(detail.body, detail.url).hasJsonLdEvents) {
                    probe.hasJsonLdEvents = true;
                    probe.listingPages.unshift(listing.url);
                    break;
                  }
                }
                if (!probe.hasJsonLdEvents && inner.listingPages.length) probe.listingPages.push(...inner.listingPages);
              }
            }
          } catch (error) { if (!(error instanceof FetchRefused)) throw error; }
        }
        remember(ctx.db, "probe", String(source.id), { ...probe, tdmMeta: /<meta[^>]+name=["']tdm-reservation["'][^>]+content=["']1/i.test(home.body), homeExcerpt: home.body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 20000), at: ctx.now().toISOString() });
        updateSource(ctx.db, source.id, { name: source.name ?? probe.title, status: "legal_review", last_error: null });
        ctx.enqueue("legal.review", { sourceId: source.id }, { dedupeKey: `legal:${source.id}`, priority: 70 });
        return { ics: probe.icsFeeds.length, rss: probe.rssFeeds.length, jsonld: probe.hasJsonLdEvents, listings: probe.listingPages.length };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof FetchRefused && ["robots", "access_denied", "captcha", "blocked_address", "bad_url"].includes(error.code)) {
          updateSource(ctx.db, source.id, { status: "blocked", legal_rule: error.code === "robots" ? "L2_robots" : null, legal_basis: message, last_error: message });
          return { blocked: error.code };
        }
        const attempts = recall<number>(ctx.db, "probe_failures", String(source.id), 0) + 1;
        remember(ctx.db, "probe_failures", String(source.id), attempts);
        if (attempts >= 3) { updateSource(ctx.db, source.id, { status: "no_integration", last_error: message }); return { gaveUp: message }; }
        updateSource(ctx.db, source.id, { status: "discovered", last_error: message });
        throw error;
      }
    }
  }
};

function safeDomain(url: string): string {
  try { return domainOf(url); } catch { return ""; }
}
