import type { EngineConfig } from "../config.ts";
import type { Db } from "../db.ts";
import type { Fetcher } from "../net/fetcher.ts";
import type { EnqueueOptions, Job } from "../queue.ts";
import type { LogLevel } from "../store.ts";
import type { Catalog, Client } from "../supabase.ts";

export type Services = {
  publicDb: Client | null;
  serviceDb: Client | null;
  catalog(): Promise<Catalog | null>;
  notify(title: string, message: string, severity?: "info" | "warning" | "critical"): Promise<void>;
  geocode(query: { venue: string | null; street: string | null; city: string; postalCode: string | null }): Promise<{ lat: number; lon: number; display: string } | null>;
};

export type AgentContext = {
  db: Db;
  config: EngineConfig;
  fetcher: Fetcher;
  services: Services;
  agent: string;
  log(level: LogLevel, message: string, data?: unknown): void;
  enqueue(type: string, payload?: Record<string, unknown>, options?: EnqueueOptions): number | null;
  now(): Date;
};

export type JobHandler = (job: Job, ctx: AgentContext) => Promise<unknown>;

export type AgentDefinition = {
  name: string;
  title: string;
  description: string;
  /** "worker" agents touch untrusted internet content; "publisher" agents hold the Supabase service key. */
  role: "worker" | "publisher";
  handlers: Record<string, JobHandler>;
  schedules?: Array<{ jobType: string; everyMs: number; payload?: Record<string, unknown> }>;
  leaseMs?: number;
  usesPaidServices?: boolean;
};

/** Thrown for failures that retrying cannot fix (robots disallow, legal block, bad input). */
export class PermanentError extends Error {}

/** Puts the job back without counting an attempt (missing access, daily cap, budget). */
export class DeferError extends Error {
  readonly delayMs: number;
  constructor(message: string, delayMs: number) {
    super(message);
    this.delayMs = delayMs;
  }
}

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
