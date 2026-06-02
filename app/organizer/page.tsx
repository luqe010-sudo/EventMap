import Link from "next/link";
import { getOrganizerDashboard } from "@/lib/organizer-events";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
  const dashboard = await getOrganizerDashboard();

  if (!dashboard.memberships.length) {
    return (
      <main className="appShell managementShell">
        <div className="emptyState">
          <h1>Brakuje organizatora</h1>
          <p>Twoje konto ma role organizatora, ale nie jest polaczone z zadnym rekordem w `organizer_users`.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Moje wydarzenia</h1>
        </div>
        <Link href="/organizer/events/new" className="primaryButton">Dodaj wydarzenie</Link>
      </div>

      <section className="managementStats">
        {["draft", "pending_review", "published", "rejected", "archived"].map((status) => (
          <div key={status} className="managementStat">
            <span>{dashboard.statusCounts.get(status) ?? 0}</span>
            <p>{status}</p>
          </div>
        ))}
      </section>

      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Wydarzenia organizatora</h2>
        </div>
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Tytul</th>
                <th>Data</th>
                <th>Miasto</th>
                <th>Kategoria</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.events.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{formatDate(event.start_at)}</td>
                  <td>{event.location?.city ?? "-"}</td>
                  <td>{event.category?.name ?? "-"}</td>
                  <td><span className="statusPill">{event.status ?? "draft"}</span></td>
                  <td><Link href={`/organizer/events/${event.id}/edit`}>Edytuj</Link></td>
                </tr>
              ))}
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
