import { CalendarDays, MapPin } from "lucide-react";
import type { EventItem } from "@/lib/events";
import { isFreeEvent } from "@/lib/events";
import { formatEventCardDate, formatEventCardDistance, formatEventCardLocation, formatEventCardPrice } from "@/lib/event-presentation";

type EventCardContentProps = {
  event: EventItem;
  distanceKm: number;
  decorative?: boolean;
};

export default function EventCardContent({ event, distanceKm, decorative = false }: EventCardContentProps) {
  const dateStr = formatEventCardDate(event);
  const isFree = isFreeEvent(event);

  return (
    <>
      <div className="eventCardHImageWrap">
        <img
          src={event.imageUrl}
          alt={decorative ? "" : event.title}
          className="eventCardHImage"
          loading="lazy"
          draggable={decorative ? false : undefined}
        />
      </div>
      <div className="eventCardHBody">
        <div className="eventCardHTop">
          <span className="eventCardHCategory" style={{ color: event.categoryColor }}>
            {event.category}
          </span>
          <div className="eventCardHTopRight">
            <time className="eventCardHDate" dateTime={event.startDate}>
              <CalendarDays size={14} aria-hidden="true" />
              {dateStr}
            </time>
          </div>
        </div>
        <h3 className="eventCardHTitle">{event.title}</h3>
        <p className="eventCardHDesc">{event.short_description ?? event.description}</p>
        <div className="eventCardHBottom">
          <span className="eventCardHLocation">
            <MapPin size={14} aria-hidden="true" />
            <span>{formatEventCardLocation(event)}</span>
          </span>
          <div className="eventCardHPriceDist">
            {Number.isFinite(distanceKm) ? <span className="eventCardHDist">{formatEventCardDistance(distanceKm)}</span> : null}
            <span className={`eventCardHPrice ${isFree ? "eventCardHPriceFree" : ""}`}>
              {formatEventCardPrice(event)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
