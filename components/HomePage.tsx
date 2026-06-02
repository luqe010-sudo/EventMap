"use client";

import { useEffect, useMemo, useState } from "react";
import { type CategoryOption, type EventCategory, type EventItem, type KnownLocation, getDefaultLocation } from "@/lib/events";
import { filterEvents, type DateFilter } from "@/lib/filters";
import HeroSection from "@/components/HeroSection";
import SearchPanel from "@/components/SearchPanel";

import FeaturedEvents from "@/components/FeaturedEvents";
import EventCard from "@/components/EventCard";
import Sidebar from "@/components/Sidebar";
import ValueProps from "@/components/ValueProps";

type HomePageProps = {
  initialEvents: EventItem[];
  categoryOptions: CategoryOption[];
};

export default function HomePage({ initialEvents, categoryOptions }: HomePageProps) {
  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customDate, setCustomDate] = useState("");
  const [radiusKm, setRadiusKm] = useState(100);
  const [category, setCategory] = useState<EventCategory | "Wszystkie">("Wszystkie");
  const [isFree, setIsFree] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [location, setLocation] = useState<KnownLocation>(getDefaultLocation());
  const [locationStatus, setLocationStatus] = useState("");
  const [sortBy, setSortBy] = useState<"nearest" | "date">("nearest");
  const categoryNames = useMemo(() => categoryOptions.map((item) => item.name), [categoryOptions]);



  // Filtered events
  const filteredEvents = useMemo(
    () => {
      let results = filterEvents(initialEvents, {
        dateFilter, customDate, radiusKm, category, location, isFree
      });
      if (sortBy === "nearest") {
        results = [...results].sort((a, b) => {
          const firstDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
          const secondDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
          return firstDistance - secondDistance;
        });
      }
      return results;
    },
    [initialEvents, dateFilter, customDate, radiusKm, category, location, isFree, sortBy]
  );

  // Featured events
  const featuredEvents = useMemo(
    () => filterEvents(initialEvents, {
      dateFilter: "week", customDate: "", radiusKm: 100, category: "Wszystkie", location
    }).filter(({ event }) => event.isFeatured),
    [initialEvents, location]
  );

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = new Map<EventCategory, number>();
    for (const { event } of filteredEvents) {
      counts.set(event.category, (counts.get(event.category) || 0) + 1);
    }
    return categoryNames
      .filter((cat) => counts.has(cat))
      .map((cat) => ({ category: cat, count: counts.get(cat)! }))
      .sort((a, b) => b.count - a.count);
  }, [categoryNames, filteredEvents]);

  // Handlers
  function handleLocationSelect(loc: KnownLocation) {
    setLocation(loc);
    setLocationInput(loc.label);
    setLocationStatus(`Szukam wydarzeń w pobliżu: ${loc.label}.`);
  }

  function handleUseGPS() {
    if (!navigator.geolocation) {
      setLocationStatus("Twoja przeglądarka nie udostępnia geolokalizacji.");
      return;
    }
    setLocationStatus("Pytam przeglądarkę o lokalizację…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsLocation: KnownLocation = {
          label: "Moja lokalizacja",
          aliases: ["gps"],
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setLocation(gpsLocation);
        setLocationInput(gpsLocation.label);
        setLocationStatus("Używam Twojej aktualnej lokalizacji.");
      },
      () => setLocationStatus("Nie udało się pobrać lokalizacji."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }



  return (
    <main className="homePage">
      <HeroSection
        eventCount={filteredEvents.length}
        onSelectCategory={(cat) => { setCategory(cat); setIsFree(false); }}
        onSelectFree={() => { setIsFree(true); setCategory("Wszystkie"); }}
        onSelectDateFilter={(f) => setDateFilter(f)}
      />

      <SearchPanel
        locationInput={locationInput}
        onLocationInputChange={setLocationInput}
        onLocationSelect={handleLocationSelect}
        onUseGPS={handleUseGPS}
        locationStatus={locationStatus}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        customDate={customDate}
        onCustomDateChange={setCustomDate}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        category={category}
        categories={categoryNames}
        onCategoryChange={(cat) => { setCategory(cat); setIsFree(false); }}
      />



      {/* Main 70/30 layout: events list + sidebar */}
      <div className="mainLayout">
        <div className="mainColumn">
          <FeaturedEvents
            events={featuredEvents}
          />

          <section className="mainEvents" id="events-list" aria-label="Lista wydarzeń">
          <div className="mainEventsHeader">
            <h2>Wydarzenia w Twojej okolicy</h2>
            <div className="mainEventsSort">
              <span>Sortuj:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "nearest" | "date")}
                className="mainEventsSortSelect"
              >
                <option value="nearest">Najbliższe</option>
                <option value="date">Wg daty</option>
              </select>
            </div>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="eventsList">
              {filteredEvents.map(({ event, distanceKm }) => (
                <EventCard key={event.id} event={event} distanceKm={distanceKm} />
              ))}
              {filteredEvents.length > 4 && (
                <button type="button" className="showMoreBtn">
                  Pokaż więcej wydarzeń
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              )}
            </div>
          ) : (
            <div className="emptyState">
              <div className="emptyIcon">🔍</div>
              <h3>Tu chwilowo cisza.</h3>
              <p>Zwiększ promień, zmień datę albo wybierz inną kategorię.</p>
            </div>
          )}
          </section>
        </div>

        <Sidebar
          events={filteredEvents}
          categoryCounts={categoryCounts}
          onCategorySelect={(cat) => { setCategory(cat); setIsFree(false); }}
          selectedCategory={category}
          location={location}
        />
      </div>

      <ValueProps />
    </main>
  );
}
