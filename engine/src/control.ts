// Control API used by the MapaImprez admin panel (server-side only). Bearer
// token auth; every mutating call is written to the append-only audit table.
// Owner-only powers (budget, kill switch, legal rules, decisions) live here and
// are not reachable from agent code.

import { timingSafeEqual, createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { costSummary, setLimits } from "./budget.ts";
import { type EngineConfig, describeConfig } from "./config.ts";
import { type Db, json, nowIso } from "./db.ts";
import { LEGAL_RULES, LEGAL_RULES_VERSION } from "./legal/policy.ts";
import { enqueue, queueStats } from "./queue.ts";
import { AGENTS } from "./runtime.ts";
import { getSource, registerSource, sourceCounts, updateSource } from "./sources.ts";
import { audit, getMeta, killState, listAgents, listDecisions, metricsForDay, recall, setMeta, warsawDay } from "./store.ts";

export type ControlRequest = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown>; actor: string };
export type ControlResponse = { status: number; body: unknown };

function tokenMatches(expected: string, header: string | undefined): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function str(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function statusPayload(db: Db, config: EngineConfig) {
  const day = warsawDay();
  const agents = listAgents(db);
  const queue = queueStats(db);
  return {
    generatedAt: nowIso(),
    config: describeConfig(config),
    kill: killState(db, config.killFile),
    agents: AGENTS.map(definition => {
      const row = agents.find(agent => agent.name === definition.name);
      return {
        name: definition.name, title: definition.title, description: definition.description, role: definition.role,
        paused: row?.paused === 1, pausedReason: row?.paused_reason ?? null, lastHeartbeat: row?.last_heartbeat ?? null,
        lastRunAt: row?.last_run_at ?? null, lastError: row?.last_error ?? null, runsOk: row?.runs_ok ?? 0, runsFailed: row?.runs_failed ?? 0,
        queued: queue.find(item => item.agent === definition.name && item.status === "queued")?.count ?? 0,
        running: queue.find(item => item.agent === definition.name && item.status === "running")?.count ?? 0,
        dead: queue.find(item => item.agent === definition.name && item.status === "dead")?.count ?? 0
      };
    }),
    today: metricsForDay(db, day),
    yesterday: metricsForDay(db, warsawDay(new Date(Date.now() - 86400_000))),
    sources: sourceCounts(db),
    candidates: Object.fromEntries((db.prepare("SELECT status, COUNT(*) AS n FROM candidates GROUP BY status").all() as Array<{ status: string; n: number }>).map(row => [row.status, row.n])),
    openDecisions: (db.prepare("SELECT COUNT(*) AS n FROM decisions WHERE status = 'open'").get() as { n: number }).n,
    openIncidents: (db.prepare("SELECT COUNT(*) AS n FROM incidents WHERE status = 'open'").get() as { n: number }).n,
    costs: costSummary(db, config),
    legalRules: { version: LEGAL_RULES_VERSION, rules: LEGAL_RULES, approved: json<{ approved: string[]; version: string } | null>(getMeta(db, "legal_rules"), null) },
    lastBackup: recall(db, "maintenance", "last_backup", null)
  };
}

export function handleControl(db: Db, config: EngineConfig, request: ControlRequest): ControlResponse {
  const { method, path, query, body, actor } = request;
  const parts = path.split("/").filter(Boolean); // ["api", ...]
  if (parts[0] !== "api") return { status: 404, body: { error: "not_found" } };
  const route = `${method} /${parts.slice(1).join("/")}`;

  if (route === "GET /status") return { status: 200, body: statusPayload(db, config) };

  if (route === "GET /sources") {
    const status = str(query.get("status"), 40);
    const limit = Math.min(500, Number(query.get("limit") ?? 100) || 100);
    const rows = status
      ? db.prepare("SELECT id, url, domain, name, kind, integration_type, feed_url, status, legal_rule, legal_basis, voivodeship, city, last_success_at, consecutive_failures, last_error, events_found_total, events_published_total, autopublish, discovered_via FROM sources WHERE status = ? ORDER BY priority, id LIMIT ?").all(status, limit)
      : db.prepare("SELECT id, url, domain, name, kind, integration_type, feed_url, status, legal_rule, legal_basis, voivodeship, city, last_success_at, consecutive_failures, last_error, events_found_total, events_published_total, autopublish, discovered_via FROM sources ORDER BY updated_at DESC LIMIT ?").all(limit);
    return { status: 200, body: { sources: rows } };
  }

  if (route === "POST /sources") {
    const url = str(body.url, 2000);
    if (!url) return { status: 400, body: { error: "url_required" } };
    const result = registerSource(db, { url, name: str(body.name, 300), kind: str(body.kind, 40) ?? "organizer", city: str(body.city, 120), voivodeship: str(body.voivodeship, 60), discoveredVia: `owner:${actor}`, priority: 30 });
    if (!result) return { status: 400, body: { error: "invalid_url" } };
    audit(db, actor, "source.add", { url, id: result.id });
    return { status: 201, body: result };
  }

  const sourceMatch = /^POST \/sources\/(\d+)\/(pause|resume|retract|autopublish|recheck)$/.exec(route);
  if (sourceMatch) {
    const id = Number(sourceMatch[1]);
    const source = getSource(db, id);
    if (!source) return { status: 404, body: { error: "source_not_found" } };
    const action = sourceMatch[2];
    if (action === "pause") updateSource(db, id, { status: "paused" });
    if (action === "resume") updateSource(db, id, { status: source.integration_type !== "unknown" && source.feed_url ? "active" : "discovered", consecutive_failures: 0 });
    if (action === "recheck") { updateSource(db, id, { status: "legal_review" }); enqueue(db, "legal", "legal.review", { sourceId: id }, { dedupeKey: `legal:${id}` }); }
    if (action === "autopublish") updateSource(db, id, { autopublish: body.enabled === true ? 1 : 0 });
    if (action === "retract") {
      updateSource(db, id, { status: "retracted" });
      enqueue(db, "publisher", "publish.retract_source", { sourceId: id, actor }, { dedupeKey: `retract:${id}`, priority: 5 });
    }
    audit(db, actor, `source.${action}`, { id, domain: source.domain, enabled: body.enabled });
    return { status: 200, body: { ok: true } };
  }

  if (route === "GET /decisions") {
    const status = (str(query.get("status"), 20) ?? "open") as "open" | "approved" | "rejected" | "all";
    return { status: 200, body: { decisions: listDecisions(db, status, 300).map(decision => ({ ...decision, details: json(decision.details, {}) })) } };
  }

  const decisionMatch = /^POST \/decisions\/(\d+)$/.exec(route);
  if (decisionMatch) {
    const id = Number(decisionMatch[1]);
    const resolution = body.resolution === "approved" ? "approved" : body.resolution === "rejected" ? "rejected" : null;
    if (!resolution) return { status: 400, body: { error: "resolution_required" } };
    const decision = db.prepare("SELECT * FROM decisions WHERE id = ? AND status = 'open'").get(id) as { id: number; kind: string; subject_id: string; details: string } | undefined;
    if (!decision) return { status: 404, body: { error: "decision_not_open" } };
    const note = str(body.note, 2000);
    db.prepare("UPDATE decisions SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?").run(resolution, note, actor, nowIso(), id);
    audit(db, actor, "decision.resolve", { id, kind: decision.kind, subject: decision.subject_id, resolution, note });
    // Follow-up effects of the owner's decision.
    if (decision.kind === "source_approval") {
      const sourceId = Number(decision.subject_id);
      if (resolution === "approved") { updateSource(db, sourceId, { status: "approved", legal_rule: "L1_owner", legal_basis: `Decyzja właściciela (${actor})${note ? `: ${note}` : ""}` }); enqueue(db, "integration", "integration.activate", { sourceId }, { dedupeKey: `activate:${sourceId}` }); }
      else updateSource(db, sourceId, { status: "blocked", legal_rule: "L1_owner", legal_basis: `Odrzucone przez właściciela${note ? `: ${note}` : ""}` });
    }
    if (decision.kind === "legal_ruleset") {
      const requested = Array.isArray(body.rules) ? (body.rules as unknown[]).map(String).filter(rule => rule in LEGAL_RULES) : Object.keys(LEGAL_RULES);
      setMeta(db, "legal_rules", JSON.stringify({ version: LEGAL_RULES_VERSION, approved: resolution === "approved" ? requested : [], by: actor, at: nowIso() }));
      if (resolution === "approved") enqueue(db, "legal", "legal.recheck_due", {}, { dedupeKey: "legal.recheck_due:manual", priority: 10 });
    }
    return { status: 200, body: { ok: true } };
  }

  const agentMatch = /^POST \/agents\/([a-z]+)\/(pause|resume)$/.exec(route);
  if (agentMatch) {
    const name = agentMatch[1];
    if (!AGENTS.some(agent => agent.name === name)) return { status: 404, body: { error: "agent_not_found" } };
    const paused = agentMatch[2] === "pause";
    db.prepare("UPDATE agents SET paused = ?, paused_reason = ?, paused_by = ? WHERE name = ?").run(paused ? 1 : 0, paused ? str(body.reason, 300) : null, paused ? actor : null, name);
    audit(db, actor, `agent.${agentMatch[2]}`, { name, reason: body.reason });
    return { status: 200, body: { ok: true } };
  }

  if (route === "POST /kill") {
    const active = body.active === true;
    setMeta(db, "kill_switch", JSON.stringify({ active, reason: active ? str(body.reason, 300) ?? "Wyłącznik awaryjny" : null, since: active ? nowIso() : null }));
    audit(db, actor, active ? "kill.on" : "kill.off", { reason: body.reason });
    return { status: 200, body: { kill: killState(db, config.killFile) } };
  }

  if (route === "POST /budget") {
    try {
      const limits = setLimits(db, config, actor, Number(body.dailyPln), Number(body.monthlyPln));
      return { status: 200, body: { limits } };
    } catch (error) { return { status: 400, body: { error: error instanceof Error ? error.message : "invalid" } }; }
  }

  if (route === "GET /activity") {
    const level = str(query.get("level"), 10);
    const rows = level
      ? db.prepare("SELECT * FROM activity WHERE level = ? ORDER BY id DESC LIMIT 200").all(level)
      : db.prepare("SELECT * FROM activity ORDER BY id DESC LIMIT 200").all();
    return { status: 200, body: { activity: rows } };
  }
  if (route === "GET /incidents") return { status: 200, body: { incidents: db.prepare("SELECT * FROM incidents ORDER BY status = 'open' DESC, id DESC LIMIT 200").all() } };
  if (route === "GET /coverage") {
    const row = db.prepare("SELECT computed_at, data FROM coverage ORDER BY id DESC LIMIT 1").get() as { computed_at: string; data: string } | undefined;
    const regionSources = db.prepare("SELECT voivodeship, status, COUNT(*) AS n FROM sources GROUP BY voivodeship, status").all();
    return { status: 200, body: { computedAt: row?.computed_at ?? null, coverage: json(row?.data, null), sources: regionSources } };
  }
  if (route === "GET /reports") return { status: 200, body: { reports: db.prepare("SELECT day, markdown, created_at FROM reports ORDER BY day DESC LIMIT 30").all() } };
  if (route === "GET /audit") return { status: 200, body: { audit: db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 200").all() } };
  return { status: 404, body: { error: "not_found" } };
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.method === "GET") return {};
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > 100_000) throw new Error("body_too_large");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

export function startControlServer(db: Db, config: EngineConfig, options: { healthOnly?: boolean; port?: number; host?: string } = {}): Server {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url ?? "/", "http://engine.local");
      if (url.pathname === "/healthz") {
        // Minimal, unauthenticated liveness for Docker/uptime checks. No internal details.
        const heartbeat = db.prepare("SELECT MAX(last_heartbeat) AS at FROM agents").get() as { at: string | null };
        const fresh = heartbeat.at ? Date.now() - Date.parse(heartbeat.at) < 120_000 : false;
        return send(fresh || config.role === "control" ? 200 : 503, { ok: fresh || config.role === "control" });
      }
      if (options.healthOnly) return send(404, { error: "not_found" });
      if (!config.controlToken) return send(503, { error: "control_token_not_configured" });
      if (!tokenMatches(config.controlToken, request.headers.authorization)) return send(401, { error: "unauthorized" });
      const actor = str(request.headers["x-engine-actor"] as string | undefined, 200) ?? "panel";
      const body = await readBody(request);
      const result = handleControl(db, config, { method: request.method ?? "GET", path: url.pathname, query: url.searchParams, body, actor });
      return send(result.status, result.body);
    } catch (error) {
      return send(400, { error: error instanceof Error ? error.message.slice(0, 200) : "bad_request" });
    }
  });
  server.listen(options.port ?? config.controlPort, options.host ?? config.controlHost);
  return server;
}
