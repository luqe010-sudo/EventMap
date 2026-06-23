"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type CategoryCityRoute, type CategoryOption, type EventCategory, type EventItem, type KnownLocation, getDefaultLocation, knownLocations } from "@/lib/events";
import {
  DEFAULT_MAX_PRICE,
  clampMaxPrice,
  filterEvents,
  type DateFilter,
  type PriceFilterMode,
  type PublicFilterParams
} from "@/lib/filters";
import HeroSection from "@/components/HeroSection";
import SearchPanel from "@/components/SearchPanel";
import CategoryIcon from "@/components/CategoryIcon";

import FeaturedEvents from "@/components/FeaturedEvents";
import EventCard from "@/components/EventCard";
import Sidebar from "@/components/Sidebar";
import ValueProps from "@/components/ValueProps";
import { toSlug, toPluralCategoryName, toPluralCategorySlug, formatInCity, buildSearchUrl } from "@/lib/slugs";
import { generateSeoText } from "@/lib/seo-texts";

type HomePageProps = {
  initialEvents: EventItem[];
  categoryOptions: CategoryOption[];
  initialLocation?: KnownLocation;
  initialCategory?: EventCategory;
  initialDateFilter?: DateFilter;
  initialFilters?: PublicFilterParams;
  activeCityLocations?: KnownLocation[];
  availableCategoryCityRoutes?: CategoryCityRoute[];
};

const EVENTS_PAGE_SIZE = 20;

const POPULAR_CITIES = [
  { label: "Wrocław", slug: "wroclaw" },
  { label: "Warszawa", slug: "warszawa" },
  { label: "Kraków", slug: "krakow" },
  { label: "Poznań", slug: "poznan" },
  { label: "Gdańsk", slug: "gdansk" },
  { label: "Łódź", slug: "lodz" },
];

export default function HomePage({
  initialEvents,
  categoryOptions,
  initialLocation,
  initialCategory,
  initialDateFilter,
  initialFilters,
  activeCityLocations = [],
  availableCategoryCityRoutes
}: HomePageProps) {
  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    initialFilters?.dateFilter ?? initialDateFilter ?? "all"
  );
  const [customDate, setCustomDate] = useState(initialFilters?.customDate ?? "");
  const [radiusKm, setRadiusKm] = useState(clampRadius(initialFilters?.radiusKm ?? 100));
  const [isAllPoland, setIsAllPoland] = useState(!initialLocation && initialFilters?.radiusKm == null);
  const [category, setCategory] = useState<EventCategory | "Wszystkie">(
    initialCategory ?? "Wszystkie"
  );
  const [priceMode, setPriceMode] = useState<PriceFilterMode>(initialFilters?.priceMode ?? "all");
  const [maxPrice, setMaxPrice] = useState(clampMaxPrice(initialFilters?.maxPrice ?? DEFAULT_MAX_PRICE));
  const [locationInput, setLocationInput] = useState(initialLocation?.label ?? "");
  const [location, setLocation] = useState<KnownLocation>(initialLocation ?? getDefaultLocation());
  const [locationStatus, setLocationStatus] = useState(
    initialLocation
      ? `Szukam wydarzeń w pobliżu: ${initialLocation.label}.`
      : ""
  );
  const [sortBy, setSortBy] = useState<"nearest" | "date">("date");
  const visibleEventsResetKey = useMemo(
    () => [
      dateFilter,
      customDate,
      radiusKm,
      isAllPoland,
      category,
      location.label,
      location.latitude,
      location.longitude,
      priceMode,
      maxPrice,
      sortBy
    ].join("|"),
    [dateFilter, customDate, radiusKm, isAllPoland, category, location, priceMode, maxPrice, sortBy]
  );
  const [visibleEventsPage, setVisibleEventsPage] = useState({
    count: EVENTS_PAGE_SIZE,
    resetKey: visibleEventsResetKey
  });

  // Routing contexts
  const isCategoryPage = !!initialCategory && !initialLocation;
  const isCityPage = !initialCategory && !!initialLocation && Boolean(initialLocation.slug);
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
        dateFilter,
        customDate,
        radiusKm: isAllPoland ? null : radiusKm,
        category,
        location,
        priceMode,
        maxPrice
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
    [initialEvents, dateFilter, customDate, radiusKm, isAllPoland, category, location, priceMode, maxPrice, sortBy]
  );

  // Featured events
  const featuredEvents = useMemo(
    () => filterEvents(initialEvents, {
      dateFilter: "all",
      customDate: "",
      radiusKm: null,
      category: "Wszystkie",
      location,
      priceMode: "all"
    }).filter(({ event }) => event.isFeatured),
    [initialEvents, location]
  );

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = new Map<EventCategory, number>();
    for (const { event } of filteredEvents) {
      counts.set(event.category, (counts.get(event.category) || 0) + 1);
    }
    return categoryOptions
      .filter((item) => counts.has(item.name))
      .map((item) => ({
        category: item.name,
        count: counts.get(item.name)!,
        color: item.color
      }))
      .sort((a, b) => b.count - a.count);
  }, [categoryOptions, filteredEvents]);

  const visibleEvents = useMemo(
    () => {
      const count =
        visibleEventsPage.resetKey === visibleEventsResetKey
          ? visibleEventsPage.count
          : EVENTS_PAGE_SIZE;
      return filteredEvents.slice(0, count);
    },
    [filteredEvents, visibleEventsPage, visibleEventsResetKey]
  );

  const hiddenEventsCount = Math.max(filteredEvents.length - visibleEvents.length, 0);

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
    setRadiusKm(clampRadius(radius));
  }

  // filter radius to default location or specific city
  function handleAllPolandSelect() {
    setIsAllPoland(true);
    setLocation(getDefaultLocation());
    setLocationInput("");
    setLocationStatus("Pokazuję wydarzenia z całej Polski.");
  }

  // Combine hardcoded known cities and database active city slugs
  const allKnownSlugs = useMemo(() => {
    const hardcoded = knownLocations.flatMap(loc => loc.aliases);
    const active = activeCityLocations.flatMap((loc) => [
      loc.slug,
      ...loc.aliases,
      toSlug(loc.label)
    ]).filter((slug): slug is string => Boolean(slug));
    return Array.from(new Set([...hardcoded, ...active]));
  }, [activeCityLocations]);

  const locationBySlug = useMemo(() => {
    const locations = new Map<string, KnownLocation>();
    for (const loc of [...knownLocations, ...activeCityLocations]) {
      const slugs = [loc.slug, ...loc.aliases, toSlug(loc.label)].filter((slug): slug is string => Boolean(slug));
      for (const slug of slugs) locations.set(slug, loc);
    }
    return locations;
  }, [activeCityLocations]);

  const availableCategoryCitySet = useMemo(() => {
    return new Set((availableCategoryCityRoutes ?? []).map((route) => `${route.categorySlug}/${route.citySlug}`));
  }, [availableCategoryCityRoutes]);

  const buildCategoryLocationHref = useCallback((categorySlug: string, loc: KnownLocation) => {
    const pluralCategorySlug = toPluralCategorySlug(categorySlug);
    const citySlug = loc.slug ?? toSlug(loc.label);

    if (availableCategoryCityRoutes === undefined || availableCategoryCitySet.has(`${pluralCategorySlug}/${citySlug}`)) {
      return `/${pluralCategorySlug}/${citySlug}`;
    }

    const lat = Math.round(loc.latitude * 1000) / 1000;
    const lng = Math.round(loc.longitude * 1000) / 1000;
    return `/${pluralCategorySlug}/lokalizacja?lat=${lat}&lng=${lng}&radius=30`;
  }, [availableCategoryCityRoutes, availableCategoryCitySet]);

  // Determine if location is a known city (has a slug-able name from city_pages/knownLocations)
  // GPS locations and geo points use empty aliases or ["gps"]
  const isKnownCity = useCallback((loc: KnownLocation) => {
    const label = loc.label.toLowerCase();
    if (label === "moja lokalizacja" || label === "polska" || label === "wybrana lokalizacja") {
      return false;
    }
    return Boolean(loc.slug && allKnownSlugs.includes(loc.slug));
  }, [allKnownSlugs]);

  /**
   * "Znajdź" button handler — builds a URL from current filter state and navigates.
   */
  const currentSearchUrl = useCallback(() => {
    // Resolve category slug (or undefined if "Wszystkie")
    const catSlug = category !== "Wszystkie"
      ? toPluralCategorySlug(toSlug(category))
      : undefined;

    // Resolve location
    let citySlug: string | undefined;
    let geoLocation: { lat: number; lng: number; radius: number } | undefined;

    if (!isAllPoland && isKnownCity(location)) {
      // Known city — use slug
      citySlug = location.slug ?? toSlug(location.label);
    } else if (!isAllPoland && location.label !== "Polska") {
      // GPS or unknown point — use lat/lng params
      geoLocation = {
        lat: Math.round(location.latitude * 1000) / 1000,
        lng: Math.round(location.longitude * 1000) / 1000,
        radius: radiusKm
      };
    }
    // If isAllPoland and no category → stay on home, just scroll

    const url = buildSearchUrl({
      categorySlug: catSlug,
      citySlug,
      geoLocation,
      dateFilter,
      customDate,
      priceMode,
      maxPrice,
      radiusKm: isAllPoland ? null : radiusKm
    });
    return url;
  }, [category, location, isAllPoland, radiusKm, isKnownCity, dateFilter, customDate, priceMode, maxPrice]);

  useEffect(() => {
    const url = currentSearchUrl();
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (url !== currentUrl) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [currentSearchUrl]);

  const handleFindSubmit = useCallback(() => {
    const url = currentSearchUrl();
    const target = new URL(url, window.location.origin);

    if (target.href === window.location.href) {
      window.location.reload();
      return;
    }

    window.location.assign(url);
  }, [currentSearchUrl]);

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
                  ? `/${toPluralCategorySlug(toSlug(initialCategory))}/${initialLocation.slug ?? toSlug(initialLocation.label)}`
                  : `/${initialLocation.slug ?? toSlug(initialLocation.label)}`
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
        onSelectCategory={(cat) => setCategory(cat)}
        onSelectFree={() => { setPriceMode("free"); setCategory("Wszystkie"); }}
        onSelectDateFilter={(f) => setDateFilter(f)}
        title={pageTitle}
        subtitle={pageSubtitle}
      />

      <SearchPanel
        locationInput={locationInput}
        onLocationInputChange={setLocationInput}
        onLocationSelect={handleLocationSelect}
        onUseGPS={handleUseGPS}
        citySuggestions={activeCityLocations}
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
        categories={categoryOptions}
        onCategoryChange={setCategory}
        priceMode={priceMode}
        maxPrice={maxPrice}
        onPriceModeChange={setPriceMode}
        onMaxPriceChange={(price) => setMaxPrice(clampMaxPrice(price))}
        onSubmit={handleFindSubmit}
      />



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
                  aria-label="Sortowanie wydarzeń"
                >
                  <option value="nearest">Najbliższe</option>
                  <option value="date">Wg daty</option>
                </select>
              </div>
            </div>

            {filteredEvents.length > 0 ? (
              <div className="eventsList">
                {visibleEvents.map(({ event, distanceKm }) => (
                  <EventCard key={event.id} event={event} distanceKm={distanceKm} />
                ))}
                {hiddenEventsCount > 0 && (
                  <button
                    type="button"
                    className="showMoreBtn"
                    onClick={() => {
                      setVisibleEventsPage((page) => {
                        const currentCount =
                          page.resetKey === visibleEventsResetKey
                            ? page.count
                            : EVENTS_PAGE_SIZE;
                        return {
                          count: Math.min(currentCount + EVENTS_PAGE_SIZE, filteredEvents.length),
                          resetKey: visibleEventsResetKey
                        };
                      });
                    }}
                  >
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

          {/* City categories tiles grid and quick timing links — below events */}
          {isCityPage && (
            <section className="cityCategoriesSec">
              <div className="citySecHeader">
                <h2>Kategorie wydarzeń {formatInCity(initialLocation!.label)}</h2>
                <p>Przeglądaj wydarzenia w wybranym klimacie</p>
              </div>
              <div className="cityTilesGrid">
                {categoryOptions.map((cat) => {
                  const catColor = cat.color || "var(--brand)";
                  return (
                    <Link
                      key={cat.id}
                      href={buildCategoryLocationHref(cat.slug, initialLocation!)}
                      className="cityTileCard"
                      style={{ "--hover-color": catColor } as React.CSSProperties}
                    >
                      <span
                        className="cityTileIcon"
                        style={{
                          color: catColor,
                          background: `color-mix(in srgb, ${catColor} 10%, white)`
                        }}
                      >
                        <CategoryIcon iconName={cat.icon} size={22} color={catColor} />
                      </span>
                      <span className="cityTileName">{cat.name}</span>
                    </Link>
                  );
                })}
              </div>
              
              <div className="cityQuickTimeLinks">
                <Link href={`/${initialLocation!.slug ?? toSlug(initialLocation!.label)}/dzis`} className="cityTimeBtn">
                  📅 Wydarzenia dzisiaj {formatInCity(initialLocation!.label)}
                </Link>
                <Link href={`/${initialLocation!.slug ?? toSlug(initialLocation!.label)}/weekend`} className="cityTimeBtn">
                  🎉 Wydarzenia w weekend {formatInCity(initialLocation!.label)}
                </Link>
              </div>
            </section>
          )}

          {/* Popular Cities linking cloud (for Category Page) */}
          {isCategoryPage && (
            <section className="internalLinksSec">
              <h3>Popularne miasta dla kategorii {toPluralCategoryName(initialCategory)}</h3>
              <div className="internalLinksGrid">
                {POPULAR_CITIES.map((city) => (
                  <Link
                    key={city.slug}
                    href={buildCategoryLocationHref(toSlug(initialCategory), locationBySlug.get(city.slug) ?? {
                      label: city.label,
                      aliases: [city.slug],
                      slug: city.slug,
                      latitude: getDefaultLocation().latitude,
                      longitude: getDefaultLocation().longitude
                    })}
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
                      href={buildCategoryLocationHref(cat.slug, initialLocation)}
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
          onCategorySelect={setCategory}
          selectedCategory={category}
          location={location}
          isAllPoland={isAllPoland}
        />
      </div>

      <ValueProps />
    </main>
  );
}

function clampRadius(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(Math.round(value), 5), 100);
}
