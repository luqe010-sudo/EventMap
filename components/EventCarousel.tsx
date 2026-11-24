"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, HeartHandshake, MapPin, Star } from "lucide-react";
import type { EventItem } from "@/lib/events";
import { isFreeEvent } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import { formatEventCardDate, formatEventCardDistance, formatEventCardLocation, formatEventCardPrice } from "@/lib/event-presentation";
import EventCardSaveButton from "./EventCardSaveButton";
import EventVisual from "./EventVisual";
import PromotedBadge from "./PromotedBadge";
import CategoryIcon from "./CategoryIcon";

export type CarouselEvent = { event: EventItem; distanceKm: number };

type Props = {
  events: CarouselEvent[];
  title: string;
  description?: string;
  featured?: boolean;
  onOpenEvent?: (eventId: string) => void;
  seeAllHref?: string;
  onSeeAll?: () => void;
  footer?: React.ReactNode;
};

export default function EventCarousel({ events, title, description, featured = false, onOpenEvent, seeAllHref, onSeeAll, footer }: Props) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => {
      setEdges({ left: element.scrollLeft > 2, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
      const first = element.firstElementChild as HTMLElement | null;
      if (first) setActiveIndex(Math.round(element.scrollLeft / (first.offsetWidth + 12)));
    };
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
  const HeadingIcon = featured ? Star : CalendarDays;
  const linkLabel = <><span>Zobacz listę</span><ArrowRight size={15} aria-hidden="true" /></>;

  return (
    <section className={featured ? "eventCarousel eventCarousel--discover eventCarousel--featured" : "eventCarousel eventCarousel--discover eventCarousel--compact"} aria-labelledby={`${id}-title`}>
      <div className="eventCarouselHeader">
        <div>
          <h2 id={`${id}-title`}><HeadingIcon className="eventCarouselHeadingIcon" size={24} strokeWidth={2.2} aria-hidden="true" /><span>{title}</span></h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="eventCarouselActions">
          {onSeeAll ? <button type="button" className="eventCarouselSeeAll" onClick={onSeeAll}>{linkLabel}</button> : seeAllHref ? <Link href={seeAllHref}>{linkLabel}</Link> : null}
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
        {events.map(({ event, distanceKm }, index) => (
          <article className="eventCarouselCard" key={event.id} data-category={event.categorySlug} style={{ "--rail-category": event.categoryColor || "var(--brand)" } as CSSProperties}>
            <Link className="eventCarouselCardLink" href={eventPath(event)} onClick={(e) => {
              if (!onOpenEvent || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !window.matchMedia("(max-width: 760px)").matches) return;
              e.preventDefault(); onOpenEvent(event.id);
            }}>
              <div className="eventCarouselImageWrap">
                <EventVisual event={event} loading={featured && index === 0 ? "eager" : "lazy"} />
                <span className="eventCarouselCoverCategory">
                  <span aria-hidden="true">{event.categorySlug === "charytatywne" ? <HeartHandshake size={15} /> : <CategoryIcon iconName={event.categoryRelation?.icon ?? "CalendarDays"} size={15} />}</span>
                  <span>{event.category}</span>
                </span>
              </div>
              <div className="eventCarouselBody">
                <h3>{event.title}</h3>
                <time className="eventCarouselDate" dateTime={event.startDate}>
                  <CalendarDays size={14} aria-hidden="true" />
                  {formatEventCardDate(event)}
                </time>
                <p className="eventCarouselLocation"><MapPin size={14} aria-hidden="true" /><span>{formatEventCardLocation(event)}</span></p>
                <div className="eventCarouselCardFooter">
                  <span className={`eventCarouselTicketPrice${isFreeEvent(event) ? " eventCarouselPriceFree" : ""}`}>{formatEventCardPrice(event)}</span>
                  {event.isFeatured ? <PromotedBadge /> : null}
                  {Number.isFinite(distanceKm) ? <span className="eventCarouselDistance">{formatEventCardDistance(distanceKm)}</span> : null}
                </div>
              </div>
            </Link>
            <EventCardSaveButton eventId={event.id} returnTo={eventPath(event)} className="eventCarouselSave" />
          </article>
        ))}
      </div>
      {featured && canScroll ? (
        <div className="eventCarouselDots" aria-label="Pozycja w karuzeli">
          {events.map(({ event }, index) => (
            <button key={event.id} type="button" aria-label={"Przewiń do wydarzenia " + (index + 1)}
              aria-current={activeIndex === index ? "true" : undefined} onClick={() => {
                const element = track.current;
                const first = element?.firstElementChild as HTMLElement | null;
                if (element && first) element.scrollTo({ left: index * (first.offsetWidth + 12), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
              }} />
          ))}
        </div>
      ) : null}
      {footer}
    </section>
  );
}
