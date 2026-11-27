// Durable job queue on SQLite. Jobs survive restarts; a running job whose lease
// expired (crash, container restart) is re-queued automatically. Deduplication
// keys make enqueueing idempotent, so schedulers can safely re-run.

import { type Db, json, nowIso, tx } from "./db.ts";

export type JobStatus = "queued" | "running" | "done" | "failed" | "dead" | "cancelled";

export type Job = {
  id: number; type: string; agent: string; payload: Record<string, unknown>; priority: number; status: JobStatus;
  attempts: number; max_attempts: number; run_after: string; lease_until: string | null; dedupe_key: string | null;
  last_error: string | null; created_at: string;
};

type JobRow = Omit<Job, "payload"> & { payload: string };

export type EnqueueOptions = { priority?: number; runAfter?: Date; dedupeKey?: string; maxAttempts?: number };

export function enqueue(db: Db, agent: string, type: string, payload: Record<string, unknown> = {}, options: EnqueueOptions = {}): number | null {
  const now = nowIso();
  const result = db.prepare(`INSERT INTO jobs (type, agent, payload, priority, run_after, dedupe_key, max_attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
    .run(type, agent, JSON.stringify(payload), options.priority ?? 100, (options.runAfter ?? new Date()).toISOString(),
      options.dedupeKey ?? null, options.maxAttempts ?? 5, now, now);
  return result.changes ? Number(result.lastInsertRowid) : null;
}

/** Claims the next runnable job for one of the given agents. Lower priority number runs first. */
export function claim(db: Db, agents: string[], workerId: string, leaseMs: number, now: Date = new Date()): Job | null {
  if (!agents.length) return null;
  const placeholders = agents.map(() => "?").join(",");
  return tx(db, () => {
    const row = db.prepare(`SELECT * FROM jobs WHERE status = 'queued' AND run_after <= ? AND agent IN (${placeholders})
      ORDER BY priority ASC, run_after ASC, id ASC LIMIT 1`).get(now.toISOString(), ...agents) as unknown as JobRow | undefined;
    if (!row) return null;
    const lease = new Date(now.getTime() + leaseMs).toISOString();
    db.prepare("UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_until = ?, locked_by = ?, updated_at = ? WHERE id = ? AND status = 'queued'")
      .run(lease, workerId, nowIso(now), row.id);
    return { ...row, status: "running" as const, attempts: row.attempts + 1, lease_until: lease, payload: json(row.payload, {}) };
  });
}

export function complete(db: Db, id: number, result?: unknown): void {
  db.prepare("UPDATE jobs SET status = 'done', result = ?, lease_until = NULL, finished_at = ?, updated_at = ? WHERE id = ?")
    .run(result === undefined ? null : JSON.stringify(result).slice(0, 10000), nowIso(), nowIso(), id);
}

/** Exponential backoff with a cap; a job that exhausted attempts goes to the dead-letter state. */
export function fail(db: Db, job: Pick<Job, "id" | "attempts" | "max_attempts">, error: string, now: Date = new Date(), retryable = true): JobStatus {
  const dead = !retryable || job.attempts >= job.max_attempts;
  const delay = Math.min(6 * 3600_000, 30_000 * 2 ** Math.max(0, job.attempts - 1));
  const status: JobStatus = dead ? "dead" : "queued";
  db.prepare("UPDATE jobs SET status = ?, last_error = ?, run_after = ?, lease_until = NULL, locked_by = NULL, updated_at = ?, finished_at = ? WHERE id = ?")
    .run(status, error.slice(0, 2000), new Date(now.getTime() + delay).toISOString(), nowIso(now), dead ? nowIso(now) : null, job.id);
  return status;
}

/** Puts a job back without counting an attempt (e.g. agent paused, budget exhausted). */
export function defer(db: Db, id: number, untilMs: number, reason: string): void {
  db.prepare("UPDATE jobs SET status = 'queued', attempts = MAX(0, attempts - 1), run_after = ?, lease_until = NULL, locked_by = NULL, last_error = ?, updated_at = ? WHERE id = ?")
    .run(new Date(Date.now() + untilMs).toISOString(), reason, nowIso(), id);
}

export function extendLease(db: Db, id: number, leaseMs: number): void {
  db.prepare("UPDATE jobs SET lease_until = ? WHERE id = ? AND status = 'running'").run(new Date(Date.now() + leaseMs).toISOString(), id);
}

export function requeueExpired(db: Db, now: Date = new Date()): number {
  const result = db.prepare("UPDATE jobs SET status = 'queued', lease_until = NULL, locked_by = NULL, last_error = 'lease expired', updated_at = ? WHERE status = 'running' AND lease_until < ?")
    .run(nowIso(now), now.toISOString());
  return Number(result.changes);
}

export function queueStats(db: Db): Array<{ agent: string; status: string; count: number }> {
  return db.prepare("SELECT agent, status, COUNT(*) AS count FROM jobs WHERE status IN ('queued','running','dead') GROUP BY agent, status").all() as Array<{ agent: string; status: string; count: number }>;
}

/** Keeps the queue table small: finished jobs older than the retention window are removed. */
export function pruneJobs(db: Db, retentionDays = 14): number {
  const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
  return Number(db.prepare("DELETE FROM jobs WHERE status IN ('done','cancelled') AND finished_at < ?").run(cutoff).changes);
}
