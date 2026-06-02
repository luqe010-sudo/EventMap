"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { categories, knownLocations, type EventCategory, type EventItem, type KnownLocation } from "@/lib/events";
import { filterEvents, type DateFilter } from "@/lib/filters";
import { eventPath } from "@/lib/slugs";
import { formatPolishDate } from "@/lib/date-format";
import CityAutocomplete from "@/components/CityAutocomplete";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading">Ładowanie mapy…</div>
});

const dateOptions: Array<{ label: string; value: DateFilter }> = [
  { label: "Dziś", value: "today" },
  { label: "Jutro", value: "tomorrow" },
  { label: "Weekend", value: "weekend" },
  { label: "Ten tydzień", value: "week" },
  { label: "Data", value: "custom" }
];

type EventExplorerProps = {
  initialEvents: EventItem[];
  initialLocation?: KnownLocation;
  initialCategory?: EventCategory;
  categoryOptions?: EventCategory[];
};

export default function EventExplorer({
  initialEvents,
  initialLocation,
  initialCategory,
  categoryOptions
}: EventExplorerProps) {
  const availableCategories = categoryOptions?.length ? categoryOptions : categories;
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customDate, setCustomDate] = useState("");
  const [radiusKm, setRadiusKm] = useState(100);
  const [category, setCategory] = useState<EventCategory | "Wszystkie">(
    initialCategory ?? "Wszystkie"
  );
  const [locationInput, setLocationInput] = useState(
    initialLocation?.label ?? "Warszawa"
  );
  const [location, setLocation] = useState<KnownLocation>(
    initialLocation ?? knownLocations[0]
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState(
    initialLocation
      ? `Szukam wydarzeń w pobliżu: ${initialLocation.label}.`
      : "Wpisz miasto lub użyj lokalizacji GPS."
  );

  const filteredEvents = useMemo(
    () =>
      filterEvents(initialEvents, {
        dateFilter,
        customDate,
        radiusKm,
        category,
        location
      }),
    [initialEvents, dateFilter, customDate, radiusKm, category, location]
  );

  // Reset selection when the selected event is no longer in the filtered list
  const selectedEvent = filteredEvents.find(({ event }) => event.id === selectedEventId)?.event ?? null;
  const customDateRange = parseCustomDateRangeValue(customDate);

  function handleLocationSelect(loc: KnownLocation) {
    setLocation(loc);
    setLocationInput(loc.label);
    setLocationStatus(`Szukam wydarzeń w pobliżu: ${loc.label}.`);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Twoja przeglądarka nie udostępnia geolokalizacji.");
      return;
    }

    setLocationStatus("Pytam przeglądarkę o lokalizację…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsLocation = {
          label: "Moja lokalizacja",
          aliases: ["gps"],
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setLocation(gpsLocation);
        setLocationInput(gpsLocation.label);
        setLocationStatus("Używam Twojej aktualnej lokalizacji.");
      },
      () => {
        setLocationStatus("Nie udało się pobrać lokalizacji. Możesz wpisać miasto ręcznie.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
  }

  function handleCustomDateFromChange(value: string) {
    const nextTo = customDateRange.to && value && customDateRange.to < value
      ? value
      : customDateRange.to;
    setCustomDate(serializeCustomDateRange(value, nextTo));
  }

  function handleCustomDateToChange(value: string) {
    const nextFrom = customDateRange.from && value && customDateRange.from > value
      ? value
      : customDateRange.from;
    setCustomDate(serializeCustomDateRange(nextFrom, value));
  }

  return (
    <main className="appShell">
      <section className="hero">
        <div>
          <p className="eyebrow">EventMap Polska</p>
          <h1>Znajdź lokalne wydarzenia zanim przemkną bokiem.</h1>
          <p className="heroCopy">
            Koncerty, festyny, dożynki, sport i kultura w jednej mapie.
            Wybierz miasto, kategorię i odkryj, co się dzieje obok Ciebie.
          </p>
        </div>
        <div className="heroCard">
          <span className="heroMetric">{filteredEvents.length}</span>
          <span>wydarzeń w aktualnym widoku</span>
        </div>
      </section>

      <section className="filtersPanel" aria-label="Filtry wydarzeń">
        <div className="filterGroup wide">
          <label htmlFor="location">Lokalizacja</label>
          <div className="locationControls">
            <CityAutocomplete
              value={locationInput}
              onChange={setLocationInput}
              onSelect={handleLocationSelect}
            />
            <button type="button" className="secondaryButton gpsButton" onClick={useCurrentLocation}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
              GPS
            </button>
          </div>
          <p className="hint">{locationStatus}</p>
        </div>

        <div className="filterGroup">
          <span className="labelLike">Data</span>
          <div className="segmented">
            {dateOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={dateFilter === option.value ? "active" : ""}
                onClick={() => setDateFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {dateFilter === "custom" ? (
            <div className="dateRangeFields dateRangeFieldsCompact">
              <label className="dateRangeField">
                <span>Od</span>
                <input
                  className="dateInput"
                  type="date"
                  value={customDateRange.from}
                  max={customDateRange.to || undefined}
                  onChange={(event) => handleCustomDateFromChange(event.target.value)}
                />
              </label>
              <label className="dateRangeField">
                <span>Do</span>
                <input
                  className="dateInput"
                  type="date"
                  value={customDateRange.to}
                  min={customDateRange.from || undefined}
                  onChange={(event) => handleCustomDateToChange(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="filterGroup compact">
          <label htmlFor="radius">Odległość: <strong>{radiusKm} km</strong></label>
          <div className="rangeSliderWrap">
            <input
              id="radius"
              type="range"
              min={5}
              max={200}
              step={5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="rangeSlider"
            />
            <div className="rangeLabels">
              <span>5 km</span>
              <span>200 km</span>
            </div>
          </div>
        </div>

        <div className="filterGroup compact">
          <label htmlFor="category">Kategoria</label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as EventCategory | "Wszystkie")}
          >
            <option>Wszystkie</option>
            {availableCategories.map((eventCategory) => (
              <option key={eventCategory}>{eventCategory}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="workspace">
        <aside className="eventList" aria-label="Lista wydarzeń">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">Wyniki</p>
              <h2>Wydarzenia w okolicy</h2>
            </div>
            <span>{filteredEvents.length}</span>
          </div>

          {filteredEvents.length ? (
            <div className="cards">
              {filteredEvents.map(({ event, distanceKm }) => (
                <article
                  key={event.id}
                  className={`eventCard ${selectedEventId === event.id ? "selected" : ""}`}
                  onClick={() => selectEvent(event.id)}
                >
                  <img src={event.imageUrl} alt="" />
                  <div className="eventCardBody">
                    <div className="cardTopline">
                      <span>{event.category}</span>
                      <span>{Number.isFinite(distanceKm) ? `${Math.round(distanceKm)} km` : "brak dystansu"}</span>
                    </div>
                    <h3>
                      <Link href={eventPath(event)} className="eventCardLink">
                        {event.title}
                      </Link>
                    </h3>
                    <p>{event.description}</p>
                    <dl>
                      <div>
                        <dt>Kiedy</dt>
                        <dd>{formatDate(event.startDate)}</dd>
                      </div>
                      <div>
                        <dt>Gdzie</dt>
                        <dd>{event.address}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="emptyState">
              <div className="emptyIcon">🔍</div>
              <h3>Tu chwilowo cisza.</h3>
              <p>Zwiększ promień, zmień datę albo wybierz inną kategorię.</p>
            </div>
          )}
        </aside>

        <div className="mapPanel">
          <MapLibreMap
            events={filteredEvents.map(({ event }) => event)}
            selectedEventId={selectedEvent?.id}
            location={location}
            onSelectEvent={selectEvent}
          />

          {selectedEvent ? (
            <section className="detailsPanel" aria-label="Szczegóły wydarzenia">
              <div>
                <span className="pill">{selectedEvent.category}</span>
                <h2>{selectedEvent.title}</h2>
                <p>{selectedEvent.description}</p>
              </div>
              <div className="detailsGrid">
                <span>📅 {formatDate(selectedEvent.startDate)}</span>
                <span>📍 {selectedEvent.address}</span>
                <span>👤 {selectedEvent.organizer}</span>
                <span>💳 {selectedEvent.price}</span>
              </div>
              <div className="tagRow">
                {selectedEvent.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
              <div className="detailsActions">
                <Link href={eventPath(selectedEvent)}>
                  Zobacz szczegóły
                </Link>
                <a href={selectedEvent.organizerUrl} target="_blank" rel="noreferrer">
                  Organizator
                </a>
                {selectedEvent.ticketUrl ? (
                  <a href={selectedEvent.ticketUrl} target="_blank" rel="noreferrer">
                    Bilety
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return formatPolishDate(value, {
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function parseCustomDateRangeValue(value: string) {
  const [from = "", to = ""] = value.split("/");
  return { from, to };
}

function serializeCustomDateRange(from: string, to: string) {
  if (from && to) return `${from}/${to}`;
  if (to) return `/${to}`;
  return from;
}
