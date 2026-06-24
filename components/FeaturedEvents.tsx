"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { EventItem } from "@/lib/events";
import { isFreeEvent } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import { addDaysToDateKey, formatPolishDate, getDateKeyInAppTimeZone } from "@/lib/date-format";

type FeaturedEventsProps = {
  events: Array<{ event: EventItem; distanceKm: number }>;
  onOpenEvent?: (eventId: string) => void;
};

export default function FeaturedEvents({ events, onOpenEvent }: FeaturedEventsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth"
    });
  }

  function handleCardClick(e: React.MouseEvent, eventId: string) {
    if (!onOpenEvent) return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    e.preventDefault();
    onOpenEvent(eventId);
  }

  if (events.length === 0) return null;

  return (
    <section className="featuredSection">
      <div className="featuredLayout featuredLayoutSingle">
        <div className="featuredLeft">
          <div className="featuredHeader">
            <div className="featuredHeaderLeft">
              <h2 className="featuredTitle">Polecane wydarzenia</h2>
            </div>
            <div className="featuredHeaderRight">
              <Link href="#events-list" className="featuredSeeAll">Zobacz liste</Link>
              <div className="featuredNav">
                <button type="button" className="featuredNavBtn" onClick={() => scroll("left")} disabled={!canScrollLeft} aria-label="Przewin w lewo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button type="button" className="featuredNavBtn" onClick={() => scroll("right")} disabled={!canScrollRight} aria-label="Przewin w prawo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </div>
          </div>
          <div className="featuredScroll" ref={scrollRef} onScroll={handleScroll}>
            {events.map(({ event, distanceKm }) => {
              const isFree = isFreeEvent(event);
              return (
                <Link
                  key={event.id}
                  href={eventPath(event)}
                  className="featuredCard"
                  onClick={(e) => handleCardClick(e, event.id)}
                >
                  <div className="featuredCardImageWrap">
                    <img src={event.imageUrl} alt={event.title} className="featuredCardImage" loading="lazy" />
                    <div className="featuredCardOverlay">
                      <span className="featuredCardDay">{formatFeaturedDate(event.startDate)}</span>
                    </div>
                    <span className="featuredCardCategory" style={{ backgroundColor: event.categoryColor }}>
                      {event.category.toUpperCase()}
                    </span>
                    <button type="button" className="featuredCardFav" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label="Ulubione">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                    </button>
                  </div>
                  <div className="featuredCardBody">
                    <h3 className="featuredCardTitle">{event.title}</h3>
                    <div className="featuredCardInfo">
                      <span>{event.city}</span>
                      <span>-</span>
                      <span>{Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km` : ""}</span>
                      <span>-</span>
                      <span className={isFree ? "featuredCardFree" : ""}>
                        {isFree ? "Bezplatne" : event.price}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatFeaturedDate(value: string) {
  const todayKey = getDateKeyInAppTimeZone(new Date());
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const eventKey = getDateKeyInAppTimeZone(value);
  const timeStr = formatPolishDate(value, { hour: "2-digit", minute: "2-digit" });

  if (eventKey === todayKey) return `DZIS - ${timeStr}`;
  if (eventKey === tomorrowKey) return `JUTRO - ${timeStr}`;

  const dayStr = formatPolishDate(value, { weekday: "short" }).toUpperCase();
  return `${dayStr} - ${timeStr}`;
}
