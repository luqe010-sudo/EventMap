// Supervisor runtime: schedules periodic jobs, dispatches queued jobs to agents
// with bounded concurrency, honours the kill switch and per-agent pauses, and
// records heartbeats. All state is in SQLite, so a restart resumes where it stopped.

import { randomUUID } from "node:crypto";
import { contentAgent, geoAgent, publisherAgent, qualityAgent } from "./agents/pipeline.ts";
import { discoveryAgent } from "./agents/discovery.ts";
import { crawlerAgent, extractionAgent, integrationAgent } from "./agents/ingest.ts";
import { legalAgent } from "./agents/legal.ts";
import { financeAgent, growthAgent, maintenanceAgent, supervisorAgent } from "./agents/ops.ts";
import { type AgentContext, type AgentDefinition, DeferError, PermanentError, type Services } from "./agents/types.ts";
import { type EngineConfig, roleRunsAgent } from "./config.ts";
import { type Db, nowIso } from "./db.ts";
import type { Fetcher } from "./net/fetcher.ts";
import { claim, complete, defer, enqueue, extendLease, fail, type Job, requeueExpired } from "./queue.ts";
import { ensureAgent, heartbeat, isAgentPaused, killState, log, recordAgentRun } from "./store.ts";

export const AGENTS: AgentDefinition[] = [
  supervisorAgent, discoveryAgent, legalAgent, integrationAgent, crawlerAgent, extractionAgent,
  geoAgent, qualityAgent, contentAgent, publisherAgent, maintenanceAgent, growthAgent, financeAgent
];

export function agentForJob(type: string): AgentDefinition | null {
  return AGENTS.find(agent => type in agent.handlers) ?? null;
}

export function registerAgents(db: Db): void {
  for (const agent of AGENTS) {
    ensureAgent(db, agent.name);
    for (const schedule of agent.schedules ?? []) {
      db.prepare("INSERT INTO schedules (job_type, agent, every_ms) VALUES (?, ?, ?) ON CONFLICT(job_type) DO UPDATE SET every_ms = excluded.every_ms, agent = excluded.agent")
        .run(schedule.jobType, agent.name, schedule.everyMs);
    }
  }
}

export type Runtime = { tick(): Promise<void>; start(): void; stop(): Promise<void>; runJob(job: Job): Promise<void>; idle(): Promise<void> };

export function createRuntime(db: Db, config: EngineConfig, fetcher: Fetcher, services: Services, options: { now?: () => Date } = {}): Runtime {
  const now = options.now ?? (() => new Date());
  const workerId = `${config.role}-${randomUUID().slice(0, 8)}`;
  const mine = AGENTS.filter(agent => roleRunsAgent(config.role, agent.role));
  const running = new Set<Promise<void>>();
  let timer: NodeJS.Timeout | null = null;
  let stopping = false;
  let lastHeartbeat = 0;
  registerAgents(db);

  function context(agent: AgentDefinition): AgentContext {
    return {
      db, config, fetcher, services, agent: agent.name, now,
      log: (level, message, data) => log(db, level, agent.name, message, data),
      enqueue: (type, payload = {}, enqueueOptions = {}) => {
        const target = agentForJob(type);
        if (!target) throw new Error(`Nieznany typ zadania: ${type}`);
        return enqueue(db, target.name, type, payload, enqueueOptions);
      }
    };
  }

  function schedule(): void {
    const rows = db.prepare("SELECT job_type, agent, every_ms, last_enqueued_at FROM schedules WHERE enabled = 1").all() as Array<{ job_type: string; agent: string; every_ms: number; last_enqueued_at: string | null }>;
    const current = now();
    for (const row of rows) {
      const agent = mine.find(item => item.name === row.agent);
      if (!agent || isAgentPaused(db, agent.name)) continue;
      if (row.last_enqueued_at && current.getTime() - Date.parse(row.last_enqueued_at) < row.every_ms) continue;
      const payload = agent.schedules?.find(item => item.jobType === row.job_type)?.payload ?? {};
      enqueue(db, agent.name, row.job_type, payload, { dedupeKey: `sched:${row.job_type}`, priority: 20 });
      db.prepare("UPDATE schedules SET last_enqueued_at = ? WHERE job_type = ?").run(nowIso(current), row.job_type);
    }
  }

  async function runJob(job: Job): Promise<void> {
    const agent = AGENTS.find(item => item.name === job.agent);
    const handler = agent?.handlers[job.type];
    if (!agent || !handler) { fail(db, job, `Brak obsługi zadania ${job.type}`, now(), false); return; }
    const leaseMs = agent.leaseMs ?? 10 * 60_000;
    const keepAlive = setInterval(() => extendLease(db, job.id, leaseMs), Math.min(60_000, leaseMs / 2));
    try {
      const result = await handler(job, context(agent));
      complete(db, job.id, result);
      recordAgentRun(db, agent.name, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof DeferError) {
        defer(db, job.id, error.delayMs, message);
        recordAgentRun(db, agent.name, true);
        log(db, "info", agent.name, `Odłożono ${job.type}: ${message}`);
      } else {
        const status = fail(db, job, message, now(), !(error instanceof PermanentError));
        recordAgentRun(db, agent.name, false, message);
        log(db, status === "dead" ? "error" : "warn", agent.name, `${job.type} #${job.id} (${status}): ${message}`);
      }
    } finally {
      clearInterval(keepAlive);
    }
  }

  async function tick(): Promise<void> {
    if (stopping) return;
    const kill = killState(db, config.killFile);
    if (Date.now() - lastHeartbeat > 30_000) {
      lastHeartbeat = Date.now();
      for (const agent of mine) heartbeat(db, agent.name);
      requeueExpired(db, now());
    }
    if (kill.active) return;
    schedule();
    while (running.size < config.workerConcurrency) {
      const active = mine.filter(agent => !isAgentPaused(db, agent.name)).map(agent => agent.name);
      const job = claim(db, active, workerId, 10 * 60_000, now());
      if (!job) break;
      const task = runJob(job).finally(() => running.delete(task));
      running.add(task);
    }
  }

  return {
    tick,
    runJob,
    async idle() { while (running.size) await Promise.allSettled([...running]); },
    start() {
      log(db, "info", "supervisor", `Start ${workerId} (rola ${config.role}, agenci: ${mine.map(agent => agent.name).join(", ")})`);
      timer = setInterval(() => { tick().catch(error => log(db, "error", "supervisor", `tick: ${error instanceof Error ? error.message : String(error)}`)); }, 1000);
    },
    async stop() {
      stopping = true;
      if (timer) clearInterval(timer);
      const deadline = Date.now() + 30_000;
      while (running.size && Date.now() < deadline) await Promise.race([Promise.allSettled([...running]), new Promise(done => setTimeout(done, 1000))]);
      log(db, "info", "supervisor", `Stop ${workerId}; przerwane zadania wrócą do kolejki po wygaśnięciu dzierżawy.`);
    }
  };
}
