"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import type { EventItem } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import EventCardContent from "@/components/EventCardContent";
import EventCardSaveButton from "@/components/EventCardSaveButton";

type EventCardProps = {
  event: EventItem;
  distanceKm: number;
  listing?: boolean;
  onShowOnMap?: (eventId: string) => void;
  onOpenEvent?: (eventId: string) => void;
};

export default function EventCard({ event, distanceKm, listing, onShowOnMap, onOpenEvent }: EventCardProps) {
  function handleCardClick(e: React.MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!onOpenEvent) return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    e.preventDefault();
    onOpenEvent(event.id);
  }

  return (
    <article className="eventCardH">
      <Link href={eventPath(event)} className="eventCardHLink" onClick={handleCardClick}>
        <EventCardContent event={event} distanceKm={distanceKm} listing={listing} />
      </Link>
      <EventCardSaveButton eventId={event.id} returnTo={eventPath(event)} />
      {onShowOnMap && event.latitude != null && event.longitude != null ? (
        <button
          type="button"
          className="eventCardHMapButton"
          onClick={() => onShowOnMap(event.id)}
          aria-label={`Pokaż na mapie: ${event.title}`}
          title={listing ? "Pokaż na mapie" : undefined}
        >
          <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />
          <span className={listing ? "srOnly" : undefined}>Pokaż na mapie</span>
        </button>
      ) : null}
    </article>
  );
}
