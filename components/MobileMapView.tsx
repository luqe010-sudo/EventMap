"use client";

import { useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, CalendarDays, LocateFixed, List, Map, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import type { EventItem, EventMapMarker, KnownLocation } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import EventVisual from "./EventVisual";
import EventCardSaveButton from "./EventCardSaveButton";
import PromotedBadge from "./PromotedBadge";
import CategoryIcon from "./CategoryIcon";
import { eventPath } from "@/lib/slugs";
import { formatEventCardPrice } from "@/lib/event-presentation";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading mobileMapLoading">Ładowanie mapy…</div>
});

type MobileMapViewProps = {
  active: boolean;
  parked?: boolean;
  events: EventMapMarker[];
  markersLoading?: boolean;
  markersError?: string | null;
  onRetryMarkers?: () => void;
  selectedEvent: EventItem | null;
  selectedEventLoading?: boolean;
  selectedEventId: string | null;
  focusedEventId?: string;
  location?: KnownLocation;
  onSelectEvent: (eventId: string) => void;
  onClearSelection: () => void;
  onShowList: () => void;
  onOpenEvent: (eventId: string) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  onShowFilters?: () => void;
  onUseGPS?: () => void;
  locationStatus?: string;
};

export default function MobileMapView({
  active,
  parked = false,
  events,
  markersLoading = false,
  markersError = null,
  onRetryMarkers,
  selectedEvent,
  selectedEventLoading = false,
  selectedEventId,
  focusedEventId,
  location,
  onSelectEvent,
  onClearSelection,
  onShowList,
  onOpenEvent,
  query = "",
  onQueryChange,
  onShowFilters,
  onUseGPS,
  locationStatus
}: MobileMapViewProps) {
  const [gpsRequested, setGPSRequested] = useState(false);
  const selectedEventDescription = selectedEvent
    ? selectedEvent.short_description ?? selectedEvent.description
    : null;

  return (
    <section
      id="mobile-map-view"
      className={`mobileMapView ${active ? "mobileMapViewActive" : ""} ${parked ? "mobileMapViewParked" : ""}`}
      aria-label="Mapa wydarzeń"
      aria-hidden={!active}
      inert={!active}
      tabIndex={-1}
    >
      <header className="mobileMapToolbar">
        <div className="mobileMapTitleRow">
          <button type="button" className="mobileMapBack" onClick={onShowList} aria-label="Wróć do odkrywania"><ArrowLeft size={22} aria-hidden="true" /></button>
          <h1>Mapa wydarzeń</h1>
        </div>
        <div className="mobileMapSearchBox">
          <Search size={21} aria-hidden="true" />
          <input type="search" aria-label="Szukaj na mapie" placeholder="Szukaj na mapie" value={query} onChange={(event) => onQueryChange?.(event.target.value)} />
          {onShowFilters ? <button type="button" onClick={onShowFilters} aria-label="Filtry mapy"><SlidersHorizontal size={22} aria-hidden="true" /></button> : null}
        </div>
      </header>
      <MapLibreMap
        events={events}
        selectedEventId={selectedEventId ?? undefined}
        focusedEventId={focusedEventId}
        location={location}
        onSelectEvent={onSelectEvent}
        showEventPopup={false}
        isVisible={active || parked}
        discoveryTheme
        controlsOnRight
        bottomInset={selectedEvent || selectedEventLoading ? 231 : 74}
      />
      {onUseGPS ? (
        <button type="button" className="mobileMapLocate" aria-label="Użyj mojej lokalizacji" onClick={() => {
          setGPSRequested(true);
          onUseGPS();
        }}><LocateFixed size={23} aria-hidden="true" /></button>
      ) : null}
      {gpsRequested && locationStatus ? <span className="srOnly" role="status">{locationStatus}</span> : null}

      <div className="mobileMapCount" aria-live="polite">
        <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />
        {markersLoading ? "Odświeżam punkty…" : markersError ? "Punkty niedostępne" : formatEventCount(events.length)}
      </div>

      {!markersLoading && events.length === 0 ? (
        <div className="mobileMapEmpty">
          <Map size={28} aria-hidden="true" />
          <strong>{markersError ? "Nie udało się wczytać punktów" : "Brak wydarzeń na mapie"}</strong>
          <p>{markersError ? "Sprawdź połączenie i spróbuj ponownie." : "Wróć do listy i zmień filtry."}</p>
          <button type="button" onClick={markersError ? onRetryMarkers : onShowList}>
            <List size={17} aria-hidden="true" />
            {markersError ? "Spróbuj ponownie" : "Wróć do listy"}
          </button>
        </div>
      ) : null}

      {selectedEventLoading && selectedEventId ? (
        <article className="mobileMapPreview mobileMapPreviewLoading" aria-label="Ładowanie wydarzenia">
          <div className="mobileMapPreviewBody">
            <span className="mobileMapPreviewCategory">Ładowanie</span>
            <h2>Pobieram wydarzenie...</h2>
          </div>
        </article>
      ) : selectedEvent ? (
        <article className="mobileMapPreview" aria-label={`Wybrane wydarzenie: ${selectedEvent.title}`} style={{ "--rail-category": selectedEvent.categoryColor || "var(--brand)" } as CSSProperties}>
          <button
            type="button"
            className="mobileMapPreviewClose"
            onClick={onClearSelection}
            aria-label="Zamknij podgląd wydarzenia"
          >
            <X size={17} aria-hidden="true" />
          </button>
          <EventCardSaveButton eventId={selectedEvent.id} returnTo={eventPath(selectedEvent)} className="mobileMapPreviewSave" />
          <EventVisual event={selectedEvent} variant="compact" />
          <div className="mobileMapPreviewBody">
            <div className="mobileMapPreviewBadges">
              <span className="mobileMapPreviewCategory"><CategoryIcon iconName={selectedEvent.categoryRelation?.icon ?? "CalendarDays"} size={14} />{selectedEvent.category}</span>
              {selectedEvent.isFeatured ? <PromotedBadge /> : null}
            </div>
            <h2>{selectedEvent.title}</h2>
            {selectedEventDescription ? (
              <p className="mobileMapPreviewDescription">{selectedEventDescription}</p>
            ) : null}
            <div className="mobileMapPreviewMeta">
              <span>
                <CalendarDays size={14} aria-hidden="true" />
                {formatPreviewDate(selectedEvent.startDate)}
              </span>
              <span>
                <MapPin size={14} aria-hidden="true" />
                {selectedEvent.city || selectedEvent.address}
              </span>
            </div>
            <div className="mobileMapPreviewFooter">
              <strong>{formatEventCardPrice(selectedEvent)}</strong>
              <button type="button" onClick={() => onOpenEvent(selectedEvent.id)}>Zobacz szczegóły</button>
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function formatPreviewDate(value: string) {
  return formatPolishDate(value, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatEventCount(count: number) {
  if (count === 1) return "1 wydarzenie";
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} wydarzenia`;
  }
  return `${count} wydarzeń`;
}
