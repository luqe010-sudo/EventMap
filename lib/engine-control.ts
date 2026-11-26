import { requireAdmin } from "@/lib/auth";

// Server-side client for the Event Engine control API (runs on the VPS).
// ENGINE_CONTROL_URL and ENGINE_CONTROL_TOKEN are server env vars — never NEXT_PUBLIC_*.
// Import only from server components and server actions.

export type EngineAgent = {
  name: string; title: string; description: string; role: "worker" | "publisher"; paused: boolean; pausedReason: string | null;
  lastHeartbeat: string | null; lastRunAt: string | null; lastError: string | null; runsOk: number; runsFailed: number;
  queued: number; running: number; dead: number;
};

export type EngineStatus = {
  generatedAt: string;
  config: { env: string; role: string; publishMode: string; supabase: boolean; serviceKey: boolean; notify: boolean; geocoder: string | null; budgetCeilingMonthlyPln: number };
  kill: { active: boolean; reason: string | null; since: string | null; source: string | null };
  agents: EngineAgent[];
  today: Record<string, number>;
  yesterday: Record<string, number>;
  sources: Record<string, number>;
  candidates: Record<string, number>;
  openDecisions: number;
  openIncidents: number;
  costs: {
    limits: { dailyPln: number; monthlyPln: number; updatedAt: string | null; updatedBy: string | null };
    ceilings: { dailyPln: number; monthlyPln: number };
    today: number; month: number; infraMonthPln: number;
    byProvider: Array<{ provider: string; category: string; amount: number; units: number }>;
    publishedThisMonth: number; costPerPublishedEvent: number | null;
  };
  legalRules: { version: string; rules: Record<string, { title: string; description: string }>; approved: { approved: string[]; version: string } | null };
  lastBackup: { file: string; at: string } | null;
};

export type EngineDecision = {
  id: number; kind: string; subject_type: string; subject_id: string; title: string; details: Record<string, unknown>;
  status: string; resolution_note: string | null; resolved_by: string | null; resolved_at: string | null; created_at: string;
};

export type EngineSource = {
  id: number; url: string; domain: string; name: string | null; kind: string; integration_type: string; feed_url: string | null;
  status: string; legal_rule: string | null; legal_basis: string | null; voivodeship: string | null; city: string | null;
  last_success_at: string | null; consecutive_failures: number; last_error: string | null; events_found_total: number;
  events_published_total: number; autopublish: number; discovered_via: string | null;
};

export type EngineCoverage = {
  computedAt: string | null;
  coverage: { totalEvents: number; regions: Array<{ name: string; events: number; sources: number; cities: number; gap: number }>; categories: Record<string, number> } | null;
  sources: Array<{ voivodeship: string | null; status: string; n: number }>;
};

export type EngineIncident = { id: number; kind: string; severity: string; message: string; diagnosis: string | null; remediation: string | null; status: string; created_at: string };
export type EngineActivity = { id: number; at: string; level: string; agent: string | null; message: string };
export type EngineReport = { day: string; markdown: string; created_at: string };

export class EngineUnavailableError extends Error {}

export function engineConfigured(): boolean {
  return Boolean(process.env.ENGINE_CONTROL_URL && process.env.ENGINE_CONTROL_TOKEN);
}

async function call<T>(method: "GET" | "POST", path: string, actor: string, body?: unknown): Promise<T> {
  const base = process.env.ENGINE_CONTROL_URL;
  const token = process.env.ENGINE_CONTROL_TOKEN;
  if (!base || !token) throw new EngineUnavailableError("Silnik nie jest skonfigurowany (ENGINE_CONTROL_URL / ENGINE_CONTROL_TOKEN).");
  const url = new URL(path, base);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-engine-actor": actor },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    throw new EngineUnavailableError(`Silnik niedostępny: ${error instanceof Error ? error.message : String(error)}`);
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new EngineUnavailableError(`Silnik zwrócił ${response.status}${payload.error ? `: ${payload.error}` : ""}`);
  return payload;
}

/** Actor identifier sent to the engine audit log: the admin's user id, never an e-mail. */
async function adminActor(): Promise<string> {
  const context = await requireAdmin("/admin/engine");
  return `admin:${context.userId}`;
}

export type EngineOverview = {
  status: EngineStatus; decisions: EngineDecision[]; sources: EngineSource[]; coverage: EngineCoverage;
  incidents: EngineIncident[]; activity: EngineActivity[]; reports: EngineReport[];
};

export async function getEngineOverview(sourceStatus: string | null): Promise<EngineOverview> {
  const actor = await adminActor();
  const sourcePath = `/api/sources?limit=100${sourceStatus ? `&status=${encodeURIComponent(sourceStatus)}` : ""}`;
  const [status, decisions, sources, coverage, incidents, activity, reports] = await Promise.all([
    call<EngineStatus>("GET", "/api/status", actor),
    call<{ decisions: EngineDecision[] }>("GET", "/api/decisions?status=open", actor),
    call<{ sources: EngineSource[] }>("GET", sourcePath, actor),
    call<EngineCoverage>("GET", "/api/coverage", actor),
    call<{ incidents: EngineIncident[] }>("GET", "/api/incidents", actor),
    call<{ activity: EngineActivity[] }>("GET", "/api/activity", actor),
    call<{ reports: EngineReport[] }>("GET", "/api/reports", actor)
  ]);
  return { status, decisions: decisions.decisions, sources: sources.sources, coverage, incidents: incidents.incidents.slice(0, 30), activity: activity.activity.slice(0, 60), reports: reports.reports.slice(0, 7) };
}

export async function engineCommand(path: string, body: Record<string, unknown>): Promise<void> {
  const actor = await adminActor();
  await call("POST", path, actor, body);
}
