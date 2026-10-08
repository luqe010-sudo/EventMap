"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { EventItem } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import { formatEventCardDate, formatEventCardDistance, formatEventCardLocation, formatEventCardPrice } from "@/lib/event-presentation";
import EventCardSaveButton from "./EventCardSaveButton";

export type CarouselEvent = { event: EventItem; distanceKm: number };

type Props = {
  events: CarouselEvent[];
  title: string;
  description?: string;
  onOpenEvent?: (eventId: string) => void;
  seeAllHref?: string;
};

export default function EventCarousel({ events, title, description, onOpenEvent, seeAllHref }: Props) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => setEdges({ left: element.scrollLeft > 2, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
    element.scrollLeft = 0;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [events]);

  function scroll(direction: number) {
    const element = track.current;
    if (!element) return;
    const first = element.firstElementChild as HTMLElement | null;
    const step = (first?.offsetWidth ?? element.clientWidth) + 12;
    element.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  if (!events.length) return null;
  const canScroll = edges.left || edges.right;

  return (
    <section className="eventCarousel" aria-labelledby={`${id}-title`}>
      <div className="eventCarouselHeader">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="eventCarouselActions">
          {seeAllHref ? <Link href={seeAllHref}>Zobacz listę</Link> : null}
          {canScroll ? <div className="eventCarouselNav">
            <button type="button" aria-label={`Poprzednie: ${title}`} aria-controls={id} disabled={!edges.left} onClick={() => scroll(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <button type="button" aria-label={`Następne: ${title}`} aria-controls={id} disabled={!edges.right} onClick={() => scroll(1)}><ChevronRight size={18} aria-hidden="true" /></button>
          </div> : null}
        </div>
      </div>
      <div id={id} className="eventCarouselTrack" ref={track} role="region" aria-label={title} tabIndex={canScroll ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); scroll(e.key === "ArrowLeft" ? -1 : 1); }
        }}>
        {events.map(({ event, distanceKm }) => (
          <article className="eventCarouselCard" key={event.id}>
            <Link className="eventCarouselCardLink" href={eventPath(event)} onClick={(e) => {
              if (!onOpenEvent || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !window.matchMedia("(max-width: 760px)").matches) return;
              e.preventDefault(); onOpenEvent(event.id);
            }}>
              <div className="eventCarouselImageWrap"><img src={event.imageUrl} alt="" loading="lazy" /></div>
              <div className="eventCarouselBody">
                <span className="eventCarouselCategory" style={{ color: event.categoryColor }}>{event.category}</span>
                <h3>{event.title}</h3>
                <time className="eventCarouselDate" dateTime={event.startDate}>
                  <CalendarDays size={14} aria-hidden="true" />
                  {formatEventCardDate(event)}
                </time>
                <p className="eventCarouselLocation"><MapPin size={14} aria-hidden="true" /><span>{formatEventCardLocation(event)}</span></p>
                <div className="eventCarouselPrice"><span>{formatEventCardPrice(event)}</span>{Number.isFinite(distanceKm) ? <span>{formatEventCardDistance(distanceKm)}</span> : null}</div>
              </div>
            </Link>
            <EventCardSaveButton eventId={event.id} returnTo={eventPath(event)} className="eventCarouselSave" />
          </article>
        ))}
      </div>
      {canScroll ? <p className="eventCarouselHint">Przesuń karty lub użyj strzałek, aby zobaczyć więcej.</p> : null}
    </section>
  );
}
