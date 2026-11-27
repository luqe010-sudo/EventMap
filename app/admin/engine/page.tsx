import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import { requireAdmin } from "@/lib/auth";
import { formatPolishDate } from "@/lib/date-format";
import { type EngineCoverage, type EngineDecision, type EngineOverview, engineConfigured, EngineUnavailableError, getEngineOverview } from "@/lib/engine-control";
import { engineAddSourceAction, engineAgentAction, engineBudgetAction, engineDecisionAction, engineKillAction, engineSourceAction } from "@/lib/engine-control-actions";
import "./engine.css";

export const dynamic = "force-dynamic";

const SOURCE_TABS: Array<{ key: string; label: string }> = [
  { key: "", label: "Ostatnio zmienione" }, { key: "needs_owner", label: "Do decyzji" }, { key: "active", label: "Aktywne" },
  { key: "failing", label: "Awarie" }, { key: "blocked", label: "Zablokowane" }, { key: "discovered", label: "Odkryte" }, { key: "no_integration", label: "Bez kanału" }
];

const STATUS_LABELS: Record<string, string> = {
  discovered: "odkryte", probing: "sondowanie", legal_review: "weryfikacja prawna", needs_owner: "decyzja właściciela", approved: "zatwierdzone",
  blocked: "zablokowane", active: "aktywne", paused: "wstrzymane", failing: "awaria", no_integration: "bez kanału", retracted: "wycofane"
};

// Tile-grid cartogram of the 16 voivodeships (column, row).
const REGION_GRID: Record<string, [number, number]> = {
  "pomorskie": [3, 1], "warmińsko-mazurskie": [4, 1], "zachodniopomorskie": [1, 1], "podlaskie": [5, 2],
  "kujawsko-pomorskie": [3, 2], "lubuskie": [1, 2], "wielkopolskie": [2, 2], "mazowieckie": [4, 2],
  "dolnośląskie": [1, 3], "łódzkie": [3, 3], "lubelskie": [5, 3], "opolskie": [2, 4], "świętokrzyskie": [4, 3],
  "śląskie": [3, 4], "małopolskie": [4, 4], "podkarpackie": [5, 4]
};

type PageProps = { searchParams: Promise<{ sources?: string; notice?: string; error?: string }> };

export default async function AdminEnginePage({ searchParams }: PageProps) {
  await requireAdmin("/admin/engine");
  const params = await searchParams;
  const sourceStatus = SOURCE_TABS.some(tab => tab.key === params.sources) ? params.sources ?? "" : "";

  let overview: EngineOverview | null = null;
  let unavailable: string | null = null;
  if (!engineConfigured()) unavailable = "Silnik nie jest jeszcze podłączony. Ustaw ENGINE_CONTROL_URL i ENGINE_CONTROL_TOKEN (zmienne serwerowe) — instrukcja w docs/event-engine/RUNBOOK.md.";
  else {
    try { overview = await getEngineOverview(sourceStatus || null); }
    catch (error) { if (error instanceof EngineUnavailableError) unavailable = error.message; else throw error; }
  }

  return (
    <main className="appShell managementShell engineShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Event Engine</h1>
        </div>
        {overview ? <KillSwitch kill={overview.status.kill} /> : null}
      </div>
      <AdminSectionNav active="engine" />

      {params.notice ? <p className="engineNotice" role="status">{params.notice}</p> : null}
      {params.error ? <p className="formError" role="alert">{params.error}</p> : null}
      {unavailable ? <section className="managementPanel"><p className="engineEmpty">{unavailable}</p></section> : null}
      {overview ? <EngineDashboard overview={overview} sourceStatus={sourceStatus} /> : null}
    </main>
  );
}

function KillSwitch({ kill }: { kill: EngineOverview["status"]["kill"] }) {
  return (
    <form action={engineKillAction} className={`engineKill ${kill.active ? "engineKillActive" : ""}`}>
      <input type="hidden" name="active" value={kill.active ? "0" : "1"} />
      {kill.active ? <span className="engineKillState">Zatrzymany{kill.reason ? `: ${kill.reason}` : ""}{kill.source === "file" ? " (plik KILL na serwerze)" : ""}</span> : <input name="reason" className="tableActionInput" placeholder="Powód (opcjonalnie)" maxLength={300} />}
      <button type="submit" className={kill.active ? "primaryButton" : "engineKillButton"} disabled={kill.source === "file"}>
        {kill.active ? "Wznów silnik" : "Wyłącznik awaryjny"}
      </button>
    </form>
  );
}

function EngineDashboard({ overview, sourceStatus }: { overview: EngineOverview; sourceStatus: string }) {
  const { status } = overview;
  const today = status.today;
  const n = (key: string) => today[key] ?? 0;
  return (
    <>
      <section className="managementStats engineStats">
        <Stat label="Opublikowane dziś" value={n("events_published")} />
        <Stat label="Do moderacji dziś" value={n("events_pending_review")} hint={<Link href="/admin/review">Otwórz moderację</Link>} />
        <Stat label="Nowe wyodrębnione dziś" value={n("events_extracted")} />
        <Stat label="Aktualizacje / odwołania" value={`${n("events_updated")} / ${n("events_cancelled")}`} />
        <Stat label="Aktywne źródła" value={status.sources.active ?? 0} />
        <Stat label="Decyzje właściciela" value={status.openDecisions} tone={status.openDecisions ? "warn" : undefined} />
        <Stat label="Koszt w miesiącu" value={`${status.costs.month.toFixed(2)} zł`} hint={`limit ${status.costs.limits.monthlyPln} zł`} />
        <Stat label="Koszt / wydarzenie" value={status.costs.costPerPublishedEvent === null ? "—" : `${status.costs.costPerPublishedEvent.toFixed(3)} zł`} />
      </section>

      <section className="managementPanel engineMeta">
        <span>Środowisko: <strong>{status.config.env}</strong></span>
        <span>Tryb publikacji: <strong>{publishModeLabel(status.config.publishMode)}</strong></span>
        <span>Supabase: {status.config.supabase ? "odczyt OK" : "brak"}</span>
        <span>Powiadomienia: {status.config.notify ? "włączone" : "brak kanału"}</span>
        <span>Kopia zapasowa: {status.lastBackup ? formatDate(status.lastBackup.at) : "brak"}</span>
        <span>Stan na: {formatDate(status.generatedAt)}</span>
      </section>

      <Decisions decisions={overview.decisions} legal={status.legalRules} />

      <section className="managementPanel">
        <div className="managementPanelHeader"><h2>Agenci</h2></div>
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead><tr><th>Agent</th><th>Stan</th><th>Kolejka</th><th>Przebiegi</th><th>Ostatni błąd</th><th>Akcje</th></tr></thead>
            <tbody>
              {status.agents.map(agent => {
                const stale = agent.lastHeartbeat ? Date.now() - Date.parse(agent.lastHeartbeat) > 5 * 60_000 : true;
                return (
                  <tr key={agent.name}>
                    <td><strong>{agent.title}</strong><p className="tableSubtext">{agent.description}</p></td>
                    <td>{agent.paused ? <span className="warningPill">wstrzymany</span> : stale ? <span className="warningPill">brak sygnału</span> : <span className="successPill">działa</span>}
                      <p className="tableSubtext">{agent.lastRunAt ? formatDate(agent.lastRunAt) : "—"}</p></td>
                    <td>{agent.queued} czeka · {agent.running} w toku{agent.dead ? <> · <span className="engineDanger">{agent.dead} martwe</span></> : null}</td>
                    <td>{agent.runsOk} OK · {agent.runsFailed} błędów</td>
                    <td className="engineError">{agent.lastError ?? "—"}</td>
                    <td>
                      <form action={engineAgentAction} className="tableActions">
                        <input type="hidden" name="agent" value={agent.name} />
                        <input type="hidden" name="action" value={agent.paused ? "resume" : "pause"} />
                        <button type="submit">{agent.paused ? "Wznów" : "Wstrzymaj"}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Coverage coverage={overview.coverage} />

      <section className="managementPanel">
        <div className="managementPanelHeader"><h2>Rejestr źródeł i uprawnień</h2></div>
        <nav className="engineTabs" aria-label="Filtr źródeł">
          {SOURCE_TABS.map(tab => (
            <Link key={tab.key} href={tab.key ? `/admin/engine?sources=${tab.key}` : "/admin/engine"} className={tab.key === sourceStatus ? "engineTabActive" : ""}>
              {tab.label}{tab.key && status.sources[tab.key] ? ` (${status.sources[tab.key]})` : ""}
            </Link>
          ))}
        </nav>
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead><tr><th>Źródło</th><th>Status</th><th>Podstawa prawna</th><th>Kanał</th><th>Wydarzenia</th><th>Akcje</th></tr></thead>
            <tbody>
              {overview.sources.length ? overview.sources.map(source => (
                <tr key={source.id}>
                  <td><a href={source.url} target="_blank" rel="noopener noreferrer nofollow">{source.name ?? source.domain}</a>
                    <p className="tableSubtext">{source.domain} · {[source.city, source.voivodeship].filter(Boolean).join(", ") || "region nieznany"} · {source.discovered_via ?? ""}</p></td>
                  <td><span className={source.status === "active" ? "successPill" : source.status === "blocked" || source.status === "failing" ? "warningPill" : "statusPill"}>{STATUS_LABELS[source.status] ?? source.status}</span>
                    {source.last_error ? <p className="tableSubtext engineError">{source.last_error}</p> : null}</td>
                  <td><strong>{source.legal_rule ?? "—"}</strong><p className="tableSubtext">{source.legal_basis ?? ""}</p></td>
                  <td>{source.integration_type}{source.autopublish ? <p className="tableSubtext">autopublikacja</p> : null}</td>
                  <td>{source.events_found_total} znalezione · {source.events_published_total} opubl.</td>
                  <td>
                    <div className="tableActions">
                      <SourceButton id={source.id} action={source.status === "paused" ? "resume" : "pause"} label={source.status === "paused" ? "Wznów" : "Wstrzymaj"} />
                      <SourceButton id={source.id} action="recheck" label="Sprawdź ponownie" />
                      {source.status === "active" ? <SourceButton id={source.id} action="autopublish" enabled={!source.autopublish} label={source.autopublish ? "Wyłącz autopublikację" : "Włącz autopublikację"} /> : null}
                      {source.events_published_total > 0 || source.status === "active" ? <SourceButton id={source.id} action="retract" label="Wycofaj rekordy" danger /> : null}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={6} className="emptyTableCell">Brak źródeł w tym widoku.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={engineAddSourceAction} className="engineInlineForm">
          <strong>Dodaj źródło</strong>
          <input name="url" type="url" required placeholder="https://strona-organizatora.pl" className="tableActionInput" />
          <input name="name" placeholder="Nazwa (opcjonalnie)" className="tableActionInput" maxLength={300} />
          <input name="city" placeholder="Miasto" className="tableActionInput" maxLength={120} />
          <select name="kind" className="tableActionInput" defaultValue="organizer">
            <option value="organizer">organizator</option><option value="venue">obiekt</option><option value="institution">instytucja kultury</option><option value="municipality">gmina / samorząd</option>
          </select>
          <button type="submit" className="secondaryButton">Dodaj do weryfikacji</button>
        </form>
      </section>

      <section className="managementPanel engineTwoCols">
        <div>
          <h2>Koszty operacyjne</h2>
          <p>Dziś: <strong>{status.costs.today.toFixed(2)} zł</strong> / {status.costs.limits.dailyPln} zł · Miesiąc: <strong>{status.costs.month.toFixed(2)} zł</strong> / {status.costs.limits.monthlyPln} zł · Infrastruktura: {status.costs.infraMonthPln} zł/mies.</p>
          <ul className="engineList">
            {status.costs.byProvider.length ? status.costs.byProvider.map(row => <li key={`${row.provider}-${row.category}`}>{row.provider} ({row.category}): {row.amount.toFixed(2)} zł, {row.units} jedn.</li>) : <li>Brak płatnych operacji w tym miesiącu.</li>}
          </ul>
        </div>
        <form action={engineBudgetAction} className="engineBudget">
          <h2>Budżet (twarde limity)</h2>
          <label>Dzienny limit (zł) <input name="dailyPln" type="number" min={0} max={status.costs.ceilings.dailyPln} step="0.5" defaultValue={status.costs.limits.dailyPln} /></label>
          <label>Miesięczny limit (zł) <input name="monthlyPln" type="number" min={0} max={status.costs.ceilings.monthlyPln} step="1" defaultValue={status.costs.limits.monthlyPln} /></label>
          <p className="tableSubtext">Górny pułap z konfiguracji serwera: {status.costs.ceilings.dailyPln} zł/dzień, {status.costs.ceilings.monthlyPln} zł/mies. Agenci nie mogą zmieniać limitów. Po przekroczeniu zatrzymują się tylko płatne operacje.</p>
          <button type="submit" className="primaryButton">Zapisz limity</button>
        </form>
      </section>

      <section className="managementPanel engineTwoCols">
        <div>
          <h2>Incydenty</h2>
          <ul className="engineList">
            {overview.incidents.length ? overview.incidents.map(incident => (
              <li key={incident.id} className={incident.status === "open" ? "" : "engineMuted"}>
                <span className={incident.severity === "critical" ? "engineDanger" : ""}>[{incident.severity}]</span> {incident.message}
                {incident.remediation ? <p className="tableSubtext">{incident.remediation}</p> : null}
              </li>
            )) : <li>Brak incydentów.</li>}
          </ul>
        </div>
        <div>
          <h2>Historia działań</h2>
          <ul className="engineList engineLog">
            {overview.activity.map(entry => (
              <li key={entry.id}><time>{formatDate(entry.at)}</time> <span className={entry.level === "error" ? "engineDanger" : ""}>{entry.agent ?? "system"}</span>: {entry.message}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="managementPanel">
        <div className="managementPanelHeader"><h2>Raport dzienny</h2></div>
        {overview.reports[0] ? <pre className="engineReport">{overview.reports[0].markdown}</pre> : <p className="engineEmpty">Pierwszy raport pojawi się następnego dnia po 7:00.</p>}
      </section>
    </>
  );
}

function Decisions({ decisions, legal }: { decisions: EngineDecision[]; legal: EngineOverview["status"]["legalRules"] }) {
  return (
    <section className="managementPanel">
      <div className="managementPanelHeader"><h2>Kolejka decyzji właściciela</h2></div>
      {!decisions.length ? <p className="engineEmpty">Brak decyzji do podjęcia.</p> : (
        <ul className="engineDecisions">
          {decisions.map(decision => (
            <li key={decision.id}>
              <p className="eyebrow">{decisionKindLabel(decision.kind)} · {formatDate(decision.created_at)}</p>
              <h3>{decision.title}</h3>
              <DecisionDetails decision={decision} />
              <form action={engineDecisionAction} className="engineDecisionForm">
                <input type="hidden" name="id" value={decision.id} />
                {decision.kind === "legal_ruleset" ? (
                  <fieldset>
                    <legend>Reguły automatycznej akceptacji (wersja {legal.version})</legend>
                    {Object.entries(legal.rules).map(([id, rule]) => (
                      <label key={id} className="engineRule">
                        <input type="checkbox" name="rules" value={id} defaultChecked />
                        <span><strong>{id}: {rule.title}</strong><br />{rule.description}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}
                <input name="note" className="tableActionInput" placeholder="Notatka (opcjonalnie)" maxLength={2000} />
                <button type="submit" name="resolution" value="approved" className="primaryButton">Zatwierdź</button>
                <button type="submit" name="resolution" value="rejected" className="secondaryButton">Odrzuć</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DecisionDetails({ decision }: { decision: EngineDecision }) {
  const details = decision.details;
  if (decision.kind === "source_approval") {
    const evidence = Array.isArray(details.evidence) ? details.evidence as string[] : [];
    return (
      <div className="tableSubtext">
        <p><a href={String(details.url ?? "#")} target="_blank" rel="noopener noreferrer nofollow">{String(details.url ?? "")}</a> · {String(details.kind ?? "")} · kanał {String(details.integration ?? "brak")}</p>
        <p>{String(details.basis ?? "")}</p>
        {evidence.length ? <ul>{evidence.map(item => <li key={item}>„{item}”</li>)}</ul> : null}
      </div>
    );
  }
  if (decision.kind === "missing_cities" && Array.isArray(details.cities)) {
    return <p className="tableSubtext">{(details.cities as Array<{ name: string; voivodeship: string | null; count: number }>).map(city => `${city.name}${city.voivodeship ? ` (${city.voivodeship})` : ""}: ${city.count}`).join(", ")}. <Link href="/admin/cities">Dodaj w Miastach SEO</Link>.</p>;
  }
  if (decision.kind === "code_repair") return <p className="tableSubtext">{String(details.note ?? "")}</p>;
  return null;
}

function Coverage({ coverage }: { coverage: EngineCoverage }) {
  const regions = coverage.coverage?.regions ?? [];
  const max = Math.max(1, ...regions.map(region => region.events));
  const activeSources = (name: string) => coverage.sources.filter(row => row.voivodeship === name && row.status === "active").reduce((sum, row) => sum + row.n, 0);
  const allSources = (name: string) => coverage.sources.filter(row => row.voivodeship === name).reduce((sum, row) => sum + row.n, 0);
  return (
    <section className="managementPanel">
      <div className="managementPanelHeader">
        <h2>Mapa pokrycia Polski</h2>
        <span className="tableSubtext">{coverage.computedAt ? `Najbliższe 60 dni · ${coverage.coverage?.totalEvents ?? 0} wydarzeń · ${formatDate(coverage.computedAt)}` : "Analiza Growth Agent jeszcze nie wykonana"}</span>
      </div>
      <div className="engineCoverage">
        <div className="engineGrid" role="list" aria-label="Województwa">
          {Object.entries(REGION_GRID).map(([name, [col, row]]) => {
            const region = regions.find(item => item.name === name);
            const events = region?.events ?? 0;
            const intensity = events / max;
            return (
              <div key={name} role="listitem" className={`engineTile ${region && region.gap > 0.02 ? "engineTileGap" : ""}`} style={{ gridColumn: col, gridRow: row, ["--intensity" as string]: intensity.toFixed(2) }}>
                <strong>{name}</strong>
                <span>{events} wydarzeń</span>
                <span>{activeSources(name)}/{allSources(name)} źródeł</span>
              </div>
            );
          })}
        </div>
        <ul className="engineList">
          {Object.entries(coverage.coverage?.categories ?? {}).sort((a, b) => b[1] - a[1]).map(([category, count]) => <li key={category}>{category}: {count}</li>)}
        </ul>
      </div>
      <p className="tableSubtext">Kafelki z obramowaniem oznaczają województwa z luką (udział wydarzeń mniejszy niż udział miast) — tam Growth Agent kieruje odkrywanie źródeł.</p>
    </section>
  );
}

function SourceButton({ id, action, label, enabled, danger }: { id: number; action: string; label: string; enabled?: boolean; danger?: boolean }) {
  return (
    <form action={engineSourceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {enabled !== undefined ? <input type="hidden" name="enabled" value={enabled ? "1" : "0"} /> : null}
      <button type="submit" className={danger ? "dangerButton" : undefined}>{label}</button>
    </form>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: React.ReactNode; tone?: "warn" }) {
  return (
    <div className={`managementStat ${tone === "warn" ? "engineStatWarn" : ""}`}>
      <span>{value}</span>
      <p>{label}</p>
      {hint ? <p className="tableSubtext">{hint}</p> : null}
    </div>
  );
}

function publishModeLabel(mode: string) {
  return ({ off: "wyłączona", dry_run: "symulacja", pending_review: "do moderacji", publish: "automatyczna" } as Record<string, string>)[mode] ?? mode;
}

function decisionKindLabel(kind: string) {
  return ({ source_approval: "Zgoda na źródło", legal_ruleset: "Reguły prawne", missing_cities: "Brakujące miasta", code_repair: "Naprawa kodu" } as Record<string, string>)[kind] ?? kind;
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "short", timeStyle: "short" });
}
