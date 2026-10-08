import Link from "next/link";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import { getOrganizerStats } from "@/lib/organizer-events";
import { formatPolishDate } from "@/lib/date-format";
import OrganizerStatisticsNotice from "@/components/OrganizerStatisticsNotice";

export const dynamic = "force-dynamic";

export default async function OrganizerStatsPage() {
  const stats = await getOrganizerStats();
  const rows = stats.rows;

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Statystyki wydarzen</h1>
        </div>
      </div>

      <OrganizerSectionNav active="stats" />
      <OrganizerStatisticsNotice analyticsStatus={stats.analyticsStatus} savesStatus={stats.savesStatus} />

      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Wyniki wydarzen</h2>
          <Link href="/organizer/events">Moje wydarzenia</Link>
        </div>
        <p className="panelMutedText">
          Wyświetlenia i kliknięcia obejmują cały zarejestrowany okres, a nie unikalne osoby. Kliknięcia serca i bieżące zapisania są oddzielnymi miarami; usunięte zapisanie nie zmniejsza historycznej liczby kliknięć.
        </p>
        <div className="managementTableWrap" tabIndex={0} role="region" aria-label="Statystyki wydarzeń — tabela przewijana poziomo">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Wydarzenie</th>
                <th>Data</th>
                <th>Wyswietlenia</th>
                <th>Telefon</th>
                <th>WWW</th>
                <th>Mapa</th>
                <th>Bilety</th>
                <th>Kliknięcia serca</th>
                <th>Bieżące zapisania</th>
                <th>Udostepnienia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.event.id}>
                  <td>{row.event.title}</td>
                  <td>{formatDate(row.event.start_at)}</td>
                  <td>{row.views ?? "—"}</td>
                  <td>{row.phoneClicks ?? "—"}</td>
                  <td>{row.websiteClicks ?? "—"}</td>
                  <td>{row.mapClicks ?? "—"}</td>
                  <td>{row.ticketClicks ?? "—"}</td>
                  <td>{row.saveClicks ?? "—"}</td>
                  <td>{row.currentSaves ?? "—"}</td>
                  <td>{row.shares ?? "—"}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={10} className="emptyTableCell">Brak wydarzen do pokazania statystyk.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}
