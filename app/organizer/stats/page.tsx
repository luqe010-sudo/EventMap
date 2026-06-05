import Link from "next/link";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import { getOrganizerStats } from "@/lib/organizer-events";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

export default async function OrganizerStatsPage() {
  const rows = await getOrganizerStats();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Statystyki wydarzen</h1>
        </div>
      </div>

      <OrganizerSectionNav active="stats" />

      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Wyniki wydarzen</h2>
          <Link href="/organizer/events">Moje wydarzenia</Link>
        </div>
        <p className="panelMutedText">
          Wyswietlenia i klikniecia sa liczone z `event_analytics`; zapisania dodatkowo uwzgledniaja `saved_events`.
        </p>
        <div className="managementTableWrap">
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
                <th>Zapisania</th>
                <th>Udostepnienia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.event.id}>
                  <td>{row.event.title}</td>
                  <td>{formatDate(row.event.start_at)}</td>
                  <td>{row.views}</td>
                  <td>{row.phoneClicks}</td>
                  <td>{row.websiteClicks}</td>
                  <td>{row.mapClicks}</td>
                  <td>{row.ticketClicks}</td>
                  <td>{row.saves}</td>
                  <td>{row.shares}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="emptyTableCell">Brak wydarzen do pokazania statystyk.</td>
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
