"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import type { EventItem } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { eventPath } from "@/lib/slugs";
import { removeSavedEventAction } from "@/lib/user-account-actions";

export default function SavedEventCard({ event }: { event: EventItem }) {
  const pathname = usePathname();
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    setError("");
    startTransition(async () => {
      try {
        const result = await removeSavedEventAction(event.id);
        if (result.requiresLogin) {
          window.location.assign(`/login?next=${encodeURIComponent(pathname || "/account")}`);
          return;
        }
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.saved) {
          setError("Nie udało się usunąć zapisu wydarzenia. Spróbuj ponownie.");
          return;
        }
        window.dispatchEvent(new CustomEvent("eventmap:saved-event", {
          detail: { eventId: event.id, saved: false }
        }));
        setRemoved(true);
      } catch {
        setError("Nie udało się usunąć zapisu wydarzenia. Spróbuj ponownie.");
      }
    });
  }

  if (removed) return null;

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
      <div className="accountSavedRemoveForm">
        <button type="button" onClick={handleRemove} disabled={pending} className="accountSavedRemove" aria-label={`Usuń zapis wydarzenia ${event.title}`}>
          {pending ? "Usuwanie…" : "Usuń z zapisanych"}
        </button>
        {error ? <p className="formError" role="alert">{error}</p> : null}
      </div>
    </article>
  );
}
