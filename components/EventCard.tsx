"use client";

import Link from "next/link";
import type { EventItem } from "@/lib/events";
import { isFreeEvent } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import { formatPolishDate } from "@/lib/date-format";
import EventCardSaveButton from "@/components/EventCardSaveButton";

type EventCardProps = {
  event: EventItem;
  distanceKm: number;
};

export default function EventCard({ event, distanceKm }: EventCardProps) {
  const dateStr = formatEventDate(event.startDate);
  const isFree = isFreeEvent(event);

  return (
    <article className="eventCardH">
      <Link href={eventPath(event)} className="eventCardHLink">
        <div className="eventCardHImageWrap">
          <img src={event.imageUrl} alt={event.title} className="eventCardHImage" loading="lazy" />
        </div>
        <div className="eventCardHBody">
          <div className="eventCardHTop">
            <span className="eventCardHCategory" style={{ color: event.categoryColor }}>
              {event.category.toUpperCase()}
            </span>
            <div className="eventCardHTopRight">
              <span className="eventCardHDate">{dateStr}</span>
            </div>
          </div>
          <h3 className="eventCardHTitle">{event.title}</h3>
          <p className="eventCardHDesc">{event.short_description ?? event.description}</p>
          <div className="eventCardHBottom">
            <span className="eventCardHLocation">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {[event.city, event.address.split(",")[0]].filter(Boolean).join(" - ")}
            </span>
            <div className="eventCardHPriceDist">
              {Number.isFinite(distanceKm) ? <span className="eventCardHDist">{distanceKm.toFixed(1)} km</span> : null}
              <span className={`eventCardHPrice ${isFree ? "eventCardHPriceFree" : ""}`}>
                {isFree ? "Bezpłatne" : event.price}
              </span>
            </div>
          </div>
        </div>
      </Link>
      <EventCardSaveButton eventId={event.id} returnTo={eventPath(event)} />
    </article>
  );
}

function formatEventDate(value: string) {
  const weekday = formatPolishDate(value, { weekday: "short" });
  const dayMonth = formatPolishDate(value, { day: "numeric", month: "short" });
  const time = formatPolishDate(value, { hour: "2-digit", minute: "2-digit" });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday}, ${dayMonth} - ${time}`;
}
