import Link from "next/link";
import type { EventItem } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { eventPath } from "@/lib/slugs";
import { removeSavedEventAction } from "@/lib/user-account-actions";

export default function SavedEventCard({ event }: { event: EventItem }) {
  const removeAction = removeSavedEventAction.bind(null, event.id);

  return (
    <article className="accountSavedCard">
      <Link href={eventPath(event)} className="accountSavedCardLink">
        <img src={event.imageUrl} alt="" loading="lazy" />
        <div className="accountSavedCardBody">
          <span className="accountSavedCategory" style={{ color: event.categoryColor }}>
            {event.category}
          </span>
          <h3>{event.title}</h3>
          <p>
            {formatPolishDate(event.startDate, {
              weekday: "short",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </p>
          <span>{event.city || event.address || "Polska"}</span>
        </div>
      </Link>
      <form action={removeAction} className="accountSavedRemoveForm">
        <button type="submit" className="accountSavedRemove" aria-label={`Usuń zapis wydarzenia ${event.title}`}>
          Usuń z zapisanych
        </button>
      </form>
    </article>
  );
}
