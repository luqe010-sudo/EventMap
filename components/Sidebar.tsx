"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { useMemo, useState } from "react";
import { type EventCategory, type EventItem, type KnownLocation } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading">Ładowanie mapy...</div>
});

type SidebarProps = {
  events: Array<{ event: EventItem; distanceKm: number }>;
  categoryCounts: Array<{ category: EventCategory; count: number; color?: string | null }>;
  onCategorySelect: (category: EventCategory | "Wszystkie") => void;
  selectedCategory: EventCategory | "Wszystkie";
  location: KnownLocation;
  isAllPoland: boolean;
};

export default function Sidebar({
  events,
  categoryCounts,
  onCategorySelect,
  selectedCategory,
  location,
  isAllPoland
}: SidebarProps) {
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const mapEvents = useMemo(() => events.map(({ event }) => event), [events]);

  return (
    <aside className="sidebar" aria-label="Panel boczny">
      <div className="sidebarSection sidebarMapSection">
        <div className="sidebarSectionHeader">
          <h3>Wydarzenia na mapie</h3>
        </div>
        <div className="sidebarMapWrap">
          {shouldLoadMap ? (
            <MapLibreMap
              events={mapEvents}
              location={isAllPoland ? undefined : location}
              onSelectEvent={() => {}}
            />
          ) : (
            <div className="sidebarMapPlaceholder">
              <MapPinned size={28} strokeWidth={2.2} aria-hidden="true" />
              <div>
                <strong>Mapa wydarzeń</strong>
                <p>Włącz mapę, aby załadować pineski, klastry i kafelki mapowe.</p>
              </div>
              <button
                type="button"
                className="sidebarMapLoadButton"
                onClick={() => setShouldLoadMap(true)}
              >
                <MapPinned size={16} strokeWidth={2.4} aria-hidden="true" />
                Pokaż mapę
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sidebarSection sidebarNotifSection">
        <div className="sidebarNotifContent">
          <h3>Powiadomienia o nowych wydarzeniach</h3>
          <p>Bądź na bieżąco! Powiadomimy Cię, gdy pojawi się coś ciekawego w Twojej okolicy.</p>
          <button type="button" className="sidebarNotifBtn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Ustaw powiadomienia
          </button>
        </div>
      </div>

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
                    {formatPolishDate(event.startDate, { day: "numeric" })}
                  </span>
                  <span className="sidebarUpcomingMonth">
                    {formatPolishDate(event.startDate, { month: "short" })}
                  </span>
                </div>
                <div className="sidebarUpcomingInfo">
                  <span className="sidebarUpcomingTitle">{event.title}</span>
                  <span className="sidebarUpcomingMeta">
                    {event.city} - {Number.isFinite(distanceKm) ? `${distanceKm.toFixed(0)} km` : "brak dystansu"}
                  </span>
                </div>
                <button type="button" className="sidebarUpcomingFav" onClick={(e) => e.stopPropagation()} aria-label="Dodaj do ulubionych">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                </button>
              </div>
            );
          })}
        </div>
        <div className="sidebarSectionFooter">
          <Link href="/" className="sidebarSeeAll">
            Zobacz kalendarz wydarzeń
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </Link>
        </div>
      </div>

      <div className="sidebarSection">
        <div className="sidebarSectionHeader">
          <h3>Popularne kategorie</h3>
        </div>
        <div className="sidebarCategories">
          {categoryCounts.map(({ category, count, color }) => {
            const isActive = selectedCategory === category;
            const chipColor = color || "var(--ink)";
            return (
              <button
                key={category}
                type="button"
                className={`sidebarCategoryChip ${isActive ? "sidebarCategoryActive" : ""}`}
                style={
                  isActive
                    ? {
                        background: chipColor,
                        borderColor: chipColor,
                        color: "white"
                      }
                    : ({
                        "--hover-border": chipColor
                      } as React.CSSProperties)
                }
                onClick={() => onCategorySelect(isActive ? "Wszystkie" : category)}
              >
                {category}{" "}
                <span
                  className="sidebarCategoryCount"
                  style={isActive ? { color: "rgba(255,255,255,0.7)" } : undefined}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
