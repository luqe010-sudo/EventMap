"use client";

import Link from "next/link";
import { List as ListIcon, Map as MapIcon, CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CategoryCityRoute, type CategoryOption, type EventCategory, type EventItem, type KnownLocation, type PublicEventSearchResult, getDefaultLocation, knownLocations } from "@/lib/events";
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
import MobileMapView from "@/components/MobileMapView";
import EventDetailView from "@/components/EventDetailView";
import FeaturedEvents from "@/components/FeaturedEvents";
import EventCard from "@/components/EventCard";
import Sidebar from "@/components/Sidebar";
import ValueProps from "@/components/ValueProps";
import { toSlug, toPluralCategoryName, toPluralCategorySlug, formatInCity, buildSearchUrl, eventPath } from "@/lib/slugs";
import { generateSeoText } from "@/lib/seo-texts";

type HomePageProps = {
  initialEvents: EventItem[];
  initialEventSearch?: PublicEventSearchResult;
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

type MobileView = "list" | "map" | "event";

type MobileWorkspaceHistory = {
  view: MobileView;
  eventId?: string;
  workspaceUrl: string;
};

export default function HomePage({
  initialEvents,
  initialEventSearch,
  categoryOptions,
  initialLocation,
  initialCategory,
  initialDateFilter,
  initialFilters,
  activeCityLocations = [],
  availableCategoryCityRoutes
}: HomePageProps) {
  const [viewMode, setViewMode] = useState<MobileView>("list");
  const [hasOpenedMap, setHasOpenedMap] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState(initialEvents);
  const [eventSearch, setEventSearch] = useState<PublicEventSearchResult>(
    initialEventSearch ?? {
      events: initialEvents,
      totalCount: initialEvents.length,
      page: 1,
      pageSize: EVENTS_PAGE_SIZE,
      maxResults: 300,
      shownCount: initialEvents.length,
      hasMore: false
    }
  );
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const homePageRef = useRef<HTMLElement | null>(null);
  const mobileEventViewRef = useRef<HTMLElement | null>(null);
  const listScrollPositionRef = useRef(0);
  const workspaceUrlRef = useRef("");
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
  const hasSkippedInitialSearchRef = useRef(false);

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
  const activeCategory = category === "Wszystkie" ? undefined : category;
  const activeLocation = isAllPoland ? undefined : location;
  const activeLocationLabel = activeLocation
    ? getPublicLocationLabel(activeLocation.label)
    : undefined;
  const activeLocationPhrase = activeLocation
    ? getLocationPhrase(activeLocationLabel ?? activeLocation.label)
    : undefined;

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
      return `Sprawdź najbliższe ${nameLower}, festiwale muzyczne i występy na żywo.`;
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
      return `Nadchodzące ${toPluralCategoryName(activeCategory).toLowerCase()} w Polsce`;
    }
    if (activeLocationPhrase) {
      return `Nadchodzące wydarzenia ${activeLocationPhrase}`;
    }
    return "Wydarzenia w Twojej okolicy";
  }, [activeCategory, activeLocationPhrase]);

  const seoTextHtml = useMemo(() => {
    const seoLocation = activeLocation?.slug ? activeLocationLabel : undefined;
    return generateSeoText(activeCategory, seoLocation);
  }, [activeCategory, activeLocation, activeLocationLabel]);

  // Filtered events
  const filteredEvents = useMemo(
    () => {
      let results = filterEvents(events, {
        dateFilter,
        customDate,
        radiusKm: isAllPoland || location.slug ? null : radiusKm,
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
    [events, dateFilter, customDate, radiusKm, isAllPoland, category, location, priceMode, maxPrice, sortBy]
  );

  // Featured events
  const featuredEvents = useMemo(
    () => filterEvents(events, {
      dateFilter: "all",
      customDate: "",
      radiusKm: null,
      category: "Wszystkie",
      location,
      priceMode: "all"
    }).filter(({ event }) => event.isFeatured),
    [events, location]
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

  const visibleEvents = filteredEvents;
  const shownEventsCount = Math.min(eventSearch.shownCount, eventSearch.maxResults);
  const cappedTotalCount = Math.min(eventSearch.totalCount, eventSearch.maxResults);
  const canLoadMoreEvents = !eventsLoading && eventSearch.hasMore && shownEventsCount < eventSearch.maxResults;
  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const openedEvent = openedEventId
    ? eventById.get(openedEventId) ?? null
    : null;

  const openedEventRelated = useMemo(() => {
    if (!openedEvent) return [];
    return events
      .filter((e) => e.id !== openedEvent.id && e.category === openedEvent.category)
      .slice(0, 3);
  }, [events, openedEvent]);

  useEffect(() => {
    if (
      selectedEventId &&
      !filteredEvents.some(({ event }) => event.id === selectedEventId)
    ) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);

  useEffect(() => {
    if (openedEventId && !eventById.has(openedEventId)) {
      setOpenedEventId(null);
      if (viewMode === "event") setViewMode("list");
    }
  }, [eventById, openedEventId, viewMode]);

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

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      const historyState = (event.state as {
        eventMapWorkspace?: MobileWorkspaceHistory;
      } | null)?.eventMapWorkspace;

      if (!historyState) {
        setViewMode("list");
        return;
      }

      workspaceUrlRef.current = historyState.workspaceUrl;
      if (historyState.view === "event" && historyState.eventId) {
        if (eventById.has(historyState.eventId)) {
          setSelectedEventId(historyState.eventId);
          setOpenedEventId(historyState.eventId);
          setViewMode("event");
          return;
        }
      }

      const restoredEventId = historyState.eventId && eventById.has(historyState.eventId)
        ? historyState.eventId
        : null;
      setOpenedEventId(restoredEventId);
      if (restoredEventId) setSelectedEventId(restoredEventId);

      if (historyState.view === "map") {
        setHasOpenedMap(true);
        setViewMode("map");
        return;
      }

      setViewMode("list");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [eventById]);

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

  const currentEventsApiParams = useCallback((page: number) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(EVENTS_PAGE_SIZE)
    });

    if (category !== "Wszystkie") {
      params.set("categorySlug", toPluralCategorySlug(toSlug(category)));
    }

    if (!isAllPoland && isKnownCity(location)) {
      params.set("citySlug", location.slug ?? toSlug(location.label));
    } else if (!isAllPoland && location.label !== "Polska") {
      params.set("lat", String(Math.round(location.latitude * 1000) / 1000));
      params.set("lng", String(Math.round(location.longitude * 1000) / 1000));
      params.set("radius", String(radiusKm));
    }

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
  }, [category, customDate, dateFilter, isAllPoland, isKnownCity, location, maxPrice, priceMode, radiusKm]);

  const eventsSearchKey = useMemo(
    () => currentEventsApiParams(1).toString(),
    [currentEventsApiParams]
  );

  const loadEventsPage = useCallback(async (page: number, mode: "replace" | "append") => {
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setEventsError(null);
    if (mode === "append") setEventsLoadingMore(true);
    else setEventsLoading(true);

    try {
      const response = await fetch(`/api/events/search?${currentEventsApiParams(page).toString()}`, {
        cache: "no-store"
      });
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
      console.error("[home] Failed to load filtered events", error);
      if (searchRequestRef.current === requestId) {
        setEventsError("Nie udało się pobrać wydarzeń dla aktualnych filtrów.");
      }
    } finally {
      if (searchRequestRef.current === requestId) {
        setEventsLoading(false);
        setEventsLoadingMore(false);
      }
    }
  }, [currentEventsApiParams]);

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
          workspaceUrl: url
        } satisfies MobileWorkspaceHistory
      },
      "",
      url
    );
  }, [currentSearchUrl, openedEventId, viewMode]);

  useEffect(() => {
    if (!hasSkippedInitialSearchRef.current) {
      hasSkippedInitialSearchRef.current = true;
      return;
    }

    void loadEventsPage(1, "replace");
  }, [eventsSearchKey, loadEventsPage]);

  const handleFindSubmit = useCallback(() => {
    const url = currentSearchUrl();
    workspaceUrlRef.current = url;
    window.history.pushState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view: "list",
          eventId: openedEventId ?? undefined,
          workspaceUrl: url
        } satisfies MobileWorkspaceHistory
      },
      "",
      url
    );
    setViewMode("list");
    document.getElementById("events-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentSearchUrl, openedEventId]);

  const pushWorkspaceHistory = useCallback((view: "list" | "map") => {
    const workspaceUrl = workspaceUrlRef.current || currentSearchUrl();
    window.history.pushState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view,
          eventId: openedEventId ?? undefined,
          workspaceUrl
        } satisfies MobileWorkspaceHistory
      },
      "",
      workspaceUrl
    );
  }, [currentSearchUrl, openedEventId]);

  const showMobileMap = useCallback((eventId?: string) => {
    listScrollPositionRef.current = window.scrollY;
    if (eventId) setSelectedEventId(eventId);
    if (viewMode === "event") pushWorkspaceHistory("map");
    setHasOpenedMap(true);
    window.requestAnimationFrame(() => setViewMode("map"));
  }, [pushWorkspaceHistory, viewMode]);

  const showMobileList = useCallback(() => {
    if (viewMode === "event") pushWorkspaceHistory("list");
    setViewMode("list");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: listScrollPositionRef.current, behavior: "auto" });
    });
  }, [pushWorkspaceHistory, viewMode]);

  const openMobileEvent = useCallback((eventId: string) => {
    const event = eventById.get(eventId);
    if (!event) return;

    const workspaceUrl = workspaceUrlRef.current || currentSearchUrl();
    workspaceUrlRef.current = workspaceUrl;
    setSelectedEventId(eventId);
    setOpenedEventId(eventId);
    setHasOpenedMap(true);
    setViewMode("event");
    window.history.pushState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view: "event",
          eventId,
          workspaceUrl
        } satisfies MobileWorkspaceHistory
      },
      "",
      eventPath(event)
    );
  }, [currentSearchUrl, eventById]);

  const showOpenedEvent = useCallback(() => {
    if (!openedEvent) return;
    openMobileEvent(openedEvent.id);
  }, [openMobileEvent, openedEvent]);

  const closeMobileEvent = useCallback(() => {
    const workspaceUrl = workspaceUrlRef.current || currentSearchUrl();
    window.history.replaceState(
      {
        ...window.history.state,
        eventMapWorkspace: {
          view: "map",
          workspaceUrl
        } satisfies MobileWorkspaceHistory
      },
      "",
      workspaceUrl
    );
    setOpenedEventId(null);
    setHasOpenedMap(true);
    setViewMode("map");
  }, [currentSearchUrl]);

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
        listScrollPositionRef.current = window.scrollY;
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
    const indicatorStart = openedEventId ? viewportWidth / 6 : viewportWidth / 4;
    const indicatorStep = openedEventId ? viewportWidth / 3 : viewportWidth / 2;
    const indicatorLeft = indicatorStart - 36 + (position / viewportWidth) * indicatorStep;

    page.style.setProperty("--mobile-list-drag-x", `${-position}px`);
    page.style.setProperty("--mobile-map-drag-x", `${viewportWidth - position}px`);
    page.style.setProperty("--mobile-event-drag-x", `${2 * viewportWidth - position}px`);
    page.style.setProperty("--mobile-indicator-drag-left", `${indicatorLeft}px`);
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
      page.style.removeProperty("--mobile-indicator-drag-left");
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
      className={`homePage ${viewMode === "map" ? "mobileMapMode" : viewMode === "event" ? "mobileEventMode" : "mobileListMode"}`}
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
            onOpenEvent={openMobileEvent}
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
            <p className="mainEventsCount">
              {eventSearch.totalCount > 0
                ? `Znaleziono ${formatNumber(eventSearch.totalCount)} wydarzeń, pokazujemy ${formatNumber(shownEventsCount)} z maksymalnie ${formatNumber(cappedTotalCount)} najbliższych.`
                : "Nie znaleziono wydarzeń dla aktualnych filtrów."}
              {eventsLoading ? " Odświeżam wyniki..." : ""}
            </p>
            {eventsError ? <p className="mainEventsError">{eventsError}</p> : null}

            {filteredEvents.length > 0 ? (
              <div className="eventsList">
                {visibleEvents.map(({ event, distanceKm }) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    distanceKm={distanceKm}
                    onShowOnMap={showMobileMap}
                    onOpenEvent={openMobileEvent}
                  />
                ))}
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
            ) : (
              <div className="emptyState">
                <div className="emptyIcon">🔍</div>
                <h3>Tu chwilowo cisza.</h3>
                <p>Zwiększ promień, zmień datę albo wybierz inną kategorię.</p>
              </div>
            )}
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
                      latitude: getDefaultLocation().latitude,
                      longitude: getDefaultLocation().longitude
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
          events={filteredEvents}
          categoryCounts={categoryCounts}
          onCategorySelect={setCategory}
          selectedCategory={category}
          location={location}
          isAllPoland={isAllPoland}
        />
      </div>

      <ValueProps />

      {hasOpenedMap ? (
        <MobileMapView
          active={viewMode === "map"}
          parked={viewMode === "event"}
          events={filteredEvents.map(({ event }) => event)}
          selectedEventId={selectedEventId}
          location={isAllPoland ? undefined : location}
          onSelectEvent={setSelectedEventId}
          onClearSelection={() => setSelectedEventId(null)}
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

      <div className={`mobileViewSwitcher ${openedEventId ? "mobileViewSwitcherWithEvent" : ""}`} role="group" aria-label="Widok wyników">
        <span
          className={`mobileViewSwitcherIndicator ${
            openedEventId
              ? viewMode === "map"
                ? "mobileViewSwitcherIndicatorMap"
                : viewMode === "event"
                ? "mobileViewSwitcherIndicatorEvent"
                : ""
              : viewMode === "map"
              ? "mobileViewSwitcherIndicatorMap"
              : ""
          }`}
          aria-hidden="true"
        />
        <button
          type="button"
          className={viewMode === "list" ? "active" : ""}
          onClick={showMobileList}
          aria-pressed={viewMode === "list"}
        >
          <ListIcon size={18} strokeWidth={2.3} aria-hidden="true" />
          Lista
        </button>
        <button
          type="button"
          className={viewMode === "map" ? "active" : ""}
          onClick={() => showMobileMap()}
          aria-pressed={viewMode === "map"}
        >
          <MapIcon size={18} strokeWidth={2.3} aria-hidden="true" />
          Mapa
        </button>
        {openedEventId ? (
          <button
            type="button"
            className={viewMode === "event" ? "active" : ""}
            onClick={showOpenedEvent}
            aria-pressed={viewMode === "event"}
          >
            <CalendarDays size={18} strokeWidth={2.3} aria-hidden="true" />
            Wydarzenie
          </button>
        ) : null}
      </div>

      <span className="srOnly" aria-live="polite">
        {viewMode === "map"
          ? "Widok mapy"
          : viewMode === "event"
            ? `Widok wydarzenia: ${openedEvent?.title ?? ""}`
            : "Widok listy"}
      </span>
    </main>
  );
}

function shouldIgnoreViewSwipe(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("button, input, select, textarea, [role='button'], .mobileMapPreview, .maplibregl-control-container")
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampRadius(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(Math.round(value), 5), 100);
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
