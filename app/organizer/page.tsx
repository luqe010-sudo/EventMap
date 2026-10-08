import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import { OrganizerUpgradeForm } from "@/components/OrganizerAccountForms";
import {
  getOrganizerDashboard,
  getOrganizerEntryContext,
  organizerMarkNotificationReadAction
} from "@/lib/organizer-events";
import { formatPolishDate } from "@/lib/date-format";
import OrganizerStatisticsNotice from "@/components/OrganizerStatisticsNotice";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
  const context = await getOrganizerEntryContext();
  if (context.profile?.role === "admin") redirect("/admin");

  if (!context.isOrganizer) {
    return (
      <main className="appShell managementShell">
        <OrganizerUpgradeForm displayName={context.profile?.display_name} />
      </main>
    );
  }

  const dashboard = await getOrganizerDashboard();

  if (!dashboard.memberships.length) {
    return (
      <main className="appShell managementShell">
        <div className="emptyState">
          <h1>Brakuje organizatora</h1>
          <p>Twoje konto nie jest jeszcze powiązane z profilem organizatora. Skontaktuj się z administratorem, aby uzyskać dostęp.</p>
          <Link href="/organizer/settings" className="primaryButton">Przejdź do ustawień</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Dashboard</h1>
        </div>
        <Link href="/organizer/events/new" className="primaryButton">Dodaj wydarzenie</Link>
      </div>

      <OrganizerSectionNav active="dashboard" />
      <OrganizerStatisticsNotice analyticsStatus={dashboard.stats.analyticsStatus} savesStatus={dashboard.stats.savesStatus} />

      <section className="managementStats organizerStatsWide">
        <StatCard label="Aktywne wydarzenia" value={dashboard.activeEvents} />
        <StatCard label="Do zatwierdzenia" value={dashboard.pendingReview} />
        <StatCard label="Wyswietlenia w tym miesiacu" value={dashboard.stats.monthViews} />
        <StatCard label="Kliknięcia kontaktu w tym miesiącu" value={dashboard.stats.contactClicks} />
      </section>

      <div className="organizerDashboardGrid">
        <section className="managementPanel">
          <div className="managementPanelHeader">
            <h2>Najblizsze wydarzenia</h2>
            <Link href="/organizer/events">Wszystkie</Link>
          </div>
          {dashboard.upcomingEvents.length ? (
            <ul className="organizerEventList">
              {dashboard.upcomingEvents.map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{formatDate(event.start_at)} - {event.location?.city?.name ?? "bez miasta"}</span>
                  </div>
                  <span className="statusPill">{statusLabel(event.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panelMutedText">Nie masz jeszcze nadchodzacych wydarzen.</p>
          )}
        </section>

        <section className="managementPanel">
          <div className="managementPanelHeader">
            <h2>Komunikaty od admina</h2>
          </div>
          {dashboard.notifications.length ? (
            <ul className="organizerEventList">
              {dashboard.notifications.map((notification) => (
                <li key={notification.id} className={notification.is_read ? "" : "organizerNotificationUnread"}>
                  <div>
                    <strong>{notification.title}</strong>
                    <span>{notification.message ?? "Nowy komunikat w panelu."}</span>
                  </div>
                  {!notification.is_read ? (
                    <form action={organizerMarkNotificationReadAction.bind(null, notification.id)}>
                      <button type="submit" className="secondaryButton">OK</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : dashboard.rejectedEvents.length ? (
            <ul className="organizerEventList">
              {dashboard.rejectedEvents.map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.review_note ?? "Wydarzenie odrzucone. Skontaktuj sie z administratorem, aby poznac szczegoly."}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panelMutedText">Brak nowych komunikatow.</p>
          )}
        </section>

        <section className="managementPanel">
          <div className="managementPanelHeader">
            <h2>Moje miejsca</h2>
          </div>
          {dashboard.locations.length ? (
            <ul className="organizerPlainList">
              {dashboard.locations.map((location) => (
                <li key={location.id}>
                  <strong>{location.name}</strong>
                  <span>{location.city} - {location.eventsCount} wydarzen</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panelMutedText">Miejsca pojawia sie po dodaniu wydarzen z lokalizacja.</p>
          )}
        </section>

        <section className="managementPanel">
          <div className="managementPanelHeader">
            <h2>Statystyki</h2>
            <Link href="/organizer/stats">Szczegoly</Link>
          </div>
          <div className="organizerMetricList">
            <span>Bieżące zapisania wydarzeń: <strong>{dashboard.stats.currentSaves ?? "—"}</strong></span>
            <span>Kliknięcia serca w tym miesiącu: <strong>{dashboard.stats.saveClicks ?? "—"}</strong></span>
            <span>Kliknięcia biletów w tym miesiącu: <strong>{dashboard.stats.ticketClicks ?? "—"}</strong></span>
            <span>Udostępnienia w tym miesiącu: <strong>{dashboard.stats.shares ?? "—"}</strong></span>
          </div>
          <p className="panelMutedText">Interakcje obejmują zarejestrowane wyświetlenia i kliknięcia, a nie unikalne osoby. Bieżące zapisania i kliknięcia serca są oddzielnymi miarami. Miesiąc liczymy według czasu w Polsce.</p>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="managementStat">
      <span>{value ?? "—"}</span>
      <p>{label}</p>
    </div>
  );
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: string | null) {
  const labels: Record<string, string> = {
    draft: "Szkic",
    pending_review: "Oczekuje",
    published: "Opublikowane",
    rejected: "Odrzucone",
    archived: "Archiwalne"
  };
  return labels[status ?? "draft"] ?? status ?? "Szkic";
}
