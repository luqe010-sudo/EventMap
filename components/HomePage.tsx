"use client";

import Link from "next/link";
import { List as ListIcon, Map as MapIcon, Compass, Search, RotateCcw, ArrowRight, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PUBLIC_EVENTS_MAX_RESULTS, PUBLIC_EVENTS_PAGE_SIZE, type CategoryCityRoute, type CategoryOption, type EventCategory, type EventItem, type EventMapMarker, type KnownLocation, type PublicEventSearchResult, getDefaultLocation, knownLocations } from "@/lib/events";
import {
  DEFAULT_MAX_PRICE,
  MAX_RADIUS_FILTER_LIMIT,
  clampMaxPrice,
  filterEvents,
  type DateFilter,
  type PriceFilterMode,
  type PublicFilterParams
} from "@/lib/filters";
import HeroSection from "@/components/HeroSection";
import SearchPanel from "@/components/SearchPanel";
import CategoryIcon from "@/components/CategoryIcon";
import MobileMapView from "@/components/MobileMapView";
import EventDetailView from "@/components/EventDetailView";
import FeaturedEvents from "@/components/FeaturedEvents";
import EventCarousel from "@/components/EventCarousel";
import { buildDiscoverySections, type DiscoverySection } from "@/lib/event-discovery";
import EventVenueDeck from "@/components/EventVenueDeck";
import { groupEventsByVenue } from "@/lib/event-groups";
import EventCard from "@/components/EventCard";
import Sidebar from "@/components/Sidebar";
import ValueProps from "@/components/ValueProps";
import { toSlug, toPluralCategoryName, toPluralCategorySlug, formatInCity, buildSearchUrl, eventPath } from "@/lib/slugs";
import { generateSeoText } from "@/lib/seo-texts";
import { hasLocationCoordinates, PUBLIC_EVENT_QUERY_MAX_LENGTH } from "@/lib/event-search";
import { WORKSPACE_RETURN_STORAGE_KEY, restorePublicWorkspaceSearch } from "@/lib/public-workspace-history";
import { useMobileWorkspaceAccessibility } from "@/components/useMobileWorkspaceAccessibility";

type HomePageProps = {
  initialEvents: EventItem[];
  initialFeaturedEvents?: EventItem[];
  initialEventSearch?: PublicEventSearchResult;
  categoryOptions: CategoryOption[];
  initialLocation?: KnownLocation;
  initialCategory?: EventCategory;
  initialDateFilter?: DateFilter;
  initialFilters?: PublicFilterParams;
  activeCityLocations?: KnownLocation[];
  availableCategoryCityRoutes?: CategoryCityRoute[];
};

const EMPTY_MAP_MARKERS: EventMapMarker[] = [];
const POPULAR_CITIES = [
  { label: "Wrocław", slug: "wroclaw" },
  { label: "Warszawa", slug: "warszawa" },
  { label: "Kraków", slug: "krakow" },
  { label: "Poznań", slug: "poznan" },
  { label: "Gdańsk", slug: "gdansk" },
  { label: "Łódź", slug: "lodz" },
];

type MobileView = "list" | "map" | "event";

type MobileWorkspaceHistory = {
  view: MobileView;
  eventId?: string;
  workspaceUrl: string;
  originView?: "list" | "map";
  destination?: "discover" | "results";
  scroll?: { discover: number; results: number };
};

export default function HomePage({
  initialEvents,
  initialFeaturedEvents,
  initialEventSearch,
  categoryOptions,
  initialLocation,
  initialCategory,
  initialDateFilter,
  initialFilters,
  activeCityLocations = []
}: HomePageProps) {
  const [viewMode, setViewMode] = useState<MobileView>("list");
  const [listDestination, setListDestination] = useState<"discover" | "results">("discover");
  const [hasOpenedMap, setHasOpenedMap] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState(initialEvents);
  const [recommendedPool, setRecommendedPool] = useState(initialFeaturedEvents ?? []);
  const [mapEvents, setMapEvents] = useState<EventMapMarker[] | null>(null);
  const [selectedMapEvent, setSelectedMapEvent] = useState<EventItem | null>(null);
  const [selectedMapEventLoading, setSelectedMapEventLoading] = useState(false);
  const [eventSearch, setEventSearch] = useState<PublicEventSearchResult>(
    initialEventSearch ?? {
      events: initialEvents,
      totalCount: initialEvents.length,
      page: 1,
      pageSize: PUBLIC_EVENTS_PAGE_SIZE,
      maxResults: PUBLIC_EVENTS_MAX_RESULTS,
      shownCount: initialEvents.length,
      hasMore: false
    }
  );
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [failedEventsPage, setFailedEventsPage] = useState(1);
  const [focusedMapEventId, setFocusedMapEventId] = useState<string>();
  const [markersLoading, setMarkersLoading] = useState(false);
  const [markersError, setMarkersError] = useState<string | null>(null);
  const [sidebarMapRequested, setSidebarMapRequested] = useState(false);
  const [historySearchRevision, setHistorySearchRevision] = useState(0);
  const homePageRef = useRef<HTMLElement | null>(null);
  const mobileEventViewRef = useRef<HTMLElement | null>(null);
  const listScrollPositionRef = useRef({ discover: 0, results: 0 });
  const [advancedRequest, setAdvancedRequest] = useState(0);
  const workspaceUrlRef = useRef("");
  const eventOriginViewRef = useRef<"list" | "map">("list");
  const pointerStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    timestamp: number;
    direction: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const touchStartRef = useRef<{
    identifier: number;
    x: number;
    y: number;
    timestamp: number;
    direction: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const dragSettleTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const searchRequestRef = useRef(0);
  const markerRequestRef = useRef(0);
  const mapEventRequestRef = useRef(0);
  const historyRestoreRequestRef = useRef(0);
  const eventsAbortRef = useRef<AbortController | null>(null);
  const markersAbortRef = useRef<AbortController | null>(null);

  // Filter state
  const [queryInput, setQueryInput] = useState(initialFilters?.query ?? "");
  const [searchQuery, setSearchQuery] = useState(initialFilters?.query ?? "");
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    initialFilters?.dateFilter ?? initialDateFilter ?? "all"
  );
  const [customDate, setCustomDate] = useState(initialFilters?.customDate ?? "");
  const [radiusKm, setRadiusKm] = useState(clampRadius(initialFilters?.radiusKm ?? 100));
  const [isAllPoland, setIsAllPoland] = useState(!initialLocation);
  const [locationMode, setLocationMode] = useState<"city" | "radius">(
    initialLocation?.slug && initialFilters?.radiusKm == null ? "city" : "radius"
  );
  const [category, setCategory] = useState<EventCategory | "Wszystkie">(
    initialCategory ?? "Wszystkie"
  );
  const [priceMode, setPriceMode] = useState<PriceFilterMode>(initialFilters?.priceMode ?? "all");
  const [maxPrice, setMaxPrice] = useState(clampMaxPrice(initialFilters?.maxPrice ?? DEFAULT_MAX_PRICE));
  const [locationInput, setLocationInput] = useState(initialLocation?.label ?? "");
  const [location, setLocation] = useState<KnownLocation>(initialLocation ?? getDefaultLocation());
  const [locationStatus, setLocationStatus] = useState(
    initialLocation
      ? hasLocationCoordinates(initialLocation)
        ? initialFilters?.radiusKm != null || !initialLocation.slug
          ? `Szukam w promieniu ${initialFilters?.radiusKm ?? 100} km: ${initialLocation.label}.`
          : `Szukam wydarzeń w miejscowości: ${initialLocation.label}.`
        : `Brak współrzędnych centrum ${initialLocation.label}. Dostępne jest wyszukiwanie w mieście; promień i odległość są niedostępne.`
      : "Przeglądasz całą Polskę. Wybierz miejscowość lub użyj GPS, aby zobaczyć lokalną ofertę."
  );
  const [sortBy, setSortBy] = useState<"nearest" | "date">(initialFilters?.sortBy ?? "date");
  const hasLocationCenter = hasLocationCoordinates(location);
  const effectiveRadius = !isAllPoland && locationMode === "radius" && hasLocationCenter ? radiusKm : null;
  const effectiveSort = !isAllPoland && hasLocationCenter ? sortBy : "date";
  const activeCategory = category === "Wszystkie" ? undefined : category;
  const activeLocation = isAllPoland ? undefined : location;
  const activeLocationLabel = activeLocation
    ? getPublicLocationLabel(activeLocation.label)
    : undefined;
  const activeLocationPhrase = activeLocation
    ? `${getLocationPhrase(activeLocationLabel ?? activeLocation.label)}${effectiveRadius != null ? ` i okolicy · ${radiusKm} km` : ""}`
    : undefined;

  useEffect(() => {
    const nextQuery = queryInput.trim();
    if (nextQuery === searchQuery) return;
    const timeoutId = window.setTimeout(() => setSearchQuery(nextQuery), nextQuery ? 300 : 0);
    return () => window.clearTimeout(timeoutId);
  }, [queryInput, searchQuery]);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const stored = (window.history.state as { eventMapWorkspace?: MobileWorkspaceHistory } | null)?.eventMapWorkspace;
    const { pathname, search, hash } = window.location;
    if (stored?.scroll) listScrollPositionRef.current = stored.scroll;
    if (hash === "#odkryj" || hash === "#events-list" || hash === "#mapa") {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(WORKSPACE_RETURN_STORAGE_KEY) ?? "null") as { url: string; scroll: MobileWorkspaceHistory["scroll"] } | null;
        if (saved?.url === pathname + search && saved.scroll) listScrollPositionRef.current = saved.scroll;
      } catch { /* Session storage is optional. */ }
    }
    const destination = hash === "#events-list" ? "results" : hash === "#odkryj" ? "discover" : stored?.destination;
    if (destination) setListDestination(destination);
    if (stored?.view === "map" && hash !== "#events-list" && hash !== "#odkryj") {
      setHasOpenedMap(true);
      setViewMode("map");
    } else if (destination && (stored?.scroll || hash === "#events-list" || hash === "#odkryj")) {
      window.requestAnimationFrame(() => window.scrollTo({ top: listScrollPositionRef.current[destination], behavior: "instant" }));
    }
  }, []);

  // Visible copy follows the live filters, not only the route used for the first render.
  const pageTitle = useMemo(() => {
    if (activeCategory && activeLocationPhrase) {
      return `${toPluralCategoryName(activeCategory)} ${activeLocationPhrase}`;
    }
    if (activeCategory) {
      return `${toPluralCategoryName(activeCategory)} w Polsce`;
    }
    if (activeLocationPhrase) {
      return `Imprezy ${activeLocationPhrase}`;
    }
    return undefined;
  }, [activeCategory, activeLocationPhrase]);

  const pageSubtitle = useMemo(() => {
    if (activeCategory && activeLocationPhrase) {
      return `Najbliższe ${toPluralCategoryName(activeCategory).toLowerCase()} ${activeLocationPhrase}. Sprawdź zbliżający się kalendarz.`;
    }
    if (activeCategory) {
      const nameLower = toPluralCategoryName(activeCategory).toLowerCase();
      return `Sprawdź dostępne wydarzenia w kategorii ${nameLower}. Wybierz miejscowość i datę.`;
    }
    if (activeLocation) {
      return `Znajdź koncerty, festiwale, wydarzenia sportowe i imprezy dla dzieci.`;
    }
    return undefined;
  }, [activeCategory, activeLocation, activeLocationPhrase]);

  const listHeading = useMemo(() => {
    if (activeCategory && activeLocationPhrase) {
      return `Kalendarz: ${toPluralCategoryName(activeCategory).toLowerCase()} ${activeLocationPhrase}`;
    }
    if (activeCategory) {
      return `Wydarzenia z kategorii ${toPluralCategoryName(activeCategory)} w Polsce`;
    }
    if (activeLocationPhrase) {
      return `Nadchodzące wydarzenia ${activeLocationPhrase}`;
    }
    return "Nadchodzące wydarzenia w Polsce";
  }, [activeCategory, activeLocationPhrase]);

  const seoTextHtml = useMemo(() => {
    const seoLocation = activeLocation?.slug ? activeLocationLabel : undefined;
    return generateSeoText(activeCategory, seoLocation);
  }, [activeCategory, activeLocation, activeLocationLabel]);

  // Filtered events
  const filteredEvents = useMemo(
    () => {
      const results = filterEvents(events, {
        query: searchQuery,
        dateFilter,
        customDate,
        radiusKm: effectiveRadius,
        category,
        location,
        priceMode,
        maxPrice,
        sortBy: effectiveSort
      });
      return isAllPoland ? results.map((item) => ({ ...item, distanceKm: Number.POSITIVE_INFINITY })) : results;
    },
    [events, searchQuery, dateFilter, customDate, effectiveRadius, isAllPoland, category, location, priceMode, maxPrice, effectiveSort]
  );

  // Featured events
  const featuredEvents = useMemo(
    () => filterEvents([...new Map([...recommendedPool, ...events].map((event) => [event.id, event])).values()], {
      query: searchQuery,
      dateFilter,
      customDate,
      radiusKm: effectiveRadius,
      category,
      location,
      priceMode,
      maxPrice
    }).sort((a, b) => Number(b.event.isFeatured) - Number(a.event.isFeatured)).slice(0, 8)
      .map((item) => isAllPoland ? { ...item, distanceKm: Number.POSITIVE_INFINITY } : item),
    [events, recommendedPool, searchQuery, dateFilter, customDate, category, location, isAllPoland, effectiveRadius, priceMode, maxPrice]
  );

  const visibleEvents = filteredEvents;
  const venueGroups = useMemo(() => groupEventsByVenue(visibleEvents), [visibleEvents]);
  const discoverySections = useMemo(
    () => buildDiscoverySections(filteredEvents, {
      dateFilter,
      category,
      priceMode,
      locationLabel: activeLocationLabel,
      shownEventIds: featuredEvents.map(({ event }) => event.id)
    }),
    [filteredEvents, featuredEvents, dateFilter, category, priceMode, activeLocationLabel]
  );
  const shownEventsCount = Math.min(eventSearch.shownCount, eventSearch.maxResults);
  const canLoadMoreEvents = !eventsLoading && eventSearch.hasMore && shownEventsCount < eventSearch.maxResults;
  const eventById = useMemo(
    () => new Map([...recommendedPool, ...events].map((event) => [event.id, event])),
    [events, recommendedPool]
  );

  const openedEvent = openedEventId
    ? eventById.get(openedEventId) ?? (selectedMapEvent?.id === openedEventId ? selectedMapEvent : null)
    : null;

  const openedEventRelated = useMemo(() => {
    if (!openedEvent) return [];
    return events
      .filter((e) => e.id !== openedEvent.id && e.category === openedEvent.category && e.citySlug === openedEvent.citySlug)
      .slice(0, 3);
  }, [events, openedEvent]);

  useEffect(() => {
    if (viewMode === "event" || !mapEvents) return;
    if (
      selectedEventId &&
      !mapEvents.some((event) => event.id === selectedEventId)
    ) {
      ++mapEventRequestRef.current;
      setFocusedMapEventId(undefined);
      setSelectedEventId(null);
      setSelectedMapEvent(null);
      setSelectedMapEventLoading(false);
    }
  }, [mapEvents, selectedEventId, viewMode]);

  useEffect(() => {
    if (openedEventId && !eventById.has(openedEventId) && selectedMapEvent?.id !== openedEventId) {
      setOpenedEventId(null);
      if (viewMode === "event") setViewMode("list");
    }
  }, [eventById, openedEventId, selectedMapEvent, viewMode]);

  useEffect(() => {
    if (!openedEventId) return;
    mobileEventViewRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [openedEventId]);

  useEffect(() => {
    if (viewMode === "list" || !window.matchMedia("(max-width: 760px)").matches) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("mobileMapActive");
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("mobileMapActive");
    };
  }, [viewMode]);

  // Handlers
  function handleLocationSelect(loc: KnownLocation) {
    setIsAllPoland(false);
    setLocation(loc);
    setLocationInput(loc.label);
    setLocationMode(isKnownCity(loc) ? "city" : "radius");
    setLocationStatus(hasLocationCoordinates(loc)
      ? isKnownCity(loc) ? `Szukam wydarzeń w miejscowości: ${loc.label}.` : `Szukam w promieniu ${radiusKm} km: ${loc.label}.`
      : `Brak współrzędnych centrum ${loc.label}. Dostępne jest wyszukiwanie w mieście; promień i odległość są niedostępne.`);
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
        setLocationMode("radius");
        setLocationInput(gpsLocation.label);
        setLocationStatus("Używam Twojej aktualnej lokalizacji.");
      },
      () => setLocationStatus("Nie udało się pobrać lokalizacji."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleRadiusChange(radius: number) {
    if (isAllPoland || !hasLocationCenter) {
      setLocationStatus("Wybierz miejscowość lub użyj GPS, zanim ustawisz promień wyszukiwania.");
      return;
    }
    setIsAllPoland(false);
    setRadiusKm(clampRadius(radius));
    setLocationMode("radius");
    setLocationStatus(`Szukam w promieniu ${clampRadius(radius)} km: ${location.label}.`);
  }

  function handleLocationModeChange(mode: "city" | "radius") {
    if (mode === "radius" && !hasLocationCenter) return;
    setLocationMode(mode);
    setLocationStatus(mode === "city"
      ? `Szukam wydarzeń w miejscowości: ${location.label}.`
      : `Szukam w promieniu ${radiusKm} km: ${location.label}.`);
  }

  // filter radius to default location or specific city
  function handleAllPolandSelect() {
    setIsAllPoland(true);
    setLocation(getDefaultLocation());
    setLocationInput("");
    setLocationStatus("Pokazuję wydarzenia z całej Polski.");
  }

  function selectDiscovery(section: DiscoverySection) {
    if (section.filters?.dateFilter) {
      setDateFilter(section.filters.dateFilter);
      setCustomDate("");
    }
    if (section.filters?.category) {
      const slug = toPluralCategorySlug(toSlug(section.filters.category));
      const option = categoryOptions.find((item) => toPluralCategorySlug(item.slug) === slug);
      setCategory(option?.name ?? section.filters.category);
    }
    if (section.filters?.priceMode) setPriceMode(section.filters.priceMode);
    showResults();
  }

  function changeQuery(value: string) {
    setQueryInput(value.slice(0, PUBLIC_EVENT_QUERY_MAX_LENGTH));
  }

  function showSearchResults() {
    setSearchQuery(queryInput.trim());
    showResults();
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

  const buildCategoryLocationHref = useCallback((categorySlug: string, loc: KnownLocation) => {
    const pluralCategorySlug = toPluralCategorySlug(categorySlug);
    const citySlug = loc.slug ?? toSlug(loc.label);

    if (loc.slug || !hasLocationCoordinates(loc)) {
      return `/${pluralCategorySlug}/${citySlug}`;
    }

    const lat = Math.round(loc.latitude * 1000) / 1000;
    const lng = Math.round(loc.longitude * 1000) / 1000;
    return `/${pluralCategorySlug}/lokalizacja?lat=${lat}&lng=${lng}&radius=30`;
  }, []);

  // Determine if location is a known city (has a slug-able name from city_pages/knownLocations)
  // GPS locations and geo points use empty aliases or ["gps"]
  const isKnownCity = useCallback((loc: KnownLocation) => {
    const label = loc.label.toLowerCase();
    if (label === "moja lokalizacja" || label === "polska" || label === "wybrana lokalizacja") {
      return false;
    }
    return Boolean(loc.slug && allKnownSlugs.includes(loc.slug));
  }, [allKnownSlugs]);

  // The URL follows the live filters and is reused by the mobile workspace.
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
    } else if (!isAllPoland && hasLocationCoordinates(location)) {
      // GPS or unknown point — use lat/lng params
      geoLocation = {
        lat: Math.round(location.latitude * 1000) / 1000,
        lng: Math.round(location.longitude * 1000) / 1000,
        radius: radiusKm
      };
    }
    // If isAllPoland and no category → stay on home, just scroll

    const url = buildSearchUrl({
      query: searchQuery,
      categorySlug: catSlug,
      citySlug,
      geoLocation,
      dateFilter,
      customDate,
      priceMode,
      maxPrice,
      radiusKm: effectiveRadius,
      sortBy: effectiveSort
    });
    return url;
  }, [searchQuery, category, location, isAllPoland, radiusKm, isKnownCity, dateFilter, customDate, priceMode, maxPrice, effectiveRadius, effectiveSort]);

  const currentEventsApiParams = useCallback((page: number) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PUBLIC_EVENTS_PAGE_SIZE)
    });
    if (searchQuery) params.set("q", searchQuery);

    if (category !== "Wszystkie") {
      params.set("categorySlug", toPluralCategorySlug(toSlug(category)));
    }

    if (!isAllPoland && isKnownCity(location)) {
      params.set("citySlug", location.slug ?? toSlug(location.label));
    } else if (!isAllPoland && hasLocationCoordinates(location)) {
      params.set("lat", String(Math.round(location.latitude * 1000) / 1000));
      params.set("lng", String(Math.round(location.longitude * 1000) / 1000));
    }

    if (effectiveRadius != null) params.set("radius", String(effectiveRadius));
    if (effectiveSort === "nearest") params.set("sort", "nearest");

    if (dateFilter !== "all") {
      params.set("kiedy", dateFilter);
      if (dateFilter === "custom") {
        const [from, to] = customDate.split("/");
        if (from) params.set("dataOd", from);
        if (to) params.set("dataDo", to);
      }
    }

    if (priceMode !== "all") {
      params.set("cena", priceMode);
      if (priceMode === "max") params.set("cenaMax", String(maxPrice));
    }

    return params;
  }, [searchQuery, category, customDate, dateFilter, isAllPoland, isKnownCity, location, maxPrice, priceMode, effectiveRadius, effectiveSort]);

  const eventsSearchKey = useMemo(
    () => currentEventsApiParams(1).toString(),
    [currentEventsApiParams]
  );
  const markerSearchKey = useMemo(() => {
    const params = new URLSearchParams(eventsSearchKey);
    params.delete("page");
    params.delete("pageSize");
    params.delete("sort");
    return params.toString();
  }, [eventsSearchKey]);
  const initialMarkerSearchKey = useRef(markerSearchKey);
  const lastSearchIdentity = useRef(`0:${eventsSearchKey}`);

  useEffect(() => {
    if (initialFeaturedEvents && markerSearchKey === initialMarkerSearchKey.current) {
      setRecommendedPool(initialFeaturedEvents);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams(markerSearchKey);
    params.set("featured", "1");
    params.set("pageSize", "8");
    void fetch(`/api/events/search?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Featured search failed");
        const result = await response.json() as PublicEventSearchResult;
        if (!controller.signal.aborted) setRecommendedPool(result.events);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.error("[home] Failed to load featured events", error);
      });
    return () => controller.abort();
  }, [initialFeaturedEvents, markerSearchKey]);

  const loadEventsPage = useCallback(async (page: number, mode: "replace" | "append") => {
    const requestId = ++searchRequestRef.current;
    eventsAbortRef.current?.abort();
    const controller = new AbortController();
    eventsAbortRef.current = controller;
    setEventsError(null);
    if (mode === "append") setEventsLoadingMore(true);
    else {
      setEventsLoading(true);
      setEventsLoadingMore(false);
      setEvents([]);
    }

    try {
      const response = await fetch(`/api/events/search?${currentEventsApiParams(page).toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Events search request failed");
      const result = (await response.json()) as PublicEventSearchResult;
      if (searchRequestRef.current !== requestId) return;

      setEventSearch(result);
      setEvents((currentEvents) => {
        if (mode === "replace") return result.events;
        const byId = new Map(currentEvents.map((event) => [event.id, event]));
        for (const event of result.events) byId.set(event.id, event);
        return Array.from(byId.values());
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[home] Failed to load filtered events", error);
      if (searchRequestRef.current === requestId) {
        setFailedEventsPage(page);
        setEventsError("Nie udało się pobrać wydarzeń dla aktualnych filtrów.");
      }
    } finally {
      if (searchRequestRef.current === requestId) {
        setEventsLoading(false);
        setEventsLoadingMore(false);
      }
    }
  }, [currentEventsApiParams]);

  const loadMapMarkers = useCallback(async () => {
    const requestId = ++markerRequestRef.current;
    markersAbortRef.current?.abort();
    const controller = new AbortController();
    markersAbortRef.current = controller;
    setMarkersLoading(true);
    setMarkersError(null);
    setMapEvents(null);

    try {
      const response = await fetch(`/api/events/markers?${markerSearchKey}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Event markers request failed");
      const result = (await response.json()) as { markers: EventMapMarker[] };
      if (markerRequestRef.current !== requestId) return;
      setMapEvents(result.markers);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[home] Failed to load event markers", error);
      if (markerRequestRef.current === requestId) setMarkersError("Nie udało się pobrać punktów na mapę.");
    } finally {
      if (markerRequestRef.current === requestId) setMarkersLoading(false);
    }
  }, [markerSearchKey]);

  const loadMapEventDetail = useCallback(async (eventId: string) => {
    const requestId = ++mapEventRequestRef.current;
    const loadedEvent = eventById.get(eventId);
    if (loadedEvent) {
      setSelectedMapEvent(loadedEvent);
      setSelectedMapEventLoading(false);
      return loadedEvent;
    }

    setSelectedMapEvent(null);
    setSelectedMapEventLoading(true);

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
      if (!response.ok) throw new Error("Event detail request failed");
      const result = (await response.json()) as { event: EventItem };
      if (mapEventRequestRef.current !== requestId) return null;
      setSelectedMapEvent(result.event);
      return result.event;
    } catch (error) {
      console.error("[home] Failed to load map event detail", error);
      if (mapEventRequestRef.current === requestId) setSelectedMapEvent(null);
      return null;
    } finally {
      if (mapEventRequestRef.current === requestId) setSelectedMapEventLoading(false);
    }
  }, [eventById]);

  const rememberMobileScroll = useCallback(() => {
    if (viewMode === "list" && window.matchMedia("(max-width: 760px)").matches) {
      listScrollPositionRef.current[listDestination] = window.scrollY;
    }
  }, [listDestination, viewMode]);

  const restoreMobileScroll = useCallback((destination: "discover" | "results") => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: listScrollPositionRef.current[destination], behavior: "instant" });
    });
  }, []);

  useEffect(() => {
    async function handlePopState(popEvent: PopStateEvent) {
      const requestId = ++historyRestoreRequestRef.current;
      const historyState = (popEvent.state as { eventMapWorkspace?: MobileWorkspaceHistory } | null)?.eventMapWorkspace;
      if (!historyState) {
        // Entries owned by another route need their server-rendered context.
        window.location.reload();
        return;
      }
      if (historyState.workspaceUrl !== currentSearchUrl()) {
        const restored = restorePublicWorkspaceSearch(historyState.workspaceUrl, window.location.origin, categoryOptions, locationBySlug);
        if (!restored) {
          window.location.reload();
          return;
        }
        // Reject outstanding results from the workspace being left immediately.
        ++searchRequestRef.current;
        ++markerRequestRef.current;
        ++mapEventRequestRef.current;
        setHistorySearchRevision(revision => revision + 1);
        setCategory(restored.category);
        setIsAllPoland(restored.location === null);
        setLocation(restored.location ?? getDefaultLocation());
        setLocationInput(restored.location?.label ?? "");
        setLocationMode(restored.locationMode);
        setRadiusKm(restored.radiusKm);
        setDateFilter(restored.dateFilter);
        setCustomDate(restored.customDate);
        setQueryInput(restored.query ?? "");
        setSearchQuery(restored.query ?? "");
        setPriceMode(restored.priceMode);
        setMaxPrice(restored.maxPrice);
        setSortBy(restored.sortBy);
        setLocationStatus(!restored.location ? "Pokazuję wydarzenia z całej Polski."
          : restored.locationMode === "radius" ? `Szukam w promieniu ${restored.radiusKm} km: ${restored.location.label}.`
          : `Szukam wydarzeń w miejscowości: ${restored.location.label}.`);
      }
      workspaceUrlRef.current = historyState.workspaceUrl;
      if (historyState.scroll) listScrollPositionRef.current = { ...historyState.scroll };
      const restoredDestination = historyState.destination ?? "discover";
      setListDestination(restoredDestination);
      if (historyState.view === "event" && historyState.eventId) {
        // Preserve the canonical event URL while its detail is being restored.
        setViewMode("event");
        setOpenedEventId(null);
        const restored = eventById.get(historyState.eventId) ?? await loadMapEventDetail(historyState.eventId);
        if (historyRestoreRequestRef.current !== requestId) return;
        if (!restored) {
          // The canonical page owns the unavailable/not-found state.
          window.location.reload();
          return;
        }
        eventOriginViewRef.current = historyState.originView ?? "list";
        setSelectedMapEvent(restored);
        setSelectedEventId(restored.id);
        setOpenedEventId(restored.id);
        setViewMode("event");
        return;
      }
      const restoredEventId = historyState.eventId && eventById.has(historyState.eventId) ? historyState.eventId : null;
      setOpenedEventId(restoredEventId);
      if (restoredEventId) setSelectedEventId(restoredEventId);
      if (historyState.view === "map") setHasOpenedMap(true);
      setViewMode(historyState.view === "map" ? "map" : "list");
      if (historyState.view === "list" && window.matchMedia("(max-width: 760px)").matches) restoreMobileScroll(restoredDestination);
    }
    window.addEventListener("popstate", handlePopState);
    return () => { window.removeEventListener("popstate", handlePopState); };
  }, [categoryOptions, currentSearchUrl, eventById, loadMapEventDetail, locationBySlug, restoreMobileScroll]);

  useEffect(() => () => {
    ++historyRestoreRequestRef.current;
    ++mapEventRequestRef.current;
    eventsAbortRef.current?.abort();
    markersAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (viewMode === "event") return;

    const url = currentSearchUrl();
    workspaceUrlRef.current = url;
    window.history.replaceState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view: viewMode,
          eventId: openedEventId ?? undefined,
          workspaceUrl: url,
          destination: listDestination,
          scroll: { ...listScrollPositionRef.current }
        } satisfies MobileWorkspaceHistory
      },
      "",
      url + window.location.hash
    );
  }, [currentSearchUrl, listDestination, openedEventId, viewMode]);

  useEffect(() => {
    const identity = `${historySearchRevision}:${eventsSearchKey}`;
    if (lastSearchIdentity.current === identity) return;
    lastSearchIdentity.current = identity;
    void loadEventsPage(1, "replace");
  }, [eventsSearchKey, historySearchRevision, loadEventsPage]);

  const requestSidebarMap = useCallback(() => setSidebarMapRequested(true), []);
  const shouldLoadMarkers = sidebarMapRequested || hasOpenedMap;
  useEffect(() => {
    if (shouldLoadMarkers) void loadMapMarkers();
  }, [shouldLoadMarkers, historySearchRevision, loadMapMarkers]);

  const pushWorkspaceHistory = useCallback((view: "list" | "map", destination: "discover" | "results") => {
    const workspaceUrl = currentSearchUrl();
    const state = window.history.state;
    if (state?.eventMapWorkspace) {
      window.history.replaceState({ ...state, eventMapWorkspace: { ...state.eventMapWorkspace, scroll: { ...listScrollPositionRef.current } } }, "");
    }
    window.history.pushState(
      {
        ...state,
        eventMapWorkspace: {
          view,
          eventId: openedEventId ?? undefined,
          workspaceUrl,
          destination,
          scroll: { ...listScrollPositionRef.current }
        } satisfies MobileWorkspaceHistory
      },
      "",
      workspaceUrl
    );
  }, [currentSearchUrl, openedEventId]);

  const selectMapEvent = useCallback((eventId: string) => {
    setFocusedMapEventId(undefined);
    setSelectedEventId(eventId);
    void loadMapEventDetail(eventId);
  }, [loadMapEventDetail]);

  const clearMapSelection = useCallback(() => {
    ++mapEventRequestRef.current;
    setFocusedMapEventId(undefined);
    setSelectedEventId(null);
    setSelectedMapEvent(null);
    setSelectedMapEventLoading(false);
  }, []);

  const showMobileMap = useCallback((eventId?: string, fromHash = false) => {
    if (eventId) {
      selectMapEvent(eventId);
      setFocusedMapEventId(eventId);
    }
    if (!window.matchMedia("(max-width: 760px)").matches) {
      setSidebarMapRequested(true);
      document.getElementById("desktop-map")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (viewMode === "map") return;
    rememberMobileScroll();
    if (!fromHash) pushWorkspaceHistory("map", listDestination);
    setHasOpenedMap(true);
    setViewMode("map");
  }, [listDestination, pushWorkspaceHistory, rememberMobileScroll, selectMapEvent, viewMode]);

  const showMobileList = useCallback((destination = listDestination, fromStart = false) => {
    if (viewMode !== "list" || destination !== listDestination) {
      rememberMobileScroll();
      if (fromStart) listScrollPositionRef.current[destination] = 0;
      pushWorkspaceHistory("list", destination);
      setListDestination(destination);
      setViewMode("list");
      restoreMobileScroll(destination);
    } else if (fromStart) {
      listScrollPositionRef.current[destination] = 0;
      restoreMobileScroll(destination);
    }
  }, [listDestination, pushWorkspaceHistory, rememberMobileScroll, restoreMobileScroll, viewMode]);

  useEffect(() => {
    function navigateToMap() {
      if (window.location.hash !== "#mapa") return;
      if (window.matchMedia("(max-width: 760px)").matches) showMobileMap(undefined, true);
      else document.getElementById("desktop-map")?.scrollIntoView({ block: "start" });
    }
    function openMap() { showMobileMap(); }
    function openDiscover() {
      if (window.matchMedia("(max-width: 760px)").matches) showMobileList("discover");
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }
    navigateToMap();
    window.addEventListener("hashchange", navigateToMap);
    window.addEventListener("eventmap:show-map", openMap);
    window.addEventListener("eventmap:show-discover", openDiscover);
    return () => {
      window.removeEventListener("hashchange", navigateToMap);
      window.removeEventListener("eventmap:show-map", openMap);
      window.removeEventListener("eventmap:show-discover", openDiscover);
    };
  }, [showMobileList, showMobileMap]);

  function showResults() {
    if (window.matchMedia("(max-width: 760px)").matches) showMobileList("results", true);
    else scrollToResults();
  }

  function showMapFilters() {
    setAdvancedRequest((request) => request + 1);
  }

  const openMobileEvent = useCallback((eventId: string) => {
    const event = eventById.get(eventId) ?? (selectedMapEvent?.id === eventId ? selectedMapEvent : null);
    if (!event) return;

    const workspaceUrl = workspaceUrlRef.current || currentSearchUrl();
    if (viewMode !== "event") {
      eventOriginViewRef.current = viewMode === "map" ? "map" : "list";
      rememberMobileScroll();
    }
    workspaceUrlRef.current = workspaceUrl;
    const state = window.history.state;
    if (state?.eventMapWorkspace && viewMode !== "event") {
      window.history.replaceState({ ...state, eventMapWorkspace: { ...state.eventMapWorkspace, scroll: { ...listScrollPositionRef.current } } }, "");
    }
    setSelectedEventId(eventId);
    setOpenedEventId(eventId);
    setViewMode("event");
    window.history.pushState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view: "event",
          eventId,
          workspaceUrl,
          originView: eventOriginViewRef.current,
          destination: listDestination,
          scroll: { ...listScrollPositionRef.current }
        } satisfies MobileWorkspaceHistory
      },
      "",
      eventPath(event)
    );
  }, [currentSearchUrl, eventById, listDestination, rememberMobileScroll, selectedMapEvent, viewMode]);

  const closeMobileEvent = useCallback(() => {
    const workspaceUrl = workspaceUrlRef.current || currentSearchUrl();
    const returnView = eventOriginViewRef.current;
    window.history.replaceState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view: returnView,
          destination: listDestination,
          scroll: { ...listScrollPositionRef.current },
          workspaceUrl
        } satisfies MobileWorkspaceHistory
      },
      "",
      workspaceUrl
    );
    setOpenedEventId(null);
    if (returnView === "map") setHasOpenedMap(true);
    setViewMode(returnView);
    if (returnView === "list") restoreMobileScroll(listDestination);
  }, [currentSearchUrl, listDestination, restoreMobileScroll]);

  useMobileWorkspaceAccessibility({ workspaceRef: homePageRef, view: viewMode, event: openedEvent, onCloseEvent: closeMobileEvent, onShowList: showMobileList });

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 760px)");
    const showDesktopList = () => {
      if (mobile.matches) return;
      setViewMode("list");
      setOpenedEventId(null);
    };
    mobile.addEventListener("change", showDesktopList);
    return () => mobile.removeEventListener("change", showDesktopList);
  }, []);

  function handlePointerStart(event: React.PointerEvent<HTMLElement>) {
    if (
      event.pointerType === "touch" ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      shouldIgnoreViewSwipe(event.target)
    ) {
      pointerStartRef.current = null;
      return;
    }

    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      direction: "pending"
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const isHorizontal = trackViewDrag(
      start,
      event.clientX - start.x,
      event.clientY - start.y
    );
    if (isHorizontal) event.preventDefault();
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (completeViewSwipe(deltaX, deltaY, Date.now() - start.timestamp)) {
      event.preventDefault();
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || shouldIgnoreViewSwipe(event.target)) {
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
      direction: "pending"
    };
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    if (!start) return;

    const touch = Array.from(event.touches).find(
      (item) => item.identifier === start.identifier
    );
    if (!touch) return;

    const isHorizontal = trackViewDrag(
      start,
      touch.clientX - start.x,
      touch.clientY - start.y
    );
    if (isHorizontal && event.cancelable) event.preventDefault();
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = Array.from(event.changedTouches).find(
      (item) => item.identifier === start.identifier
    );
    if (!touch) {
      settleViewDrag();
      return;
    }
    completeViewSwipe(
      touch.clientX - start.x,
      touch.clientY - start.y,
      Date.now() - start.timestamp
    );
  }

  function trackViewDrag(
    start: { direction: "pending" | "horizontal" | "vertical" },
    deltaX: number,
    deltaY: number
  ) {
    if (start.direction === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10) return false;
      start.direction = Math.abs(deltaX) > Math.abs(deltaY) * 1.1
        ? "horizontal"
        : "vertical";

      if (start.direction === "horizontal" && viewMode === "list") {
        rememberMobileScroll();
        setHasOpenedMap(true);
      }
    }

    if (start.direction !== "horizontal") return false;
    updateViewDragPosition(deltaX);
    return true;
  }

  function updateViewDragPosition(deltaX: number) {
    const page = homePageRef.current;
    if (!page) return;

    const viewportWidth = window.innerWidth;
    const maxViewIndex = openedEventId ? 2 : 1;
    const currentViewIndex = viewMode === "list" ? 0 : viewMode === "map" ? 1 : 2;
    const position = clamp(
      currentViewIndex * viewportWidth - deltaX,
      0,
      maxViewIndex * viewportWidth
    );
    page.style.setProperty("--mobile-list-drag-x", `${-position}px`);
    page.style.setProperty("--mobile-map-drag-x", `${viewportWidth - position}px`);
    page.style.setProperty("--mobile-event-drag-x", `${2 * viewportWidth - position}px`);
    page.classList.add("mobileViewDragging");
  }

  function completeViewSwipe(deltaX: number, deltaY: number, elapsed: number) {
    const isDeliberateHorizontalSwipe =
      Math.abs(deltaX) >= 72 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.25 &&
      elapsed <= 1200;

    const viewOrder: MobileView[] = openedEventId
      ? ["list", "map", "event"]
      : ["list", "map"];
    const currentIndex = viewOrder.indexOf(viewMode);
    const direction = deltaX < 0 ? 1 : -1;
    const nextMode = isDeliberateHorizontalSwipe
      ? viewOrder[clamp(currentIndex + direction, 0, viewOrder.length - 1)]
      : viewMode;

    if (nextMode !== viewMode) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 400);
      if (nextMode === "event" && openedEventId) openMobileEvent(openedEventId);
      else if (nextMode === "map") showMobileMap();
      else showMobileList();
    }

    settleViewDrag();
    return nextMode !== viewMode;
  }

  function settleViewDrag() {
    const page = homePageRef.current;
    if (!page || !page.classList.contains("mobileViewDragging")) return;

    if (dragSettleTimerRef.current !== null) {
      window.clearTimeout(dragSettleTimerRef.current);
    }

    page.classList.add("mobileViewSettling");
    window.requestAnimationFrame(() => {
      page.classList.remove("mobileViewDragging");
      page.style.removeProperty("--mobile-map-drag-x");
      page.style.removeProperty("--mobile-list-drag-x");
      page.style.removeProperty("--mobile-event-drag-x");
      dragSettleTimerRef.current = window.setTimeout(() => {
        page.classList.remove("mobileViewSettling");
        dragSettleTimerRef.current = null;
      }, 340);
    });
  }

  function handleClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <main
      ref={homePageRef}
      className={`homePage ${eventsError || (!filteredEvents.length && !featuredEvents.length) ? "discoveryNeedsResults" : ""} ${viewMode === "map" ? "mobileMapMode" : viewMode === "event" ? "mobileEventMode" : listDestination === "results" ? "mobileListMode mobileResultsMode" : "mobileListMode mobileDiscoverMode"}`}
      onPointerDownCapture={handlePointerStart}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerEnd}
      onPointerCancelCapture={() => {
        pointerStartRef.current = null;
        settleViewDrag();
      }}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={() => {
        touchStartRef.current = null;
        settleViewDrag();
      }}
      onClickCapture={handleClickCapture}
    >
      {(activeCategory || activeLocation || dateFilter !== "all") && (
        <nav className="breadcrumbs subpageBreadcrumbs" aria-label="Ścieżka powrotu">
          <Link href="/" aria-label="Strona główna">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px" }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </Link>
          {activeCategory && (
            <>
              <span className="separator">›</span>
              {activeLocation || dateFilter !== "all" ? (
                <Link href={`/${toPluralCategorySlug(toSlug(activeCategory))}`}>{toPluralCategoryName(activeCategory)}</Link>
              ) : (
                <span className="current">{toPluralCategoryName(activeCategory)}</span>
              )}
            </>
          )}
          {activeLocation && (
            <>
              <span className="separator">›</span>
              {dateFilter !== "all" ? (
                <Link href={activeCategory
                  ? buildCategoryLocationHref(toSlug(activeCategory), activeLocation)
                  : activeLocation.slug
                    ? `/${activeLocation.slug}`
                    : currentSearchUrl()
                }>
                  {activeLocationLabel}
                </Link>
              ) : (
                <span className="current">{activeLocationLabel}</span>
              )}
            </>
          )}
          {dateFilter !== "all" && (
            <>
              <span className="separator">›</span>
              <span className="current">
                {getDateFilterLabel(dateFilter)}
              </span>
            </>
          )}
        </nav>
      )}

      <HeroSection title={pageTitle} subtitle={pageSubtitle} />

      <SearchPanel
        query={queryInput}
        onQueryChange={changeQuery}
        onShowResults={showSearchResults}
        advancedRequest={advancedRequest}
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
        locationMode={locationMode}
        canSearchCity={isKnownCity(location)}
        hasLocationCenter={hasLocationCenter}
        onLocationModeChange={handleLocationModeChange}
        onRadiusChange={handleRadiusChange}
        onAllPolandSelect={handleAllPolandSelect}
        category={category}
        categories={categoryOptions}
        onCategoryChange={setCategory}
        priceMode={priceMode}
        maxPrice={maxPrice}
        onPriceModeChange={setPriceMode}
        onMaxPriceChange={(price) => setMaxPrice(clampMaxPrice(price))}
      />

      {/* Discovery and the map share the main workspace. */}
      <div className="mainLayout">
        <div className="mainColumn">

          <div className="discoveryShelves">
            <FeaturedEvents events={featuredEvents} onOpenEvent={openMobileEvent} onSeeAll={showResults} />

            {eventsLoading && featuredEvents.length === 0 ? (
              <div className="discoveryShelfSkeleton resultsSkeleton" aria-hidden="true">
                <div className="resultSkeletonCard"><span /></div>
              </div>
            ) : null}

            {!eventsLoading && discoverySections.map((section) => (
              <EventCarousel
                key={section.id}
                events={section.events}
                title={section.title}
                onOpenEvent={openMobileEvent}
                seeAllHref={section.href}
                onSeeAll={section.filters ? () => selectDiscovery(section) : undefined}
              />
            ))}
          </div>

          <section className="mainEvents" id="events-list" aria-label="Lista wydarzeń" aria-busy={eventsLoading || eventsLoadingMore}>
            <div className="mainEventsHeader">
              <h2>{listHeading}</h2>
              <div className="mainEventsSort">
                <span>Sortuj:</span>
                <select
                  value={effectiveSort}
                  onChange={(e) => setSortBy(e.target.value as "nearest" | "date")}
                  className="mainEventsSortSelect"
                  aria-label="Sortowanie wydarzeń"
                >
                  <option value="nearest" disabled={isAllPoland || !hasLocationCenter}>Wg odległości</option>
                  <option value="date">Wg daty</option>
                </select>
              </div>
            </div>
            <p className="mainEventsCount" role="status">
              {eventsLoading ? "Szukam wydarzeń dla Twoich filtrów…" : eventsError ? "Wyniki wymagają ponownego pobrania." : eventSearch.totalCount > 0
                ? `${formatNumber(eventSearch.totalCount)} wydarzeń · wyświetlono ${formatNumber(shownEventsCount)}`
                : "Brak wydarzeń dla wybranych filtrów."}
            </p>
            {eventsError ? (
              <div className="resultsFeedback" role="alert">
                <RotateCcw size={22} aria-hidden="true" />
                <div><strong>Spróbujmy jeszcze raz</strong><p>{eventsError}</p></div>
                <button type="button" className="resultsAction" onClick={() => void loadEventsPage(failedEventsPage, failedEventsPage > 1 ? "append" : "replace")}><RotateCcw size={16} aria-hidden="true" />Ponów</button>
              </div>
            ) : null}

            {eventsLoading ? (
              <div className="resultsSkeleton" aria-hidden="true">{[0, 1, 2].map((key) => <div className="resultSkeletonCard" key={key}><span /><div><i /><i /><i /></div></div>)}</div>
            ) : filteredEvents.length > 0 ? (
              <div className="eventsList">
                {venueGroups.map((group) => group.events.length > 1 ? (
                  <EventVenueDeck
                    key={group.key}
                    venue={group.venue}
                    events={group.events}
                    onOpenEvent={openMobileEvent}
                    onShowOnMap={showMobileMap}
                  />
                ) : group.events.map(({ event, distanceKm }) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    distanceKm={isAllPoland ? Number.POSITIVE_INFINITY : distanceKm}
                    onShowOnMap={showMobileMap}
                    onOpenEvent={openMobileEvent}
                  />
                )))}
                {canLoadMoreEvents && (
                  <button
                    type="button"
                    className="showMoreBtn"
                    disabled={eventsLoading || eventsLoadingMore}
                    onClick={() => void loadEventsPage(eventSearch.page + 1, "append")}
                  >
                    {eventsLoadingMore ? "Pobieram..." : "Pokaż więcej wydarzeń"}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                )}
              </div>
            ) : !eventsError ? (
              <div className="emptyState">
                <div className="emptySearchIcon"><Search size={28} aria-hidden="true" /></div>
                <h3>Jeszcze nie mamy takiego planu</h3>
                <p>Oferta zależy od miejsca i terminu. Zmień filtry lub sprawdź wydarzenia w całej Polsce.</p>
                <div className="emptyStateActions">
                  <button type="button" className="resultsAction" onClick={() => { setQueryInput(""); setSearchQuery(""); setCategory("Wszystkie"); setDateFilter("all"); setCustomDate(""); setPriceMode("all"); }}>Wyczyść filtry</button>
                  {!isAllPoland ? <button type="button" className="resultsAction resultsActionPrimary" onClick={handleAllPolandSelect}>Sprawdź całą Polskę<ArrowRight size={16} aria-hidden="true" /></button> : null}
                </div>
              </div>
            ) : null}
          </section>

          {/* City categories tiles grid and quick timing links — below events */}
          {!activeCategory && activeLocation && (
            <section className="cityCategoriesSec">
              <div className="citySecHeader">
                <h2>Kategorie wydarzeń {activeLocationPhrase}</h2>
                <p>Przeglądaj wydarzenia w wybranym klimacie</p>
              </div>
              <div className="cityTilesGrid">
                {categoryOptions.map((cat) => {
                  const catColor = cat.color || "var(--brand)";
                  return (
                    <Link
                      key={cat.id}
                      href={buildCategoryLocationHref(cat.slug, activeLocation)}
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
              
              {activeLocation.slug ? (
                <div className="cityQuickTimeLinks">
                  <Link href={`/${activeLocation.slug}/dzis`} className="cityTimeBtn">
                    📅 Wydarzenia dzisiaj {activeLocationPhrase}
                  </Link>
                  <Link href={`/${activeLocation.slug}/weekend`} className="cityTimeBtn">
                    🎉 Wydarzenia w weekend {activeLocationPhrase}
                  </Link>
                </div>
              ) : null}
            </section>
          )}

          {/* Popular Cities linking cloud (for Category Page) */}
          {activeCategory && !activeLocation && (
            <section className="internalLinksSec">
              <h3>Popularne miasta dla kategorii {toPluralCategoryName(activeCategory)}</h3>
              <div className="internalLinksGrid">
                {POPULAR_CITIES.map((city) => (
                  <Link
                    key={city.slug}
                    href={buildCategoryLocationHref(toSlug(activeCategory), locationBySlug.get(city.slug) ?? {
                      label: city.label,
                      aliases: [city.slug],
                      slug: city.slug,
                      latitude: null,
                      longitude: null
                    })}
                    className="internalLinkCard"
                  >
                    <span>{toPluralCategoryName(activeCategory)} {city.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Other Categories linking cloud (for Category + City Page) */}
          {activeCategory && activeLocation && (
            <section className="internalLinksSec">
              <h3>Inne wydarzenia {activeLocationPhrase}</h3>
              <div className="internalLinksGrid">
                {categoryOptions
                  .filter((cat) => cat.name !== toPluralCategoryName(activeCategory))
                  .map((cat) => (
                    <Link
                      key={cat.id}
                      href={buildCategoryLocationHref(cat.slug, activeLocation)}
                      className="internalLinkCard"
                    >
                      <span>{cat.name} {activeLocationPhrase}</span>
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
          mapEvents={mapEvents ?? EMPTY_MAP_MARKERS}
          upcomingEvents={eventsLoading ? [] : visibleEvents
            .map(({ event }) => event)
            .sort((first, second) => Date.parse(first.startDate) - Date.parse(second.startDate))
            .slice(0, 3)}
          onRequestMap={requestSidebarMap}
          selectedEventId={selectedEventId ?? undefined}
          focusedEventId={focusedMapEventId}
          onSelectEvent={selectMapEvent}
          onShowResults={showResults}
          onOpenEvent={openMobileEvent}
          selectedEvent={selectedMapEvent}
          selectedEventLoading={selectedMapEventLoading}
          onClearSelection={clearMapSelection}
          location={location}
          isAllPoland={isAllPoland}
          markersLoading={markersLoading}
          markersError={markersError}
          onRetryMarkers={() => void loadMapMarkers()}
        />
      </div>

      <ValueProps />

      {hasOpenedMap ? (
        <MobileMapView
          query={queryInput}
          onQueryChange={changeQuery}
          onShowFilters={showMapFilters}
          onUseGPS={handleUseGPS}
          locationStatus={locationStatus}
          active={viewMode === "map"}
          parked={viewMode === "event"}
          events={mapEvents ?? EMPTY_MAP_MARKERS}
          markersLoading={markersLoading}
          markersError={markersError}
          onRetryMarkers={() => void loadMapMarkers()}
          selectedEvent={selectedMapEvent}
          selectedEventLoading={selectedMapEventLoading}
          selectedEventId={selectedEventId}
          focusedEventId={focusedMapEventId}
          location={isAllPoland ? undefined : location}
          onSelectEvent={selectMapEvent}
          onClearSelection={clearMapSelection}
          onShowList={showMobileList}
          onOpenEvent={openMobileEvent}
        />
      ) : null}

      {openedEvent ? (
        <section
          ref={mobileEventViewRef}
          id="mobile-event-view"
          className={`mobileEventView ${viewMode === "event" ? "mobileEventViewActive" : ""}`}
          aria-label={`Wydarzenie: ${openedEvent.title}`}
          aria-hidden={viewMode !== "event"}
          inert={viewMode !== "event"}
          tabIndex={-1}
        >
          <EventDetailView
            key={openedEvent.id}
            event={openedEvent}
            relatedEvents={openedEventRelated}
            embedded
            onClose={closeMobileEvent}
            onOpenEvent={openMobileEvent}
          />
        </section>
      ) : null}

      <nav className="mobileViewSwitcher" aria-label="Nawigacja mobilna">
        <button
          type="button"
          onClick={() => showMobileList("discover")}
          aria-pressed={viewMode === "list" && listDestination === "discover"}
        >
          <Compass size={20} strokeWidth={2.2} aria-hidden="true" />
          Odkryj
        </button>
        <button
          type="button"
          onClick={() => showMobileList("results")}
          aria-pressed={viewMode === "list" && listDestination === "results"}
        >
          <ListIcon size={20} strokeWidth={2.2} aria-hidden="true" />
          Lista
        </button>
        <button
          type="button"
          onClick={() => showMobileMap()}
          aria-pressed={viewMode === "map"}
        >
          <MapIcon size={20} strokeWidth={2.2} aria-hidden="true" />
          Mapa
        </button>
        <Link href="/account" onClick={() => {
          rememberMobileScroll();
          try {
            window.sessionStorage.setItem(WORKSPACE_RETURN_STORAGE_KEY, JSON.stringify({ url: currentSearchUrl(), scroll: listScrollPositionRef.current }));
          } catch { /* Session storage is optional. */ }
          const state = window.history.state;
          if (state?.eventMapWorkspace) {
            window.history.replaceState({ ...state, eventMapWorkspace: { ...state.eventMapWorkspace, scroll: { ...listScrollPositionRef.current } } }, "");
          }
        }}>
          <UserRound size={20} strokeWidth={2.2} aria-hidden="true" />
          Profil
        </Link>
      </nav>

      <span className="srOnly" aria-live="polite">
        {viewMode === "map"
          ? "Widok mapy"
          : viewMode === "event"
            ? `Widok wydarzenia: ${openedEvent?.title ?? ""}`
            : listDestination === "results" ? "Widok listy" : "Widok odkrywania"}
      </span>
    </main>
  );
}

function shouldIgnoreViewSwipe(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("button, input, select, textarea, dialog, [role='button'], .eventCarousel, .eventVenueDeck, .discoveryQuickCategories, .mobileMapPreview, .maplibregl-control-container")
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampRadius(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(Math.round(value), 5), MAX_RADIUS_FILTER_LIMIT);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pl-PL").format(value);
}

function getPublicLocationLabel(label: string) {
  return label.replace(/\s+\(woj\.[^)]+\)$/i, "").trim();
}

function getLocationPhrase(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "moja lokalizacja") return "w Twojej okolicy";
  if (normalized === "wybrana lokalizacja") return "w wybranej okolicy";
  return formatInCity(label);
}

function getDateFilterLabel(filter: DateFilter) {
  if (filter === "today") return "Dzisiaj";
  if (filter === "tomorrow") return "Jutro";
  if (filter === "weekend") return "Weekend";
  if (filter === "week") return "Ten tydzień";
  if (filter === "custom") return "Wybrany termin";
  return "Wszystkie terminy";
}

function scrollToResults() {
  document.getElementById("events-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
