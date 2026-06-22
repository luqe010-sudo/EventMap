import Link from "next/link";
import type { EventItem } from "@/lib/events";
import SavedEventCard from "@/components/SavedEventCard";

export default function SavedEventsPanel({
  events,
  error
}: {
  events: EventItem[];
  error: string | null;
}) {
  return (
    <section className="managementPanel accountSavedSection" id="saved-events">
      <div className="managementPanelHeader">
        <div>
          <p className="eyebrow">Twoja lista</p>
          <h2>Zapisane wydarzenia</h2>
        </div>
        <span className="accountSavedCount">{events.length}</span>
      </div>

      {error ? <div className="formError" role="alert">{error}</div> : null}
      {!error && events.length === 0 ? (
        <div className="accountEmptyState">
          <h3>Nie masz jeszcze zapisanych wydarzeń</h3>
          <p>Na stronie wydarzenia kliknij „Zapisz”, a pojawi się ono tutaj.</p>
          <Link href="/">Odkryj wydarzenia</Link>
        </div>
      ) : null}
      {events.length > 0 ? (
        <div className="accountSavedGrid">
          {events.map((event) => <SavedEventCard key={event.id} event={event} />)}
        </div>
      ) : null}
    </section>
  );
}
