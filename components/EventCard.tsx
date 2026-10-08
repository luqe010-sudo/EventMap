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
  onShowOnMap?: (eventId: string) => void;
  onOpenEvent?: (eventId: string) => void;
};

export default function EventCard({ event, distanceKm, onShowOnMap, onOpenEvent }: EventCardProps) {
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
        <EventCardContent event={event} distanceKm={distanceKm} />
      </Link>
      <EventCardSaveButton eventId={event.id} returnTo={eventPath(event)} />
      {onShowOnMap && event.latitude != null && event.longitude != null ? (
        <button
          type="button"
          className="eventCardHMapButton"
          onClick={() => onShowOnMap(event.id)}
          aria-label={`Pokaż na mapie: ${event.title}`}
        >
          <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />
          Pokaż na mapie
        </button>
      ) : null}
    </article>
  );
}
