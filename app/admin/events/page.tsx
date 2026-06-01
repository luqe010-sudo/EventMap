import Link from "next/link";
import {
  adminDeleteEventAction,
  adminSetEventStatusAction,
  listAdminEvents
} from "@/lib/admin-events";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await listAdminEvents();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Wydarzenia</h1>
        </div>
        <div className="managementActions">
          <Link href="/admin/organizers/new" className="secondaryButton">Dodaj organizatora</Link>
          <Link href="/admin/events/new" className="primaryButton">Dodaj wydarzenie</Link>
        </div>
      </div>

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Tytul</th>
                <th>Data</th>
                <th>Miasto</th>
                <th>Kategoria</th>
                <th>Organizator</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{formatDate(event.start_at)}</td>
                  <td>{event.location?.city ?? "-"}</td>
                  <td>{event.category?.name ?? "-"}</td>
                  <td>{event.organizer?.name ?? "-"}</td>
                  <td><span className="statusPill">{event.status ?? "draft"}</span></td>
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/events/${event.id}/edit`}>Edytuj</Link>
                      <form action={adminSetEventStatusAction.bind(null, event.id, "published")}>
                        <button type="submit">Opublikuj</button>
                      </form>
                      <form action={adminSetEventStatusAction.bind(null, event.id, "rejected")}>
                        <button type="submit">Odrzuc</button>
                      </form>
                      <form action={adminSetEventStatusAction.bind(null, event.id, "archived")}>
                        <button type="submit">Archiwizuj</button>
                      </form>
                      <form action={adminDeleteEventAction.bind(null, event.id)}>
                        <button type="submit" className="dangerButton">Usun</button>
                      </form>
                    </div>
                  </td>
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
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
