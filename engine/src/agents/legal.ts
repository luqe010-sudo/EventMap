// Legal Compliance agent: decides whether a source may be used, based on the
// rule set in legal/policy.ts. Default is blocked; approval only by an
// owner-approved rule or an explicit owner decision.

import { cleanText } from "../facts.ts";
import { evaluateSource, isPublicSectorDomain, LEGAL_RULES, LEGAL_RULES_VERSION } from "../legal/policy.ts";
import { FetchRefused } from "../net/fetcher.ts";
import { getSource, updateSource } from "../sources.ts";
import { getMeta, latestResolution, recall, requestDecision } from "../store.ts";
import type { Db } from "../db.ts";
import { type AgentDefinition, PermanentError } from "./types.ts";

export function approvedLegalRules(db: Db): Set<string> {
  const raw = getMeta(db, "legal_rules");
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as { version: string; approved: string[] };
    return parsed.version === LEGAL_RULES_VERSION ? new Set(parsed.approved) : new Set();
  } catch { return new Set(); }
}

type Probe = { tribeApi?: string | null; icsFeeds: string[]; rssFeeds: string[]; listingPages: string[]; hasJsonLdEvents: boolean; termsPages: string[]; tdmMeta: boolean; homeExcerpt: string };

export const legalAgent: AgentDefinition = {
  name: "legal",
  title: "Legal Compliance",
  description: "Weryfikuje robots.txt, regulaminy, zastrzeżenia TDM i licencje. Akceptuje automatycznie tylko według reguł zatwierdzonych przez właściciela; resztę kieruje do kolejki decyzji.",
  role: "worker",
  schedules: [{ jobType: "legal.recheck_due", everyMs: 6 * 3600_000 }],
  handlers: {
    async "legal.review"(job, ctx) {
      const source = getSource(ctx.db, Number(job.payload.sourceId));
      if (!source) throw new PermanentError("Źródło nie istnieje.");
      const probe = recall<Probe | null>(ctx.db, "probe", String(source.id), null);
      if (!probe) { ctx.enqueue("discovery.probe", { sourceId: source.id }, { dedupeKey: `probe:${source.id}` }); return { reprobe: true }; }
      const integration = probe.tribeApi ? "json_api" : probe.icsFeeds.length ? "ics" : probe.hasJsonLdEvents ? "jsonld" : probe.rssFeeds.length ? "rss" : "unknown";
      const feedUrl = probe.tribeApi ?? probe.icsFeeds[0] ?? (probe.hasJsonLdEvents ? probe.listingPages[0] ?? source.url : probe.rssFeeds[0]) ?? null;
      let robotsAllowsHome = false;
      let robotsAllowsFeed: boolean | null = null;
      try {
        robotsAllowsHome = await ctx.fetcher.robotsAllows(source.url);
        robotsAllowsFeed = feedUrl ? await ctx.fetcher.robotsAllows(feedUrl) : null;
      } catch (error) {
        if (!(error instanceof FetchRefused)) throw error;
      }
      const termsTexts: string[] = [];
      for (const page of probe.termsPages.slice(0, 2)) {
        try {
          const response = await ctx.fetcher.get(page);
          if (response.ok) termsTexts.push(cleanText(response.body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "), 60000) ?? "");
        } catch (error) { if (!(error instanceof FetchRefused)) throw error; }
      }
      let tdmReserved = probe.tdmMeta;
      try {
        const tdm = await ctx.fetcher.get(new URL("/.well-known/tdmrep.json", source.url).toString(), { accept: "application/json" });
        if (tdm.ok && /"tdm-reservation"\s*:\s*1/.test(tdm.body)) tdmReserved = true;
      } catch { /* absent file is the norm */ }
      const owner = latestResolution(ctx.db, "source_approval", "source", String(source.id));
      const verdict = evaluateSource({
        domain: source.domain, kind: source.kind, integration, robotsAllowsHome, robotsAllowsFeed, tdmReserved, termsTexts,
        pageText: probe.homeExcerpt, isPublicSector: isPublicSectorDomain(source.domain, source.kind),
        ownerDecision: owner ? (owner.status === "approved" ? "approved" : "rejected") : null
      }, approvedLegalRules(ctx.db));
      const evidence = JSON.stringify({ evidence: verdict.evidence, license: verdict.license, robotsAllowsHome, robotsAllowsFeed, tdmReserved, termsPages: probe.termsPages, rulesVersion: LEGAL_RULES_VERSION });
      const common = {
        legal_rule: verdict.rule === "none" ? verdict.wouldApproveBy : verdict.rule, legal_basis: verdict.basis, legal_evidence: evidence,
        legal_reviewed_at: ctx.now().toISOString(), integration_type: integration, feed_url: feedUrl
      };
      if (verdict.outcome === "approved") {
        updateSource(ctx.db, source.id, { ...common, status: "approved" });
        ctx.enqueue("integration.activate", { sourceId: source.id }, { dedupeKey: `activate:${source.id}`, priority: 60 });
      } else if (verdict.outcome === "blocked") {
        updateSource(ctx.db, source.id, { ...common, status: "blocked" });
      } else {
        updateSource(ctx.db, source.id, { ...common, status: "needs_owner" });
        // Sources that would pass an unapproved rule are grouped under the rule-set decision
        // instead of flooding the queue with thousands of identical items.
        if (verdict.wouldApproveBy && verdict.rule === "none") {
          requestDecision(ctx.db, "legal_ruleset", "rules", LEGAL_RULES_VERSION, "Zatwierdź reguły automatycznej akceptacji źródeł",
            { version: LEGAL_RULES_VERSION, rules: LEGAL_RULES });
        } else {
          requestDecision(ctx.db, "source_approval", "source", String(source.id), `Źródło ${source.domain}: ${verdict.basis}`.slice(0, 300),
            { url: source.url, name: source.name, kind: source.kind, integration, feedUrl, basis: verdict.basis, evidence: verdict.evidence, license: verdict.license });
        }
      }
      return { outcome: verdict.outcome, rule: verdict.rule, would: verdict.wouldApproveBy };
    },

    async "legal.recheck_due"(_job, ctx) {
      // Re-check approved/active sources every 90 days and sources waiting for the rule set when it changes.
      const cutoff = new Date(ctx.now().getTime() - 90 * 86400_000).toISOString();
      const due = ctx.db.prepare("SELECT id FROM sources WHERE status IN ('active','approved') AND (legal_reviewed_at IS NULL OR legal_reviewed_at < ?) LIMIT 50").all(cutoff) as Array<{ id: number }>;
      const rules = approvedLegalRules(ctx.db);
      const waiting = rules.size
        ? ctx.db.prepare(`SELECT id FROM sources WHERE status = 'needs_owner' AND legal_rule IN (${[...rules].map(() => "?").join(",")}) LIMIT 500`).all(...rules) as Array<{ id: number }>
        : [];
      for (const row of [...due, ...waiting]) ctx.enqueue("legal.review", { sourceId: row.id }, { dedupeKey: `legal:${row.id}`, priority: 75 });
      return { recheck: due.length, released: waiting.length };
    }
  }
};
