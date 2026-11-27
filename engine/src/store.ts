// Small repositories over the operational database. Agents get access through
// these functions; owner-only operations (budget, kill switch release, legal
// rule approval) live in control.ts and are not exposed to agent handlers.

import { existsSync } from "node:fs";
import { type Db, json, nowIso } from "./db.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

// ---------- meta / control state ----------

export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare("INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, value, nowIso());
}

export type KillState = { active: boolean; reason: string | null; since: string | null; source: "db" | "file" | null };

/** The kill switch is honoured from two places: the DB (panel) and a file on disk (SSH, no DB needed). */
export function killState(db: Db, killFile?: string): KillState {
  if (killFile && existsSync(killFile)) return { active: true, reason: "Plik KILL na serwerze", since: null, source: "file" };
  const raw = json<{ active: boolean; reason: string | null; since: string | null } | null>(getMeta(db, "kill_switch"), null);
  if (raw?.active) return { active: true, reason: raw.reason, since: raw.since, source: "db" };
  return { active: false, reason: null, since: null, source: null };
}

// ---------- activity / audit ----------

export function log(db: Db, level: LogLevel, agent: string | null, message: string, data?: unknown): void {
  db.prepare("INSERT INTO activity (at, level, agent, message, data) VALUES (?, ?, ?, ?, ?)")
    .run(nowIso(), level, agent, message.slice(0, 2000), data === undefined ? null : JSON.stringify(data).slice(0, 20000));
  if (level === "error" || level === "warn") {
    const line = `[${level}]${agent ? ` [${agent}]` : ""} ${message}`;
    if (level === "error") console.error(line); else console.warn(line);
  }
}

export function audit(db: Db, actor: string, action: string, details?: unknown): void {
  db.prepare("INSERT INTO audit (at, actor, action, details) VALUES (?, ?, ?, ?)")
    .run(nowIso(), actor.slice(0, 200), action, details === undefined ? null : JSON.stringify(details).slice(0, 20000));
}

// ---------- agents ----------

export type AgentRow = {
  name: string; paused: number; paused_reason: string | null; paused_by: string | null;
  last_heartbeat: string | null; last_run_at: string | null; last_error: string | null; runs_ok: number; runs_failed: number;
};

export function ensureAgent(db: Db, name: string): void {
  db.prepare("INSERT OR IGNORE INTO agents (name) VALUES (?)").run(name);
}

export function listAgents(db: Db): AgentRow[] {
  return db.prepare("SELECT * FROM agents ORDER BY name").all() as unknown as AgentRow[];
}

export function isAgentPaused(db: Db, name: string): boolean {
  const row = db.prepare("SELECT paused FROM agents WHERE name = ?").get(name) as { paused: number } | undefined;
  return row?.paused === 1;
}

export function heartbeat(db: Db, name: string): void {
  db.prepare("UPDATE agents SET last_heartbeat = ? WHERE name = ?").run(nowIso(), name);
}

export function recordAgentRun(db: Db, name: string, ok: boolean, error?: string): void {
  if (ok) db.prepare("UPDATE agents SET runs_ok = runs_ok + 1, last_run_at = ?, last_heartbeat = ? WHERE name = ?").run(nowIso(), nowIso(), name);
  else db.prepare("UPDATE agents SET runs_failed = runs_failed + 1, last_run_at = ?, last_heartbeat = ?, last_error = ? WHERE name = ?")
    .run(nowIso(), nowIso(), (error ?? "").slice(0, 2000), name);
}

// ---------- persistent memory ----------

export function remember(db: Db, scope: string, key: string, value: unknown): void {
  db.prepare("INSERT INTO memory (scope, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(scope, key, JSON.stringify(value), nowIso());
}

export function recall<T>(db: Db, scope: string, key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM memory WHERE scope = ? AND key = ?").get(scope, key) as { value: string } | undefined;
  return json(row?.value, fallback);
}

// ---------- owner decisions ----------

export type DecisionRow = {
  id: number; kind: string; subject_type: string; subject_id: string; title: string; details: string;
  status: "open" | "approved" | "rejected" | "expired"; resolution_note: string | null; resolved_by: string | null;
  resolved_at: string | null; created_at: string;
};

/** Idempotent: one open decision per (kind, subject). Returns the decision id. */
export function requestDecision(db: Db, kind: string, subjectType: string, subjectId: string, title: string, details: unknown): number {
  const existing = db.prepare("SELECT id FROM decisions WHERE kind = ? AND subject_type = ? AND subject_id = ? AND status = 'open'")
    .get(kind, subjectType, subjectId) as { id: number } | undefined;
  if (existing) return existing.id;
  const result = db.prepare("INSERT INTO decisions (kind, subject_type, subject_id, title, details, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(kind, subjectType, subjectId, title.slice(0, 500), JSON.stringify(details ?? {}), nowIso());
  return Number(result.lastInsertRowid);
}

export function listDecisions(db: Db, status: DecisionRow["status"] | "all" = "open", limit = 200): DecisionRow[] {
  if (status === "all") return db.prepare("SELECT * FROM decisions ORDER BY id DESC LIMIT ?").all(limit) as unknown as DecisionRow[];
  return db.prepare("SELECT * FROM decisions WHERE status = ? ORDER BY id DESC LIMIT ?").all(status, limit) as unknown as DecisionRow[];
}

export function latestResolution(db: Db, kind: string, subjectType: string, subjectId: string): DecisionRow | null {
  return (db.prepare("SELECT * FROM decisions WHERE kind = ? AND subject_type = ? AND subject_id = ? AND status IN ('approved','rejected') ORDER BY resolved_at DESC LIMIT 1")
    .get(kind, subjectType, subjectId) as unknown as DecisionRow | undefined) ?? null;
}

// ---------- incidents ----------

export function openIncident(db: Db, input: { kind: string; agent?: string; sourceId?: number; severity?: "info" | "warning" | "critical"; message: string; diagnosis?: string; remediation?: string }): number {
  const existing = db.prepare("SELECT id FROM incidents WHERE kind = ? AND IFNULL(source_id, -1) = IFNULL(?, -1) AND status = 'open'")
    .get(input.kind, input.sourceId ?? null) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE incidents SET message = ?, diagnosis = COALESCE(?, diagnosis), remediation = COALESCE(?, remediation) WHERE id = ?")
      .run(input.message.slice(0, 2000), input.diagnosis ?? null, input.remediation ?? null, existing.id);
    return existing.id;
  }
  const result = db.prepare("INSERT INTO incidents (kind, agent, source_id, severity, message, diagnosis, remediation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(input.kind, input.agent ?? null, input.sourceId ?? null, input.severity ?? "warning", input.message.slice(0, 2000),
      input.diagnosis ?? null, input.remediation ?? null, nowIso());
  return Number(result.lastInsertRowid);
}

export function resolveIncidents(db: Db, kind: string, sourceId: number | null): void {
  db.prepare("UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE kind = ? AND IFNULL(source_id, -1) = IFNULL(?, -1) AND status = 'open'")
    .run(nowIso(), kind, sourceId);
}

// ---------- metrics ----------

export function warsawDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function bumpMetric(db: Db, key: string, by = 1, day = warsawDay()): void {
  db.prepare("INSERT INTO metrics_daily (day, key, value) VALUES (?, ?, ?) ON CONFLICT(day, key) DO UPDATE SET value = value + excluded.value")
    .run(day, key, by);
}

export function metricsForDay(db: Db, day: string): Record<string, number> {
  const rows = db.prepare("SELECT key, value FROM metrics_daily WHERE day = ?").all(day) as Array<{ key: string; value: number }>;
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}
