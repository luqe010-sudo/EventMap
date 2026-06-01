import Link from "next/link";
import { getAdminDashboard } from "@/lib/admin-events";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboard();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Moderacja wydarzen</h1>
        </div>
        <div className="managementActions">
          <Link href="/admin/organizers" className="secondaryButton">Organizatorzy</Link>
          <Link href="/admin/events/new" className="primaryButton">Dodaj wydarzenie</Link>
        </div>
      </div>

      <section className="managementStats">
        <StatCard label="Do akceptacji" value={dashboard.pendingReview} />
        <StatCard label="Opublikowane" value={dashboard.published} />
        <StatCard label="Odrzucone" value={dashboard.rejected} />
      </section>

      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Ostatnio dodane wydarzenia</h2>
          <Link href="/admin/events">Wszystkie wydarzenia</Link>
        </div>
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Tytul</th>
                <th>Data</th>
                <th>Miasto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentEvents.map((event) => (
                <tr key={event.id}>
                  <td><Link href={`/admin/events/${event.id}/edit`}>{event.title}</Link></td>
                  <td>{formatDate(event.start_at)}</td>
                  <td>{event.location?.city ?? "-"}</td>
                  <td><span className="statusPill">{event.status ?? "draft"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="managementStat">
      <span>{value}</span>
      <p>{label}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
