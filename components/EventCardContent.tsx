import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import type { CSSProperties } from "react";
import type { EventItem } from "@/lib/events";
import { isFreeEvent } from "@/lib/events";
import { formatEventCardDate, formatEventCardDistance, formatEventCardLocation, formatEventCardPrice } from "@/lib/event-presentation";
import EventVisual from "./EventVisual";
import CategoryIcon from "./CategoryIcon";

type EventCardContentProps = {
  event: EventItem;
  distanceKm: number;
  decorative?: boolean;
  listing?: boolean;
};

export default function EventCardContent({ event, distanceKm, decorative = false, listing = false }: EventCardContentProps) {
  const dateStr = formatEventCardDate(event);
  const isFree = isFreeEvent(event);
  const price = (
    <div className="eventCardHPriceDist">
      {Number.isFinite(distanceKm) ? <span className="eventCardHDist">{formatEventCardDistance(distanceKm)}</span> : null}
      <span className={`eventCardHPrice ${isFree ? "eventCardHPriceFree" : ""}`}>
        {formatEventCardPrice(event)}
      </span>
    </div>
  );

  return (
    <>
      <div className="eventCardHImageWrap">
        <EventVisual event={event} imageClassName="eventCardHImage" draggable={decorative ? false : undefined} />
        {listing ? (
          <span className="eventCarouselCoverCategory eventCardHCoverCategory" style={{ "--card-category-color": event.categoryColor } as CSSProperties}>
            <span aria-hidden="true"><CategoryIcon iconName={event.categoryRelation?.icon ?? "CalendarDays"} size={13} /></span>
            <span>{event.category}</span>
          </span>
        ) : null}
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
          {listing ? (
            <div className="eventCardHActions">
              {price}
              <span className="eventCardHDetails" aria-hidden="true">Zobacz szczegóły <ChevronRight size={14} /></span>
            </div>
          ) : price}
        </div>
      </div>
    </>
  );
}
