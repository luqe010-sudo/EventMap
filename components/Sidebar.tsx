"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type EventCategory, type EventItem, type EventMapMarker, type KnownLocation } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { eventPath } from "@/lib/slugs";
import EventCardSaveButton from "@/components/EventCardSaveButton";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading">Ładowanie mapy...</div>
});

type MapLoadState = "waiting" | "queued" | "loaded";

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

type SidebarProps = {
  events: Array<{ event: EventItem; distanceKm: number }>;
  mapEvents: EventMapMarker[];
  categoryCounts: Array<{ category: EventCategory; count: number; color?: string | null }>;
  onCategorySelect: (category: EventCategory | "Wszystkie") => void;
  selectedCategory: EventCategory | "Wszystkie";
  location: KnownLocation;
  isAllPoland: boolean;
};

export default function Sidebar({
  events,
  mapEvents,
  categoryCounts,
  onCategorySelect,
  selectedCategory,
  location,
  isAllPoland
}: SidebarProps) {
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>("waiting");
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const loadScheduledRef = useRef(false);
  const isMapLoaded = mapLoadState === "loaded";

  const loadMapNow = useCallback(() => {
    loadScheduledRef.current = true;
    setMapLoadState("loaded");
  }, []);

  useEffect(() => {
    const mapElement = mapWrapRef.current;
    let delayTimer: number | undefined;
    let idleCallbackId: number | undefined;
    let observer: IntersectionObserver | undefined;

    function scheduleMapLoad() {
      if (loadScheduledRef.current) return;

      loadScheduledRef.current = true;
      setMapLoadState("queued");

      const connection = "connection" in navigator
        ? (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        : undefined;
      const delayMs = connection?.saveData ? 4200 : 1400;

      delayTimer = window.setTimeout(() => {
        const idleWindow = window as WindowWithIdleCallback;

        if (typeof idleWindow.requestIdleCallback === "function") {
          idleCallbackId = idleWindow.requestIdleCallback(
            () => setMapLoadState("loaded"),
            { timeout: 3200 }
          );
          return;
        }

        setMapLoadState("loaded");
      }, delayMs);
    }

    if (mapElement && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            scheduleMapLoad();
            observer?.disconnect();
          }
        },
        { rootMargin: "650px 0px" }
      );
      observer.observe(mapElement);
    } else {
      delayTimer = window.setTimeout(scheduleMapLoad, 2600);
    }

    return () => {
      observer?.disconnect();
      if (delayTimer !== undefined) window.clearTimeout(delayTimer);
      if (idleCallbackId !== undefined) {
        const idleWindow = window as WindowWithIdleCallback;
        idleWindow.cancelIdleCallback?.(idleCallbackId);
      }
    };
  }, []);

  return (
    <aside className="sidebar" aria-label="Panel boczny">
      <div className="sidebarSection sidebarMapSection">
        <div className="sidebarSectionHeader">
          <h3>Wydarzenia na mapie</h3>
        </div>
        <div className="sidebarMapWrap" ref={mapWrapRef}>
          {isMapLoaded ? (
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
                <p>
                  {mapLoadState === "queued"
                    ? "Mapa załaduje się za chwilę, gdy strona skończy najważniejsze zadania."
                    : "Mapa załaduje się automatycznie, gdy zbliżysz się do tej sekcji."}
                </p>
              </div>
              <button
                type="button"
                className="sidebarMapLoadButton"
                onClick={loadMapNow}
              >
                <MapPinned size={16} strokeWidth={2.4} aria-hidden="true" />
                {mapLoadState === "queued" ? "Pokaż teraz" : "Pokaż mapę"}
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
                <Link
                  href={eventPath(event)}
                  className="sidebarUpcomingLink"
                  aria-label={`Zobacz wydarzenie: ${event.title}`}
                >
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
                </Link>
                <EventCardSaveButton
                  eventId={event.id}
                  returnTo={eventPath(event)}
                  className="sidebarUpcomingFav"
                  iconSize={16}
                />
              </div>
            );
          })}
        </div>
        <div className="sidebarSectionFooter">
          <Link href="#events-list" className="sidebarSeeAll">
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
