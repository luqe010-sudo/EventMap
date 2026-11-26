// Supervisor housekeeping, Maintenance, Growth and Financial Controller agents.

import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { costSummary } from "../budget.ts";
import { backupTo, nowIso } from "../db.ts";
import { pruneJobs, queueStats, requeueExpired } from "../queue.ts";
import { sourceCounts, updateSource, VOIVODESHIPS } from "../sources.ts";
import { listAgents, listDecisions, metricsForDay, openIncident, recall, remember, requestDecision, warsawDay } from "../store.ts";
import { upcomingCoverage } from "../supabase.ts";
import { type AgentDefinition, DAY, DeferError, HOUR } from "./types.ts";

export const supervisorAgent: AgentDefinition = {
  name: "supervisor",
  title: "Supervisor",
  description: "Zarządza kolejką, harmonogramami, priorytetami i retencją; generuje raport dzienny; pilnuje wyłącznika awaryjnego i pauz agentów.",
  role: "worker",
  schedules: [
    { jobType: "supervisor.housekeeping", everyMs: 10 * 60_000 },
    { jobType: "supervisor.daily_report", everyMs: HOUR }
  ],
  handlers: {
    async "supervisor.housekeeping"(_job, ctx) {
      const requeued = requeueExpired(ctx.db);
      const pruned = pruneJobs(ctx.db, 14);
      const cutoff = new Date(ctx.now().getTime() - 30 * DAY).toISOString();
      const activity = Number(ctx.db.prepare("DELETE FROM activity WHERE at < ?").run(cutoff).changes);
      ctx.db.exec("PRAGMA wal_checkpoint(PASSIVE)");
      return { requeued, pruned, activity };
    },

    async "supervisor.daily_report"(_job, ctx) {
      const now = ctx.now();
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hourCycle: "h23" }).format(now));
      // Report for yesterday, generated after 07:00 Warsaw time, once.
      const yesterday = warsawDay(new Date(now.getTime() - DAY));
      if (hour < 7) return { notYet: true };
      if (ctx.db.prepare("SELECT 1 FROM reports WHERE day = ?").get(yesterday)) return { exists: yesterday };
      const metrics = metricsForDay(ctx.db, yesterday);
      const sources = sourceCounts(ctx.db);
      const costs = costSummary(ctx.db, ctx.config, now);
      const decisions = listDecisions(ctx.db, "open", 500).length;
      const incidents = ctx.db.prepare("SELECT kind, severity, message FROM incidents WHERE status = 'open' ORDER BY id DESC LIMIT 15").all() as Array<{ kind: string; severity: string; message: string }>;
      const agents = listAgents(ctx.db);
      const m = (key: string) => metrics[key] ?? 0;
      const markdown = [
        `# Event Engine — raport za ${yesterday}`,
        "",
        `Tryb publikacji: **${ctx.config.publishMode}** · środowisko: ${ctx.config.env}`,
        "",
        "## Wydarzenia",
        `- nowe wyodrębnione: ${m("events_extracted")}, zmienione: ${m("events_changed")}`,
        `- opublikowane: ${m("events_published")}, do moderacji (pending_review): ${m("events_pending_review")}, aktualizacje: ${m("events_updated")}, odwołane: ${m("events_cancelled")}`,
        `- odrzucone przez jakość: ${m("quality_failed")}, duplikaty: ${m("duplicates")}, brak miasta: ${m("needs_city")}, brak pinezki: ${m("needs_geo")}`,
        "",
        "## Źródła",
        ...Object.entries(sources).map(([status, count]) => `- ${status}: ${count}`),
        `- pobrania OK: ${m("crawl_ok")}, bez zmian (304): ${m("crawl_not_modified")}, błędy: ${m("crawl_failed")}`,
        "",
        "## Koszty",
        `- dziś: ${costs.today.toFixed(2)} PLN, miesiąc: ${costs.month.toFixed(2)} / ${costs.limits.monthlyPln} PLN (+ infrastruktura ${costs.infraMonthPln} PLN)`,
        `- koszt jednego opublikowanego wydarzenia w miesiącu: ${costs.costPerPublishedEvent === null ? "—" : `${costs.costPerPublishedEvent.toFixed(3)} PLN`}`,
        "",
        "## Wymaga uwagi",
        `- otwarte decyzje właściciela: ${decisions}`,
        ...incidents.map(incident => `- [${incident.severity}] ${incident.kind}: ${incident.message}`),
        ...agents.filter(agent => agent.paused).map(agent => `- agent ${agent.name} wstrzymany: ${agent.paused_reason ?? ""}`)
      ].join("\n");
      ctx.db.prepare("INSERT INTO reports (day, markdown, metrics, created_at) VALUES (?, ?, ?, ?)").run(yesterday, markdown, JSON.stringify({ metrics, sources, decisions }), nowIso());
      const attention = decisions > 0 || incidents.some(incident => incident.severity === "critical");
      await ctx.services.notify(`Raport Event Engine ${yesterday}`, `Opublikowane: ${m("events_published")}, do moderacji: ${m("events_pending_review")}, decyzje: ${decisions}, incydenty: ${incidents.length}.`, attention ? "warning" : "info");
      return { day: yesterday };
    }
  }
};

export function diagnose(error: string | null): { kind: string; remediation: string } {
  const text = error ?? "";
  if (/robots/i.test(text)) return { kind: "robots", remediation: "Źródło zablokowane przez robots.txt — wyłączone, ponowna weryfikacja prawna za 90 dni." };
  if (/HTTP (404|410)\b/.test(text)) return { kind: "feed_moved", remediation: "Kanał zniknął — ponowne sondowanie strony i wybór nowego kanału." };
  if (/CAPTCHA|challenge|Brak dostępu|401|403/i.test(text)) return { kind: "access_denied", remediation: "Strona blokuje dostęp — nie obchodzimy, źródło wstrzymane." };
  if (/429|ograniczy/i.test(text)) return { kind: "rate_limited", remediation: "Host ograniczył żądania — wydłużony interwał." };
  if (/HTTP 5\d\d|ECONNRESET|ETIMEDOUT|abort|timeout|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(text)) return { kind: "transient", remediation: "Błąd sieci/serwera — automatyczne ponowienia z wykładniczym odstępem." };
  return { kind: "unknown", remediation: "Nieznana przyczyna — zgłoszenie naprawy z próbką danych." };
}

export const maintenanceAgent: AgentDefinition = {
  name: "maintenance",
  title: "Maintenance Agent",
  description: "Wykrywa awarie źródeł i agentów, diagnozuje przyczynę, stosuje bezpieczne naprawy deterministyczne, przygotowuje zgłoszenia naprawy kodu i kopie zapasowe.",
  role: "worker",
  schedules: [
    { jobType: "maintenance.scan", everyMs: HOUR },
    { jobType: "maintenance.backup", everyMs: 6 * HOUR }
  ],
  handlers: {
    async "maintenance.scan"(_job, ctx) {
      const failing = ctx.db.prepare("SELECT id, domain, last_error, consecutive_failures FROM sources WHERE status = 'failing'").all() as Array<{ id: number; domain: string; last_error: string | null; consecutive_failures: number }>;
      let remediated = 0;
      for (const source of failing) {
        const diagnosis = diagnose(source.last_error);
        openIncident(ctx.db, { kind: "source_failing", agent: "crawler", sourceId: source.id, message: `${source.domain}: ${source.consecutive_failures} nieudanych pobrań (${source.last_error ?? "?"})`, diagnosis: diagnosis.kind, remediation: diagnosis.remediation });
        if (diagnosis.kind === "feed_moved" || (diagnosis.kind === "unknown" && source.consecutive_failures >= 5)) {
          updateSource(ctx.db, source.id, { status: "approved" });
          ctx.enqueue("discovery.probe", { sourceId: source.id }, { dedupeKey: `probe:${source.id}`, priority: 70 });
          remediated += 1;
        } else if (diagnosis.kind === "access_denied" || diagnosis.kind === "robots") {
          updateSource(ctx.db, source.id, { status: "paused" });
          remediated += 1;
        } else if (source.consecutive_failures >= 10) {
          updateSource(ctx.db, source.id, { status: "paused" });
        }
      }
      // Parser regressions: a source that used to yield events and now yields none twice in a row.
      const regressions = ctx.db.prepare("SELECT id, domain, best_yield FROM sources WHERE status = 'active' AND best_yield >= 3 AND last_yield = 0").all() as Array<{ id: number; domain: string; best_yield: number }>;
      for (const source of regressions) {
        const strikes = recall<number>(ctx.db, "regressions", String(source.id), 0) + 1;
        remember(ctx.db, "regressions", String(source.id), strikes);
        if (strikes < 2) continue;
        const raw = ctx.db.prepare("SELECT id FROM raw_items WHERE source_id = ? ORDER BY id DESC LIMIT 1").get(source.id) as { id: number } | undefined;
        openIncident(ctx.db, { kind: "parser_regression", agent: "extraction", sourceId: source.id, severity: "warning", message: `${source.domain}: wcześniej ${source.best_yield} wydarzeń, teraz 0.`, diagnosis: "Zmiana struktury strony lub kanału.", remediation: "Ponowne wykrycie kanału; jeśli nie pomoże — zgłoszenie naprawy kodu (wymaga zatwierdzenia)." });
        if (strikes === 2) {
          updateSource(ctx.db, source.id, { status: "approved" });
          ctx.enqueue("discovery.probe", { sourceId: source.id }, { dedupeKey: `probe:${source.id}`, priority: 70 });
        } else if (strikes >= 4) {
          requestDecision(ctx.db, "code_repair", "source", String(source.id), `Naprawa parsera dla ${source.domain}`, { sourceId: source.id, fixtureRawItemId: raw?.id ?? null, note: "Automatyczne wdrożenie poprawek kodu jest wyłączone do czasu zatwierdzenia klas zmian niskiego ryzyka (Etap 7)." });
        }
      }
      // Agents: dead jobs and stale heartbeats.
      const dead = ctx.db.prepare("SELECT agent, COUNT(*) AS n FROM jobs WHERE status = 'dead' AND finished_at > ? GROUP BY agent").all(new Date(ctx.now().getTime() - DAY).toISOString()) as Array<{ agent: string; n: number }>;
      for (const row of dead.filter(row => row.n >= 20)) {
        openIncident(ctx.db, { kind: `agent_dead_jobs_${row.agent}`, agent: row.agent, severity: row.n >= 100 ? "critical" : "warning", message: `${row.n} zadań agenta ${row.agent} trafiło do dead-letter w ciągu 24 h.` });
      }
      const backlog = queueStats(ctx.db).filter(row => row.status === "queued" && row.count > 5000);
      for (const row of backlog) openIncident(ctx.db, { kind: `backlog_${row.agent}`, agent: row.agent, message: `Kolejka ${row.agent}: ${row.count} zadań oczekujących.` });
      const critical = ctx.db.prepare("SELECT id, message FROM incidents WHERE status = 'open' AND severity = 'critical' AND created_at > ?").all(new Date(ctx.now().getTime() - HOUR).toISOString()) as Array<{ id: number; message: string }>;
      for (const incident of critical) await ctx.services.notify("Event Engine — krytyczny incydent", incident.message, "critical");
      return { failing: failing.length, remediated, regressions: regressions.length };
    },

    async "maintenance.backup"(_job, ctx) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = path.join(ctx.config.backupDir, `engine-${stamp}.sqlite`);
      backupTo(ctx.db, file);
      const files = readdirSync(ctx.config.backupDir).filter(name => /^engine-.*\.sqlite$/.test(name)).sort();
      for (const old of files.slice(0, Math.max(0, files.length - 28))) rmSync(path.join(ctx.config.backupDir, old));
      remember(ctx.db, "maintenance", "last_backup", { file: path.basename(file), at: nowIso() });
      return { file: path.basename(file), kept: Math.min(files.length, 28) };
    }
  }
};

export const growthAgent: AgentDefinition = {
  name: "growth",
  title: "Growth Agent",
  description: "Analizuje pokrycie województw i kategorii, wskazuje luki i kieruje tam odkrywanie źródeł; zgłasza brakujące miasta.",
  role: "worker",
  schedules: [{ jobType: "growth.analyze", everyMs: 12 * HOUR }],
  handlers: {
    async "growth.analyze"(_job, ctx) {
      const client = ctx.services.publicDb;
      const catalog = await ctx.services.catalog();
      if (!client || !catalog) throw new DeferError("Brak odczytu Supabase.", 6 * HOUR);
      const events = await upcomingCoverage(client, 60);
      const byRegion: Record<string, { events: number; sources: number; cities: number; categories: Record<string, number> }> = {};
      for (const name of VOIVODESHIPS) byRegion[name] = { events: 0, sources: 0, cities: 0, categories: {} };
      for (const city of catalog.cities) if (city.voivodeship && byRegion[city.voivodeship]) byRegion[city.voivodeship].cities += 1;
      for (const event of events) {
        const region = event.voivodeship && byRegion[event.voivodeship] ? byRegion[event.voivodeship] : null;
        if (!region) continue;
        region.events += 1;
        const key = event.category ?? "inne";
        region.categories[key] = (region.categories[key] ?? 0) + 1;
      }
      const sourceRows = ctx.db.prepare("SELECT voivodeship, COUNT(*) AS n FROM sources WHERE status = 'active' GROUP BY voivodeship").all() as Array<{ voivodeship: string | null; n: number }>;
      for (const row of sourceRows) if (row.voivodeship && byRegion[row.voivodeship]) byRegion[row.voivodeship].sources = row.n;
      const totalEvents = Math.max(1, events.length);
      const totalCities = Math.max(1, catalog.cities.length);
      const gaps = Object.entries(byRegion).map(([name, region]) => ({
        name, ...region,
        expectedShare: region.cities / totalCities,
        actualShare: region.events / totalEvents,
        gap: region.cities / totalCities - region.events / totalEvents
      })).sort((a, b) => b.gap - a.gap);
      const categoryTotals: Record<string, number> = {};
      for (const event of events) categoryTotals[event.category ?? "inne"] = (categoryTotals[event.category ?? "inne"] ?? 0) + 1;
      ctx.db.prepare("INSERT INTO coverage (computed_at, data) VALUES (?, ?)").run(nowIso(), JSON.stringify({ totalEvents: events.length, regions: gaps, categories: categoryTotals }));
      ctx.db.prepare("DELETE FROM coverage WHERE id NOT IN (SELECT id FROM coverage ORDER BY id DESC LIMIT 60)").run();
      // Steer: boost probing priority for discovered sources in the 4 biggest gaps.
      const focus = gaps.filter(gap => gap.gap > 0).slice(0, 4).map(gap => gap.name);
      for (const region of focus) ctx.db.prepare("UPDATE sources SET priority = MIN(priority, 40) WHERE status = 'discovered' AND voivodeship = ?").run(region);
      remember(ctx.db, "growth", "focus_regions", { regions: focus, at: nowIso() });
      // Missing cities are an owner action (cities are never created by the engine).
      const missing = Object.values(recall<Record<string, { name: string; voivodeship: string | null; count: number }>>(ctx.db, "geo", "missing_cities", {}))
        .filter(item => item.count >= 3).sort((a, b) => b.count - a.count).slice(0, 50);
      if (missing.length) requestDecision(ctx.db, "missing_cities", "cities", warsawDay().slice(0, 7), `Brakujące miasta w tabeli cities (${missing.length})`, { cities: missing, hint: "Dodaj miasta w /admin/cities — silnik ich nie tworzy." });
      return { events: events.length, focus };
    }
  }
};

export const financeAgent: AgentDefinition = {
  name: "finance",
  title: "Financial Controller",
  description: "Prowadzi księgę kosztów, pilnuje twardych limitów dziennych/miesięcznych, liczy koszt pozyskania wydarzenia i rentowność źródeł.",
  role: "worker",
  schedules: [{ jobType: "finance.rollup", everyMs: HOUR }],
  handlers: {
    async "finance.rollup"(_job, ctx) {
      const summary = costSummary(ctx.db, ctx.config, ctx.now());
      const topSources = ctx.db.prepare("SELECT id, domain, events_published_total, events_valid_total, events_found_total FROM sources WHERE events_found_total > 0 ORDER BY events_published_total DESC LIMIT 50").all();
      remember(ctx.db, "finance", "summary", { ...summary, topSources, at: nowIso() });
      if (summary.limits.monthlyPln > 0 && summary.month >= 0.8 * summary.limits.monthlyPln) {
        const flag = recall<string | null>(ctx.db, "finance", "alert80", null);
        if (flag !== warsawDay().slice(0, 7)) {
          remember(ctx.db, "finance", "alert80", warsawDay().slice(0, 7));
          await ctx.services.notify("Event Engine — 80% budżetu", `Wydano ${summary.month.toFixed(2)} z ${summary.limits.monthlyPln} PLN w tym miesiącu.`, "warning");
        }
      }
      return { month: summary.month, perEvent: summary.costPerPublishedEvent };
    }
  }
};
