"use client";

import dynamic from "next/dynamic";
import { CalendarDays, List, Map, MapPin, X } from "lucide-react";
import type { EventItem, EventMapMarker, KnownLocation } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading mobileMapLoading">Ładowanie mapy…</div>
});

type MobileMapViewProps = {
  active: boolean;
  parked?: boolean;
  events: EventMapMarker[];
  selectedEvent: EventItem | null;
  selectedEventLoading?: boolean;
  selectedEventId: string | null;
  location?: KnownLocation;
  onSelectEvent: (eventId: string) => void;
  onClearSelection: () => void;
  onShowList: () => void;
  onOpenEvent: (eventId: string) => void;
};

export default function MobileMapView({
  active,
  parked = false,
  events,
  selectedEvent,
  selectedEventLoading = false,
  selectedEventId,
  location,
  onSelectEvent,
  onClearSelection,
  onShowList,
  onOpenEvent
}: MobileMapViewProps) {
  const selectedEventDescription = selectedEvent
    ? selectedEvent.short_description ?? selectedEvent.description
    : null;

  return (
    <section
      id="mobile-map-view"
      className={`mobileMapView ${active ? "mobileMapViewActive" : ""} ${parked ? "mobileMapViewParked" : ""}`}
      aria-label="Mapa wydarzeń"
      aria-hidden={!active}
    >
      <MapLibreMap
        events={events}
        selectedEventId={selectedEventId ?? undefined}
        focusedEventId={selectedEventId ?? undefined}
        location={location}
        onSelectEvent={onSelectEvent}
        showEventPopup={false}
        isVisible={active || parked}
      />

      <div className="mobileMapCount" aria-live="polite">
        <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />
        {formatEventCount(events.length)}
      </div>

      {events.length === 0 ? (
        <div className="mobileMapEmpty">
          <Map size={28} aria-hidden="true" />
          <strong>Brak wydarzeń na mapie</strong>
          <p>Wróć do listy i zmień filtry.</p>
          <button type="button" onClick={onShowList}>
            <List size={17} aria-hidden="true" />
            Wróć do listy
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
        <article className="mobileMapPreview" aria-label={`Wybrane wydarzenie: ${selectedEvent.title}`}>
          <button
            type="button"
            className="mobileMapPreviewClose"
            onClick={onClearSelection}
            aria-label="Zamknij podgląd wydarzenia"
          >
            <X size={17} aria-hidden="true" />
          </button>
          <img src={selectedEvent.imageUrl} alt="" loading="lazy" />
          <div className="mobileMapPreviewBody">
            <span className="mobileMapPreviewCategory" style={{ color: selectedEvent.categoryColor }}>
              {selectedEvent.category}
            </span>
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
            <button type="button" onClick={() => onOpenEvent(selectedEvent.id)}>
              Zobacz wydarzenie
            </button>
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
