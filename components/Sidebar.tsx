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
  markersLoading?: boolean;
  markersError?: string | null;
  onRetryMarkers?: () => void;
  categoryCountsLoading?: boolean;
  categoryCountsError?: string | null;
  onRetryCategoryCounts?: () => void;
};

export default function Sidebar({
  events,
  mapEvents,
  categoryCounts,
  onCategorySelect,
  selectedCategory,
  location,
  isAllPoland,
  markersLoading = false,
  markersError = null,
  onRetryMarkers,
  categoryCountsLoading = false,
  categoryCountsError = null,
  onRetryCategoryCounts
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
        {markersLoading ? <p className="sidebarMapStatus" role="status">Odświeżam punkty…</p> : markersError ? <div className="sidebarMapStatus" role="alert"><p>{markersError}</p><button type="button" className="resultsAction" onClick={onRetryMarkers}>Spróbuj ponownie</button></div> : null}
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
                      {event.city}{Number.isFinite(distanceKm) ? ` · ${distanceKm.toFixed(0)} km` : ""}
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
          {categoryCountsLoading ? <p className="hint" role="status">Liczę kategorie…</p> : categoryCountsError ? (
            <div className="sidebarMapStatus" role="alert"><p>{categoryCountsError}</p><button type="button" className="resultsAction" onClick={onRetryCategoryCounts}>Spróbuj ponownie</button></div>
          ) : categoryCounts.length === 0 ? <p className="hint">Brak kategorii dla wybranych filtrów.</p> : null}
          {categoryCounts.map(({ category, count }) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={`sidebarCategoryChip ${isActive ? "sidebarCategoryActive" : ""}`}
                onClick={() => onCategorySelect(isActive ? "Wszystkie" : category)}
                aria-pressed={isActive}
              >
                {category}{" "}
                <span className="sidebarCategoryCount">
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
