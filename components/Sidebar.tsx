
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, MapPinned, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EventItem, EventMapMarker, KnownLocation } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { eventPath } from "@/lib/slugs";
import EventCardSaveButton from "@/components/EventCardSaveButton";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading" role="status">Ładowanie mapy…</div>
});

type SidebarProps = {
  mapEvents: EventMapMarker[];
  onRequestMap: () => void;
  selectedEventId?: string;
  focusedEventId?: string;
  selectedEvent: EventItem | null;
  selectedEventLoading: boolean;
  onSelectEvent: (eventId: string) => void;
  onClearSelection: () => void;
  location: KnownLocation;
  isAllPoland: boolean;
  markersLoading: boolean;
  markersError: string | null;
  onRetryMarkers: () => void;
  upcomingEvents: EventItem[];
  onShowResults: () => void;
  onOpenEvent: (eventId: string) => void;
};

export default function Sidebar({
  mapEvents,
  onRequestMap,
  selectedEventId,
  focusedEventId,
  selectedEvent,
  selectedEventLoading,
  onSelectEvent,
  onClearSelection,
  location,
  isAllPoland,
  markersLoading,
  markersError,
  onRetryMarkers,
  upcomingEvents,
  onShowResults,
  onOpenEvent
}: SidebarProps) {
  const [isMapLoaded, setMapLoaded] = useState(false);
  const [isExpanded, setExpanded] = useState(false);
  const [isNativeExpanded, setNativeExpanded] = useState(false);
  const mapCloseRef = useRef<HTMLButtonElement | null>(null);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapOpenRef = useRef<HTMLButtonElement | null>(null);

  const loadMapNow = useCallback(() => {
    onRequestMap();
    setMapLoaded(true);
  }, [onRequestMap]);

  useEffect(() => {
    if (selectedEventId && window.matchMedia("(min-width: 761px)").matches) loadMapNow();
  }, [selectedEventId, loadMapNow]);

  useEffect(() => {
    const mapElement = mapWrapRef.current;
    if (!mapElement) return;
    if (typeof window.IntersectionObserver !== "function") {
      const desktop = window.matchMedia("(min-width: 761px)");
      if (desktop.matches) loadMapNow();
      function onDesktopChange() { if (desktop.matches) loadMapNow(); }
      desktop.addEventListener("change", onDesktopChange);
      return () => desktop.removeEventListener("change", onDesktopChange);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMapNow();
        observer.disconnect();
      }
    }, { rootMargin: "200px 0px" });
    observer.observe(mapElement);
    return () => observer.disconnect();
  }, [loadMapNow]);

  const closeExpandedMap = useCallback(() => {
    if (document.fullscreenElement === mapWrapRef.current) void document.exitFullscreen();
    setExpanded(false);
    mapOpenRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function syncFullscreen() {
      setNativeExpanded(document.fullscreenElement === mapWrapRef.current);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (isExpanded || isNativeExpanded) mapCloseRef.current?.focus({ preventScroll: true });
  }, [isExpanded, isNativeExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExpandedMap();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeExpandedMap, isExpanded]);

  function openMap() {
    loadMapNow();
    const target = mapWrapRef.current;
    if (!target?.requestFullscreen) {
      setExpanded(true);
      return;
    }
    void target.requestFullscreen().catch(() => setExpanded(true));
  }

  const previewEvent = selectedEventId && selectedEventId === selectedEvent?.id ? selectedEvent : null;

  return (
    <aside className="sidebar" aria-label="Mapa i nadchodzące wydarzenia">
      <section className="sidebarSection sidebarMapSection" aria-labelledby="sidebar-map-title">
        <div className="sidebarSectionHeader">
          <h3 id="sidebar-map-title">Wydarzenia na mapie</h3>
          <button ref={mapOpenRef} type="button" onClick={openMap}>Otwórz mapę <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div id="desktop-map" className={isExpanded ? "sidebarMapWrap sidebarMapExpanded" : "sidebarMapWrap"} ref={mapWrapRef}>
          {isExpanded || isNativeExpanded ? <button ref={mapCloseRef} type="button" className="resultsAction sidebarMapExpandedClose" onClick={closeExpandedMap}>Zamknij mapę <X size={16} aria-hidden="true" /></button> : null}
          {isMapLoaded ? (
            <MapLibreMap
              events={mapEvents}
              selectedEventId={selectedEventId}
              focusedEventId={focusedEventId}
              location={isAllPoland ? undefined : location}
              onSelectEvent={onSelectEvent}
              showEventPopup={false}
              discoveryTheme
              markerVariant="dot"
            />
          ) : (
            <div className="sidebarMapPlaceholder">
              <MapPinned size={28} strokeWidth={2.2} aria-hidden="true" />
              <button type="button" className="sidebarMapLoadButton" onClick={loadMapNow}>Wczytaj mapę</button>
            </div>
          )}
          {selectedEventLoading || previewEvent ? (
            <div className="sidebarMapDesktopPreview">
              {previewEvent ? <Link href={eventPath(previewEvent)}>{previewEvent.title} <ArrowRight size={14} aria-hidden="true" /></Link> : <span role="status">Ładowanie wydarzenia…</span>}
              <button type="button" className="resultsAction" onClick={onClearSelection} aria-label="Zamknij podgląd"><X size={18} aria-hidden="true" /></button>
            </div>
          ) : null}
        </div>
        {markersLoading ? <p className="sidebarMapStatus" role="status">Odświeżam wydarzenia…</p> : markersError ? <div className="sidebarMapStatus" role="alert"><p>{markersError}</p><button type="button" className="resultsAction" onClick={onRetryMarkers}>Spróbuj ponownie</button></div> : null}
      </section>
      {upcomingEvents.length > 0 ? (
        <section className="sidebarSection sidebarUpcomingSection" aria-labelledby="sidebar-upcoming-title">
          <div className="sidebarSectionHeader">
            <h3 id="sidebar-upcoming-title"><CalendarDays size={20} aria-hidden="true" /> Nadchodzące wydarzenia</h3>
            <button type="button" onClick={onShowResults}>Zobacz listę <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="sidebarUpcoming">
            {upcomingEvents.map((event) => {
              const href = eventPath(event);
              const location = [event.city, event.location?.name].filter(Boolean).join(" · ");
              return (
                <div key={event.id} className="sidebarUpcomingItem">
                  <Link href={href} className="sidebarUpcomingLink" onClick={(click) => {
                    if (!window.matchMedia("(max-width: 760px)").matches || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
                    click.preventDefault();
                    onOpenEvent(event.id);
                  }}>
                    <time dateTime={event.startDate} className="sidebarUpcomingDate">
                      <span className="sidebarUpcomingDay">{formatPolishDate(event.startDate, { day: "numeric" })}</span>
                      <span className="sidebarUpcomingMonth">{formatPolishDate(event.startDate, { month: "short" }).replace(/\.$/, "")}</span>
                    </time>
                    <div className="sidebarUpcomingInfo">
                      <span className="sidebarUpcomingTitle">{event.title}</span>
                      {location ? <span className="sidebarUpcomingMeta"><MapPin size={13} aria-hidden="true" /><span>{location}</span></span> : null}
                    </div>
                  </Link>
                  <EventCardSaveButton eventId={event.id} returnTo={href} className="sidebarUpcomingFav" iconSize={17} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
