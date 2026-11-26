// Runtime configuration. Everything comes from environment variables so the same
// image runs as development, staging and production. Secrets are never logged.

export type EngineEnv = "development" | "staging" | "production";
export type EngineRole = "all" | "worker" | "publisher" | "control";
export type PublishMode = "off" | "dry_run" | "pending_review" | "publish";

export type EngineConfig = {
  env: EngineEnv;
  role: EngineRole;
  dbPath: string;
  backupDir: string;
  dataDir: string;
  controlPort: number;
  controlHost: string;
  controlToken: string | null;
  userAgent: string;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  supabaseServiceKey: string | null;
  publishMode: PublishMode;
  autoPublishMinScore: number;
  /** Max new events written to Supabase per Warsaw day (Etap 6 raises this step by step). */
  publishDailyCap: number;
  /** Hard ceilings no API call can exceed. Budgets stored in the DB are clamped to these. */
  budgetCeilingDailyPln: number;
  budgetCeilingMonthlyPln: number;
  defaultBudgetDailyPln: number;
  defaultBudgetMonthlyPln: number;
  infraMonthlyPln: number;
  workerConcurrency: number;
  hostMinIntervalMs: number;
  fetchTimeoutMs: number;
  fetchMaxBytes: number;
  nominatimUrl: string | null;
  nominatimMinIntervalMs: number;
  wikidataSparqlUrl: string;
  notifyWebhookUrl: string | null;
  notifyWebhookKind: "generic" | "ntfy" | "discord" | "slack";
  killFile: string;
  siteUrl: string;
};

function num(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric configuration value: ${value}`);
  return Math.min(max, Math.max(min, parsed));
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  if (!value) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${name} must be one of ${allowed.join(", ")}`);
}

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  return new URL(value).origin;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): EngineConfig {
  const engineEnv = oneOf(env.ENGINE_ENV, ["development", "staging", "production"] as const, "development", "ENGINE_ENV");
  const dataDir = env.ENGINE_DATA_DIR ?? "./engine/.data";
  // Publication defaults to "off" everywhere. Etap 4 (no auto-publication) is the
  // safe default; turning on "publish" is an explicit owner decision per environment.
  const publishMode = oneOf(env.ENGINE_PUBLISH_MODE, ["off", "dry_run", "pending_review", "publish"] as const, "off", "ENGINE_PUBLISH_MODE");
  if (publishMode === "publish" && engineEnv === "development") {
    throw new Error("ENGINE_PUBLISH_MODE=publish is not allowed in development.");
  }
  const ceilingMonthly = num(env.ENGINE_BUDGET_CEILING_MONTHLY_PLN, 300, 0, 100000);
  const ceilingDaily = num(env.ENGINE_BUDGET_CEILING_DAILY_PLN, 20, 0, 10000);
  const config: EngineConfig = {
    env: engineEnv,
    role: oneOf(env.ENGINE_ROLE, ["all", "worker", "publisher", "control"] as const, "all", "ENGINE_ROLE"),
    dbPath: env.ENGINE_DB_PATH ?? `${dataDir}/engine.sqlite`,
    backupDir: env.ENGINE_BACKUP_DIR ?? `${dataDir}/backups`,
    dataDir,
    controlPort: num(env.ENGINE_CONTROL_PORT, 8787, 1, 65535),
    controlHost: env.ENGINE_CONTROL_HOST ?? "127.0.0.1",
    controlToken: env.ENGINE_CONTROL_TOKEN && env.ENGINE_CONTROL_TOKEN.length >= 32 ? env.ENGINE_CONTROL_TOKEN : null,
    // Generic identification without any personal data of the owner.
    userAgent: env.ENGINE_USER_AGENT ?? "MapaImprezBot/1.0 (+https://mapaimprez.pl/bot)",
    supabaseUrl: originOf(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL),
    supabasePublishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
    supabaseServiceKey: env.EVENTMAP_SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    publishMode,
    autoPublishMinScore: num(env.ENGINE_AUTOPUBLISH_MIN_SCORE, 0.85, 0, 1),
    publishDailyCap: num(env.ENGINE_PUBLISH_DAILY_CAP, 100, 0, 20000),
    budgetCeilingDailyPln: ceilingDaily,
    budgetCeilingMonthlyPln: ceilingMonthly,
    defaultBudgetDailyPln: num(env.ENGINE_BUDGET_DAILY_PLN, 0, 0, ceilingDaily),
    defaultBudgetMonthlyPln: num(env.ENGINE_BUDGET_MONTHLY_PLN, 0, 0, ceilingMonthly),
    infraMonthlyPln: num(env.ENGINE_INFRA_MONTHLY_PLN, 0, 0, 100000),
    workerConcurrency: num(env.ENGINE_WORKER_CONCURRENCY, 4, 1, 32),
    hostMinIntervalMs: num(env.ENGINE_HOST_MIN_INTERVAL_MS, 5000, 1000, 600000),
    fetchTimeoutMs: num(env.ENGINE_FETCH_TIMEOUT_MS, 20000, 1000, 120000),
    fetchMaxBytes: num(env.ENGINE_FETCH_MAX_BYTES, 3_000_000, 10_000, 20_000_000),
    nominatimUrl: env.ENGINE_NOMINATIM_URL === "" ? null : (env.ENGINE_NOMINATIM_URL ?? "https://nominatim.openstreetmap.org"),
    // Public Nominatim policy: absolute maximum one request per second.
    nominatimMinIntervalMs: num(env.ENGINE_NOMINATIM_MIN_INTERVAL_MS, 1100, 1100, 60000),
    wikidataSparqlUrl: env.ENGINE_WIKIDATA_SPARQL_URL ?? "https://query.wikidata.org/sparql",
    notifyWebhookUrl: env.ENGINE_NOTIFY_WEBHOOK_URL || null,
    notifyWebhookKind: oneOf(env.ENGINE_NOTIFY_WEBHOOK_KIND, ["generic", "ntfy", "discord", "slack"] as const, "generic", "ENGINE_NOTIFY_WEBHOOK_KIND"),
    killFile: env.ENGINE_KILL_FILE ?? `${dataDir}/KILL`,
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "https://mapaimprez.pl"
  };
  return config;
}

/** Roles that may run a given agent. Untrusted-content agents never run next to the service key. */
export function roleRunsAgent(role: EngineRole, agentRole: "worker" | "publisher"): boolean {
  return role === "all" || role === agentRole;
}

export function describeConfig(config: EngineConfig): Record<string, unknown> {
  return {
    env: config.env,
    role: config.role,
    publishMode: config.publishMode,
    supabase: Boolean(config.supabaseUrl),
    serviceKey: Boolean(config.supabaseServiceKey),
    controlApi: Boolean(config.controlToken),
    notify: Boolean(config.notifyWebhookUrl),
    geocoder: config.nominatimUrl ? new URL(config.nominatimUrl).host : null,
    budgetCeilingMonthlyPln: config.budgetCeilingMonthlyPln
  };
}
