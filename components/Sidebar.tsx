"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type EventCategory, type EventItem, type KnownLocation } from "@/lib/events";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="mapLoading">Ładowanie mapy...</div>
});

type SidebarProps = {
  events: Array<{ event: EventItem; distanceKm: number }>;
  categoryCounts: Array<{ category: EventCategory; count: number }>;
  onCategorySelect: (category: EventCategory | "Wszystkie") => void;
  selectedCategory: EventCategory | "Wszystkie";
  location: KnownLocation;
};

export default function Sidebar({
  events,
  categoryCounts,
  onCategorySelect,
  selectedCategory,
  location
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Panel boczny">
      <div className="sidebarSection sidebarMapSection">
        <div className="sidebarSectionHeader">
          <h3>Wydarzenia na mapie</h3>
        </div>
        <div className="sidebarMapWrap">
          <LeafletMap
            events={events.map(({ event }) => event)}
            location={location}
            onSelectEvent={() => {}}
          />
        </div>
        <div className="sidebarSectionFooter">
          <Link href="#events-list" className="sidebarSeeAll">
            Pokaż listę
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </Link>
        </div>
      </div>

      {/* Notification CTA — first, prominent */}
      <div className="sidebarSection sidebarNotifSection">
        <div className="sidebarNotifContent">
          <h3>Powiadomienia o nowych wydarzeniach</h3>
          <p>Bądź na bieżąco! Powiadomimy Cię, gdy pojawi się coś ciekawego w Twojej okolicy.</p>
          <button type="button" className="sidebarNotifBtn">
            🔔 Ustaw powiadomienia
          </button>
        </div>
      </div>

      {/* Upcoming events mini-list */}
      <div className="sidebarSection">
        <div className="sidebarSectionHeader">
          <h3>Nadchodzące wydarzenia</h3>
        </div>
        <div className="sidebarUpcoming">
          {events.slice(0, 4).map((item) => {
            if (!item || !item.event) return null;
            const { event, distanceKm } = item;
            return (
              <div key={event.id} className="sidebarUpcomingItem">
                <div className="sidebarUpcomingDate">
                  <span className="sidebarUpcomingDay">
                    {new Intl.DateTimeFormat("pl-PL", { day: "numeric" }).format(new Date(event.startDate))}
                  </span>
                  <span className="sidebarUpcomingMonth">
                    {new Intl.DateTimeFormat("pl-PL", { month: "short" }).format(new Date(event.startDate))}
                  </span>
                </div>
                <div className="sidebarUpcomingInfo">
                  <span className="sidebarUpcomingTitle">{event.title}</span>
                  <span className="sidebarUpcomingMeta">
                    {event.city} • {Number.isFinite(distanceKm) ? `${distanceKm.toFixed(0)} km` : "brak dystansu"}
                  </span>
                </div>
                <button type="button" className="sidebarUpcomingFav" onClick={(e) => e.stopPropagation()} aria-label="Ulubione">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                </button>
              </div>
            );
          })}
        </div>
        <div className="sidebarSectionFooter">
          <Link href="/" className="sidebarSeeAll">
            Zobacz kalendarz wydarzeń
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </Link>
        </div>
      </div>

      {/* Popular categories with counts */}
      <div className="sidebarSection">
        <div className="sidebarSectionHeader">
          <h3>Popularne kategorie</h3>
        </div>
        <div className="sidebarCategories">
          {categoryCounts.map(({ category, count }) => (
            <button
              key={category}
              type="button"
              className={`sidebarCategoryChip ${selectedCategory === category ? "sidebarCategoryActive" : ""}`}
              onClick={() => onCategorySelect(selectedCategory === category ? "Wszystkie" : category)}
            >
              {category} <span className="sidebarCategoryCount">({count})</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
