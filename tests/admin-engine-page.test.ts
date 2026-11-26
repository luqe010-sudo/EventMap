import { writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../engine/src/config.ts";
import { handleControl, statusPayload } from "../engine/src/control.ts";
import { openDb } from "../engine/src/db.ts";
import { registerSource, updateSource } from "../engine/src/sources.ts";
import { bumpMetric, openIncident, requestDecision, log } from "../engine/src/store.ts";
import { registerAgents } from "../engine/src/runtime.ts";
import { LEGAL_RULES, LEGAL_RULES_VERSION } from "../engine/src/legal/policy.ts";

vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ userId: "admin-1", profile: { role: "admin" } })) }));
vi.mock("@/lib/engine-control", async importOriginal => {
  const actual = await importOriginal<typeof import("../lib/engine-control")>();
  return { ...actual, engineConfigured: vi.fn(() => true), getEngineOverview: vi.fn() };
});
vi.mock("../app/admin/engine/engine.css", () => ({}));

import AdminEnginePage from "../app/admin/engine/page";
import { engineConfigured, EngineUnavailableError, getEngineOverview, type EngineOverview } from "../lib/engine-control";

function overviewFromEngine(): EngineOverview {
  const config = loadConfig({ ENGINE_ENV: "production", ENGINE_PUBLISH_MODE: "pending_review" });
  const db = openDb(":memory:");
  registerAgents(db);
  const gok = registerSource(db, { url: "https://gok.example.pl", name: "GOK Przykładowo", kind: "institution", voivodeship: "małopolskie", city: "Tarnów", discoveredVia: "wikidata:culture" })!;
  updateSource(db, gok.id, { status: "active", integration_type: "ics", legal_rule: "L5_organizer_own_channel", legal_basis: "Własny kanał organizatora.", events_found_total: 12, events_published_total: 9 });
  const unclear = registerSource(db, { url: "https://portal.example.pl", kind: "organizer", discoveredVia: "owner:test" })!;
  updateSource(db, unclear.id, { status: "needs_owner", legal_rule: "L3_terms", legal_basis: "Regulamin może zakazywać pobierania." });
  requestDecision(db, "legal_ruleset", "rules", LEGAL_RULES_VERSION, "Zatwierdź reguły automatycznej akceptacji źródeł", { rules: LEGAL_RULES });
  requestDecision(db, "source_approval", "source", String(unclear.id), "Źródło portal.example.pl: regulamin", { url: "https://portal.example.pl/", kind: "organizer", integration: "jsonld", basis: "Regulamin może zakazywać pobierania.", evidence: ["Zabrania się kopiowania treści"] });
  bumpMetric(db, "events_published", 7);
  bumpMetric(db, "events_pending_review", 3);
  openIncident(db, { kind: "source_failing", sourceId: gok.id, message: "gok.example.pl: 3 nieudane pobrania", remediation: "Ponowienia z odstępem." });
  log(db, "info", "crawler", "Pobrano kalendarz gok.example.pl");
  db.prepare("INSERT INTO coverage (computed_at, data) VALUES (?, ?)").run(new Date().toISOString(), JSON.stringify({
    totalEvents: 120,
    regions: [{ name: "małopolskie", events: 80, sources: 1, cities: 10, gap: -0.2 }, { name: "podlaskie", events: 2, sources: 0, cities: 8, gap: 0.15 }],
    categories: { koncerty: 70, kultura: 50 }
  }));
  const get = (path: string) => handleControl(db, config, { method: "GET", path, query: new URL(`http://x${path}`).searchParams, body: {}, actor: "test" }).body as Record<string, unknown>;
  return {
    status: JSON.parse(JSON.stringify(statusPayload(db, config))),
    decisions: (get("/api/decisions") as { decisions: EngineOverview["decisions"] }).decisions,
    sources: (get("/api/sources") as { sources: EngineOverview["sources"] }).sources,
    coverage: get("/api/coverage") as unknown as EngineOverview["coverage"],
    incidents: (get("/api/incidents") as { incidents: EngineOverview["incidents"] }).incidents,
    activity: (get("/api/activity") as { activity: EngineOverview["activity"] }).activity,
    reports: []
  };
}

beforeEach(() => vi.clearAllMocks());

describe("admin Event Engine page", () => {
  it("renders agents, owner decisions, coverage, sources, budget and the kill switch from real engine payloads", async () => {
    vi.mocked(getEngineOverview).mockResolvedValue(overviewFromEngine());
    const html = renderToStaticMarkup(await AdminEnginePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Event Engine");
    expect(html).toContain("Wyłącznik awaryjny");
    expect(html).toContain("Source Discovery");
    expect(html).toContain("Financial Controller");
    expect(html).toContain("Zatwierdź reguły automatycznej akceptacji źródeł");
    expect(html).toContain("L5_organizer_own_channel: Własny kanał organizatora");
    expect(html).toContain("„Zabrania się kopiowania treści”");
    expect(html).toContain("Mapa pokrycia Polski");
    expect(html).toContain("engineTile engineTileGap"); // podlaskie gap
    expect(html).toContain("GOK Przykładowo");
    expect(html).toContain("Wycofaj rekordy");
    expect(html).toContain("Zapisz limity");
    expect(html).toContain("do moderacji");
    expect(html).not.toContain("service_role");
    if (process.env.ENGINE_PANEL_PREVIEW) {
      mkdirSync("engine/.data", { recursive: true });
      writeFileSync("engine/.data/panel-preview.html", `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../../app/globals.css"><link rel="stylesheet" href="../../app/subpages.css"><link rel="stylesheet" href="../../app/admin/engine/engine.css"></head><body>${html}</body></html>`);
    }
  });

  it("shows a setup hint when the engine is not configured or unreachable", async () => {
    vi.mocked(engineConfigured).mockReturnValueOnce(false);
    let html = renderToStaticMarkup(await AdminEnginePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("ENGINE_CONTROL_URL");
    vi.mocked(getEngineOverview).mockRejectedValueOnce(new EngineUnavailableError("Silnik niedostępny: timeout"));
    html = renderToStaticMarkup(await AdminEnginePage({ searchParams: Promise.resolve({ error: "x" }) }));
    expect(html).toContain("Silnik niedostępny: timeout");
  });
});
