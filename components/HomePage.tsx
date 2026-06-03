"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type CategoryOption, type EventCategory, type EventItem, type KnownLocation, getDefaultLocation } from "@/lib/events";
import { filterEvents, type DateFilter } from "@/lib/filters";
import HeroSection from "@/components/HeroSection";
import SearchPanel from "@/components/SearchPanel";

import FeaturedEvents from "@/components/FeaturedEvents";
import EventCard from "@/components/EventCard";
import Sidebar from "@/components/Sidebar";
import ValueProps from "@/components/ValueProps";
import { toSlug, toPluralCategoryName, toPluralCategorySlug, formatInCity } from "@/lib/slugs";
import { generateSeoText } from "@/lib/seo-texts";

type HomePageProps = {
  initialEvents: EventItem[];
  categoryOptions: CategoryOption[];
  initialLocation?: KnownLocation;
  initialCategory?: EventCategory;
  initialDateFilter?: DateFilter;
};

const POPULAR_CITIES = [
  { label: "Wrocław", slug: "wroclaw" },
  { label: "Warszawa", slug: "warszawa" },
  { label: "Kraków", slug: "krakow" },
  { label: "Poznań", slug: "poznan" },
  { label: "Gdańsk", slug: "gdansk" },
  { label: "Łódź", slug: "lodz" },
];

function CategoryIcon({ name }: { name: string }) {
  const norm = name.toLowerCase().trim();
  if (norm.includes("koncert")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  if (norm.includes("festiwal")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M12 2v20M17 12H7" />
      </svg>
    );
  }
  if (norm.includes("kabaret")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (norm.includes("targ")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  }
  if (norm.includes("warsztat")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }
  if (norm.includes("sport")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
        <path d="M12 2a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
      </svg>
    );
  }
  if (norm.includes("rodzin") || norm.includes("dziec")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function HomePage({
  initialEvents,
  categoryOptions,
  initialLocation,
  initialCategory,
  initialDateFilter
}: HomePageProps) {
  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter ?? "all");
  const [customDate, setCustomDate] = useState("");
  const [radiusKm, setRadiusKm] = useState(100);
  const [isAllPoland, setIsAllPoland] = useState(!initialLocation);
  const [category, setCategory] = useState<EventCategory | "Wszystkie">(
    initialCategory ?? "Wszystkie"
  );
  const [isFree, setIsFree] = useState(false);
  const [locationInput, setLocationInput] = useState(initialLocation?.label ?? "");
  const [location, setLocation] = useState<KnownLocation>(initialLocation ?? getDefaultLocation());
  const [locationStatus, setLocationStatus] = useState(
    initialLocation
      ? `Szukam wydarzeń w pobliżu: ${initialLocation.label}.`
      : ""
  );
  const [sortBy, setSortBy] = useState<"nearest" | "date">("nearest");
  const categoryNames = useMemo(() => categoryOptions.map((item) => item.name), [categoryOptions]);

  // Routing contexts
  const isCategoryPage = !!initialCategory && !initialLocation;
  const isCityPage = !initialCategory && !!initialLocation;
  const isCategoryCityPage = !!initialCategory && !!initialLocation;
  const isHomePage = !initialCategory && !initialLocation;

  // SEO copywriting & Headings
  const pageTitle = useMemo(() => {
    if (initialCategory && initialLocation) {
      return `${toPluralCategoryName(initialCategory)} ${formatInCity(initialLocation.label)}`;
    }
    if (initialCategory) {
      return `${toPluralCategoryName(initialCategory)} w Polsce`;
    }
    if (initialLocation) {
      return `Imprezy ${formatInCity(initialLocation.label)}`;
    }
    return undefined;
  }, [initialCategory, initialLocation]);

  const pageSubtitle = useMemo(() => {
    if (initialCategory && initialLocation) {
      return `Najbliższe ${toPluralCategoryName(initialCategory).toLowerCase()} ${formatInCity(initialLocation.label)}. Sprawdź zbliżający się kalendarz.`;
    }
    if (initialCategory) {
      const nameLower = toPluralCategoryName(initialCategory).toLowerCase();
      return `Sprawdź najbliższe ${nameLower}, festiwale muzyczne i występy na żywo.`;
    }
    if (initialLocation) {
      return `Znajdź koncerty, festiwale, wydarzenia sportowe i imprezy dla dzieci.`;
    }
    return undefined;
  }, [initialCategory, initialLocation]);

  const listHeading = useMemo(() => {
    if (initialCategory && initialLocation) {
      return `Kalendarz: ${toPluralCategoryName(initialCategory).toLowerCase()} ${formatInCity(initialLocation.label)}`;
    }
    if (initialCategory) {
      return `Nadchodzące ${toPluralCategoryName(initialCategory).toLowerCase()} w Polsce`;
    }
    if (initialLocation) {
      return `Nadchodzące wydarzenia ${formatInCity(initialLocation.label)}`;
    }
    return "Wydarzenia w Twojej okolicy";
  }, [initialCategory, initialLocation]);

  const seoTextHtml = useMemo(() => {
    return generateSeoText(initialCategory, initialLocation?.label);
  }, [initialCategory, initialLocation]);

  // Filtered events
  const filteredEvents = useMemo(
    () => {
      let results = filterEvents(initialEvents, {
        dateFilter, customDate, radiusKm: isAllPoland ? null : radiusKm, category, location, isFree
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
    [initialEvents, dateFilter, customDate, radiusKm, isAllPoland, category, location, isFree, sortBy]
  );

  // Featured events
  const featuredEvents = useMemo(
    () => filterEvents(initialEvents, {
      dateFilter: "week", customDate: "", radiusKm: null, category: "Wszystkie", location
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
    setIsAllPoland(false);
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
        setIsAllPoland(false);
        setLocation(gpsLocation);
        setLocationInput(gpsLocation.label);
        setLocationStatus("Używam Twojej aktualnej lokalizacji.");
      },
      () => setLocationStatus("Nie udało się pobrać lokalizacji."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleRadiusChange(radius: number) {
    setIsAllPoland(false);
    setRadiusKm(radius);
  }

  // filter radius to default location or specific city
  function handleAllPolandSelect() {
    setIsAllPoland(true);
    setLocation(getDefaultLocation());
    setLocationInput("");
    setLocationStatus("Pokazuję wydarzenia z całej Polski.");
  }

  return (
    <main className="homePage">
      {!isHomePage && (
        <nav className="breadcrumbs subpageBreadcrumbs" aria-label="Ścieżka powrotu">
          <Link href="/" aria-label="Strona główna">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px" }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </Link>
          {initialCategory && (
            <>
              <span className="separator">›</span>
              {initialLocation || initialDateFilter ? (
                <Link href={`/${toPluralCategorySlug(toSlug(initialCategory))}`}>{toPluralCategoryName(initialCategory)}</Link>
              ) : (
                <span className="current">{toPluralCategoryName(initialCategory)}</span>
              )}
            </>
          )}
          {initialLocation && (
            <>
              <span className="separator">›</span>
              {initialDateFilter ? (
                <Link href={initialCategory 
                  ? `/${toPluralCategorySlug(toSlug(initialCategory))}/${toSlug(initialLocation.label)}`
                  : `/${toSlug(initialLocation.label)}`
                }>
                  {initialLocation.label}
                </Link>
              ) : (
                <span className="current">{initialLocation.label}</span>
              )}
            </>
          )}
          {initialDateFilter && (
            <>
              <span className="separator">›</span>
              <span className="current">
                {initialDateFilter === "today" ? "Dzisiaj" : initialDateFilter === "weekend" ? "Weekend" : "Ten tydzień"}
              </span>
            </>
          )}
        </nav>
      )}

      <HeroSection
        eventCount={filteredEvents.length}
        onSelectCategory={(cat) => { setCategory(cat); setIsFree(false); }}
        onSelectFree={() => { setIsFree(true); setCategory("Wszystkie"); }}
        onSelectDateFilter={(f) => setDateFilter(f)}
        title={pageTitle}
        subtitle={pageSubtitle}
      />

      {isHomePage && (
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
          isAllPoland={isAllPoland}
          onRadiusChange={handleRadiusChange}
          onAllPolandSelect={handleAllPolandSelect}
          category={category}
          categories={categoryNames}
          onCategoryChange={(cat) => { setCategory(cat); setIsFree(false); }}
        />
      )}

      {/* City categories tiles grid and quick timing links */}
      {isCityPage && (
        <section className="cityCategoriesSec">
          <div className="citySecHeader">
            <h2>Kategorie wydarzeń {formatInCity(initialLocation.label)}</h2>
            <p>Przeglądaj wydarzenia w wybranym klimacie</p>
          </div>
          <div className="cityTilesGrid">
            {categoryOptions.map((cat) => (
              <Link
                key={cat.id}
                href={`/${toPluralCategorySlug(cat.slug)}/${toSlug(initialLocation.label)}`}
                className="cityTileCard"
              >
                <span className="cityTileIcon">
                  <CategoryIcon name={cat.name} />
                </span>
                <span className="cityTileName">{cat.name}</span>
              </Link>
            ))}
          </div>
          
          <div className="cityQuickTimeLinks">
            <Link href={`/${toSlug(initialLocation.label)}/dzis`} className="cityTimeBtn">
              📅 Wydarzenia dzisiaj {formatInCity(initialLocation.label)}
            </Link>
            <Link href={`/${toSlug(initialLocation.label)}/weekend`} className="cityTimeBtn">
              🎉 Wydarzenia w weekend {formatInCity(initialLocation.label)}
            </Link>
          </div>
        </section>
      )}

      {/* Main 70/30 layout: events list + sidebar */}
      <div className="mainLayout">
        <div className="mainColumn">
          <FeaturedEvents
            events={featuredEvents}
          />

          <section className="mainEvents" id="events-list" aria-label="Lista wydarzeń">
            <div className="mainEventsHeader">
              <h2>{listHeading}</h2>
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
                {filteredEvents.slice(0, 20).map(({ event, distanceKm }) => (
                  <EventCard key={event.id} event={event} distanceKm={distanceKm} />
                ))}
                {filteredEvents.length > 20 && (
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

          {/* Popular Cities linking cloud (for Category Page) */}
          {isCategoryPage && (
            <section className="internalLinksSec">
              <h3>Popularne miasta dla kategorii {toPluralCategoryName(initialCategory)}</h3>
              <div className="internalLinksGrid">
                {POPULAR_CITIES.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${toPluralCategorySlug(toSlug(initialCategory))}/${city.slug}`}
                    className="internalLinkCard"
                  >
                    <span>{toPluralCategoryName(initialCategory)} {city.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Other Categories linking cloud (for Category + City Page) */}
          {isCategoryCityPage && (
            <section className="internalLinksSec">
              <h3>Inne wydarzenia {formatInCity(initialLocation.label)}</h3>
              <div className="internalLinksGrid">
                {categoryOptions
                  .filter((cat) => cat.name !== toPluralCategoryName(initialCategory))
                  .map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/${toPluralCategorySlug(cat.slug)}/${toSlug(initialLocation.label)}`}
                      className="internalLinkCard"
                    >
                      <span>{cat.name} {formatInCity(initialLocation.label)}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </Link>
                  ))}
              </div>
            </section>
          )}

          {/* SEO Text Card */}
          <section className="seoTextSec">
            <div className="seoTextCard" dangerouslySetInnerHTML={{ __html: seoTextHtml }} />
          </section>
        </div>

        <Sidebar
          events={filteredEvents}
          categoryCounts={categoryCounts}
          onCategorySelect={(cat) => { setCategory(cat); setIsFree(false); }}
          selectedCategory={category}
          location={location}
          isAllPoland={isAllPoland}
        />
      </div>

      <ValueProps />
    </main>
  );
}

