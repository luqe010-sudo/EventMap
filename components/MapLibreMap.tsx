"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import type { MutableRefObject } from "react";
import type { EventItem, EventMapMarker, KnownLocation } from "@/lib/events";
import { hasLocationCoordinates } from "@/lib/event-search";
import { eventPath } from "@/lib/slugs";
import { formatPolishDate } from "@/lib/date-format";
import { getEventCoverPhoto } from "@/lib/event-cover-media";
import { getMapSpiderLayout } from "@/lib/map-spider-layout";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

type MapLibreMapProps = {
  events: MapEvent[];
  selectedEventId?: string;
  focusedEventId?: string;
  location?: KnownLocation;
  onSelectEvent: (eventId: string) => void;
  showEventPopup?: boolean;
  isVisible?: boolean;
  detailMode?: boolean;
};

type EventFeatureProperties = {
  id: string;
  title: string;
  address: string;
  category: string;
  categorySlug: string;
  color: string;
  icon: string;
  description?: string;
  imageUrl?: string;
  startDate?: string;
  city?: string;
  url?: string;
};

type MapEvent = EventMapMarker | EventItem;
type EventFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, EventFeatureProperties>;
type CategoryLayers = {
  source: string;
  glow: string;
  cluster: string;
  clusterIcon: string;
  pin: string;
  icon: string;
};
type PinLayers = Pick<CategoryLayers, "source" | "pin" | "icon">;
type SpiderPage = { groupId: string; page: number; pageCount: number; first: number; last: number; total: number };
type MapSpider = {
  setEvents: (events: EventFeatureCollection) => void;
  showPage: (groupId: string, page: number) => void;
  contains: (eventId: string) => boolean;
  dispose: () => void;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const EVENT_SOURCE_ID = "eventmap-events";
const VOIVODESHIP_SOURCE_ID = "eventmap-voivodeships";
const LOCATION_MARKER_CLASS = "locationMarker";
const NO_SELECTED_EVENT_ID = "__none__";
const EVENT_CLUSTER_MAX_ZOOM = 11;
const EVENT_CLUSTER_RADIUS = 34;
const SPIDER_MIN_ZOOM = EVENT_CLUSTER_MAX_ZOOM + 1;
const SPIDER_REFRESH_INTERVAL = 80;
const SPIDER_LAYERS: PinLayers = {
  source: "eventmap-spider", pin: "eventmap-spider-pin", icon: "eventmap-spider-icon"
};
const SPIDER_LINES = "eventmap-spider-lines";
const EMPTY_SPIDER_DATA: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const EMPTY_EVENT_FEATURES: EventFeatureCollection = { type: "FeatureCollection", features: [] };
const EVENT_CATEGORY_COLOR: ExpressionSpecification = ["to-color", ["get", "color"], "#ef3f18"];
const EVENT_ICON_LAYOUT = {
  "icon-image": ["get", "icon"] as ExpressionSpecification,
  "icon-size": 0.61,
  "icon-allow-overlap": true,
  "icon-ignore-placement": true
};
const CLUSTER_DOT_RADIUS: ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "point_count"],
  2, 16, 10, 18, 30, 21, 80, 24, 200, 27, 1000, 30, 10000, 33
];
const CLUSTER_SORT_KEY: ExpressionSpecification = ["-", 0, ["get", "point_count"]];
const POLAND_CENTER: [number, number] = [19.1451, 51.9194];
const POLAND_BOUNDS: [[number, number], [number, number]] = [
  [14.07, 49.0],
  [24.15, 54.84]
];

const MAP_LOCALE = {
  "NavigationControl.ZoomIn": "Powiększ",
  "NavigationControl.ZoomOut": "Pomniejsz",
  "NavigationControl.ResetBearing": "Resetuj obrót",
  "AttributionControl.ToggleAttribution": "Pokaż atrybucję"
};



export default function MapLibreMap({
  events,
  selectedEventId,
  focusedEventId,
  location,
  onSelectEvent,
  showEventPopup = true,
  detailMode = false,
  isVisible = true
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const categoryLayersRef = useRef(new Map<string, CategoryLayers>());
  const spiderRef = useRef<MapSpider | null>(null);
  const onSelectEventRef = useRef(onSelectEvent);
  const showEventPopupRef = useRef(showEventPopup);
  const selectedEventIdRef = useRef(selectedEventId);
  const initialMapViewRef = useRef({
    center: hasLocationCoordinates(location) ? [location.longitude, location.latitude] as [number, number] : POLAND_CENTER,
    zoom: location ? 6 : 4.8,
    scrollZoom: !detailMode
  });
  const [mapReady, setMapReady] = useState(false);
  const [spiderPage, setSpiderPage] = useState<SpiderPage | null>(null);
  const eventFeatures = useMemo(() => buildEventFeatureCollection(events), [events]);

  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  useEffect(() => {
    showEventPopupRef.current = showEventPopup;
  }, [showEventPopup]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      ...initialMapViewRef.current,
      attributionControl: false,
      locale: MAP_LOCALE
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    const categoryLayers = categoryLayersRef.current;

    map.on("load", () => {
      applyPolishLabels(map);
      addAdministrativeBoundaryLayers(map);
      addHouseNumberLayer(map);
      spiderRef.current = bindEventLayerInteractions(
        map, categoryLayers, onSelectEventRef, showEventPopupRef, selectedEventIdRef, setSpiderPage
      );
      setMapReady(true);
    });

    return () => {
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
      categoryLayers.clear();
      spiderRef.current?.dispose();
      spiderRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const controller = new AbortController();
    spiderRef.current?.setEvents(EMPTY_EVENT_FEATURES);
    void addCategoryImages(map, eventFeatures, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      syncEventSources(map, eventFeatures, categoryLayersRef.current, selectedEventIdRef.current);
      spiderRef.current?.setEvents(eventFeatures);
    });
    return () => controller.abort();
  }, [eventFeatures, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    updateLocationMarker(map, location, locationMarkerRef);
    if (detailMode && hasLocationCoordinates(location)) {
      map.jumpTo({ center: [location.longitude, location.latitude], zoom: 14 });
    } else fitMapToPoints(map, location, events);
  }, [detailMode, events, location, mapReady]);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateSelectedPaint(map, categoryLayersRef.current, selectedEventId);
  }, [mapReady, selectedEventId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusedEventId || spiderRef.current?.contains(focusedEventId)) return;
    focusMapOnEvent(map, eventFeatures, focusedEventId);
  }, [eventFeatures, focusedEventId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !isVisible) return;

    const frameId = window.requestAnimationFrame(() => map.resize());
    return () => window.cancelAnimationFrame(frameId);
  }, [isVisible, mapReady]);

  return (
    <div ref={containerRef} className="mapLibreCanvas">
      {spiderPage && (
        <div className="mapSpiderControls" role="group" aria-label="Rozsunięte pinezki">
          <button
            type="button"
            aria-label="Poprzednie pinezki"
            disabled={spiderPage.page === 0}
            onClick={() => spiderRef.current?.showPage(spiderPage.groupId, spiderPage.page - 1)}
          >
            <LucideIcons.ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span aria-live="polite">{spiderPage.first}–{spiderPage.last} z {spiderPage.total}</span>
          <button
            type="button"
            aria-label="Następne pinezki"
            disabled={spiderPage.page + 1 === spiderPage.pageCount}
            onClick={() => spiderRef.current?.showPage(spiderPage.groupId, spiderPage.page + 1)}
          >
            <LucideIcons.ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function eventLayerIds(source: string): CategoryLayers {
  return {
    source,
    glow: `${source}-glow`,
    cluster: `${source}-cluster`,
    clusterIcon: `${source}-cluster-icon`,
    pin: `${source}-pin`,
    icon: `${source}-pin-icon`
  };
}

function syncEventSources(
  map: maplibregl.Map,
  data: EventFeatureCollection,
  categoryLayers: Map<string, CategoryLayers>,
  selectedEventId?: string
) {
  const categoryData = new Map<string, EventFeatureCollection>();
  for (const feature of data.features) {
    const sourceId = `${EVENT_SOURCE_ID}-${feature.properties.categorySlug}`;
    const existing = categoryData.get(sourceId);
    if (existing) existing.features.push(feature);
    else categoryData.set(sourceId, { type: "FeatureCollection", features: [feature] });
  }

  for (const [sourceId, layers] of categoryLayers) {
    if (categoryData.has(sourceId)) continue;
    for (const layerId of [layers.glow, layers.cluster, layers.clusterIcon, layers.pin, layers.icon]) {
      map.removeLayer(layerId);
    }
    map.removeSource(sourceId);
    categoryLayers.delete(sourceId);
  }

  const orderedSources = [...categoryData].sort(([first], [second]) => first.localeCompare(second));
  for (const [index, [sourceId, features]] of orderedSources.entries()) {
    const offset = categoryClusterOffset(index, orderedSources.length);
    const layers = eventLayerIds(sourceId);
    const source = map.getSource<maplibregl.GeoJSONSource>(sourceId);
    if (source) {
      source.setData(features);
      for (const layer of [layers.glow, layers.cluster]) {
        map.setPaintProperty(layer, "circle-translate", offset);
      }
      map.setPaintProperty(layers.clusterIcon, "icon-translate", offset);
    } else {
      addCategoryLayers(map, layers, features, offset, categoryLayers.values().next().value);
    }
    categoryLayers.set(sourceId, layers);
  }
  updateSelectedPaint(map, categoryLayers, selectedEventId);
}

function categoryClusterOffset(index: number, count: number): [number, number] {
  // Keep clusters from different categories visible when they share a venue.
  if (count < 2) return [0, 0];
  const angle = index * 2 * Math.PI / count;
  const radius = Math.min(32, Math.max(20, count * 2.8));
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function addCategoryLayers(
  map: maplibregl.Map,
  layers: CategoryLayers,
  data: EventFeatureCollection,
  offset: [number, number],
  firstCategoryLayers?: CategoryLayers
) {
  const visibleZoom = { maxzoom: SPIDER_MIN_ZOOM };
  map.addSource(layers.source, {
    type: "geojson",
    data,
    cluster: true,
    clusterMaxZoom: EVENT_CLUSTER_MAX_ZOOM,
    clusterRadius: EVENT_CLUSTER_RADIUS,
    clusterProperties: {
      color: [["accumulated"], ["get", "color"]],
      icon: [["accumulated"], ["get", "icon"]]
    }
  });

  const clusterPaint = {
    "circle-color": EVENT_CATEGORY_COLOR,
    "circle-translate": offset,
    "circle-translate-anchor": "viewport" as const
  };
  map.addLayer({
    id: layers.glow,
    ...visibleZoom,
    type: "circle",
    source: layers.source,
    filter: ["has", "point_count"],
    paint: {
      ...clusterPaint,
      "circle-radius": ["+", CLUSTER_DOT_RADIUS, 7],
      "circle-blur": 0.55,
      "circle-opacity": 0.36
    }
  }, firstCategoryLayers?.cluster);

  map.addLayer({
    id: layers.cluster,
    ...visibleZoom,
    type: "circle",
    source: layers.source,
    filter: ["has", "point_count"],
    layout: { "circle-sort-key": CLUSTER_SORT_KEY },
    paint: {
      ...clusterPaint,
      "circle-radius": CLUSTER_DOT_RADIUS,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.8,
      "circle-stroke-opacity": 0.76,
      "circle-opacity": 0.74
    }
  }, firstCategoryLayers?.pin);

  map.addLayer({
    id: layers.clusterIcon,
    ...visibleZoom,
    type: "symbol",
    source: layers.source,
    filter: ["has", "point_count"],
    layout: { ...EVENT_ICON_LAYOUT, "symbol-sort-key": CLUSTER_SORT_KEY },
    paint: {
      "icon-translate": offset,
      "icon-translate-anchor": "viewport",
      "icon-opacity": 0.84
    }
  }, firstCategoryLayers?.pin);

  addEventPinLayers(map, layers, ["!", ["has", "point_count"]], visibleZoom, firstCategoryLayers?.icon);
}

function addEventPinLayers(
  map: maplibregl.Map,
  layers: PinLayers,
  filter: FilterSpecification,
  visibleZoom: { minzoom?: number; maxzoom?: number } = {},
  beforePin?: string
) {
  map.addLayer({
    id: layers.pin,
    ...visibleZoom,
    type: "circle",
    source: layers.source,
    filter,
    paint: {
      "circle-color": EVENT_CATEGORY_COLOR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 0.76
    }
  }, beforePin);

  map.addLayer({
    id: layers.icon,
    ...visibleZoom,
    type: "symbol",
    source: layers.source,
    filter,
    layout: EVENT_ICON_LAYOUT
  });
}

function bindEventLayerInteractions(
  map: maplibregl.Map,
  categoryLayers: Map<string, CategoryLayers>,
  onSelectEventRef: MutableRefObject<(eventId: string) => void>,
  showEventPopupRef: MutableRefObject<boolean>,
  selectedEventIdRef: MutableRefObject<string | undefined>,
  setSpiderPage: (page: SpiderPage | null) => void
): MapSpider {
  const spiderSource = addSpiderLayers(map);
  updatePinSelectedPaint(map, SPIDER_LAYERS, selectedEventIdRef.current);
  let events = EMPTY_EVENT_FEATURES;
  let layoutVisible = false;
  let layoutFrame: number | undefined;
  let lastRefresh = 0;
  let clickVersion = 0;
  let activeGroupId: string | undefined;
  let pagerKey = "";
  let spiderPopup: maplibregl.Popup | undefined;
  let groups: ReturnType<typeof getMapSpiderLayout>["groups"] = [];
  const groupPages = new Map<string, number>();
  const eventGroups = new Map<string, string>();

  function closeSpiderPopup() {
    spiderPopup?.remove();
    spiderPopup = undefined;
  }

  function updatePager() {
    const group = groups.find(item => item.id === activeGroupId && item.pageCount > 1)
      ?? groups.find(item => item.pageCount > 1);
    const key = group ? JSON.stringify(group) : "";
    if (key === pagerKey) return;
    pagerKey = key;
    setSpiderPage(group ? {
      groupId: group.id,
      page: group.page,
      pageCount: group.pageCount,
      first: group.page * group.pageSize + 1,
      last: Math.min((group.page + 1) * group.pageSize, group.total),
      total: group.total
    } : null);
  }

  function refreshLayout() {
    lastRefresh = performance.now();
    if (layoutFrame !== undefined) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = undefined;
    eventGroups.clear();
    if (map.getZoom() < SPIDER_MIN_ZOOM || !events.features.length) {
      if (layoutVisible) spiderSource.setData(EMPTY_SPIDER_DATA);
      layoutVisible = false;
      groups = [];
      updatePager();
      return;
    }

    const canvas = map.getCanvas();
    const bottomInset = map.getContainer().closest(".mobileMapView") ? Math.min(64, canvas.clientHeight / 5) : 0;
    const bounds = map.getBounds();
    const visibleEvents = new Map<string, EventFeatureCollection["features"][number]>();
    const points: Array<{ id: string; x: number; y: number }> = [];
    for (const feature of events.features) {
      const coordinates = feature.geometry.coordinates as [number, number];
      if (!bounds.contains(coordinates)) continue;
      const point = map.project(coordinates);
      const id = feature.properties.id;
      visibleEvents.set(id, feature);
      points.push({ id, x: point.x, y: point.y });
    }
    const layout = getMapSpiderLayout(
      points,
      { width: canvas.clientWidth, height: canvas.clientHeight - bottomInset },
      groupPages
    );
    const features: GeoJSON.Feature[] = [];
    for (const pin of layout.pins) {
      const feature = visibleEvents.get(pin.id)!;
      if (!pin.groupId) {
        features.push(feature);
        continue;
      }
      const position = map.unproject([pin.x, pin.y]).toArray();
      features.push(
        { type: "Feature", geometry: { type: "LineString", coordinates: [feature.geometry.coordinates, position] }, properties: {} },
        { ...feature, geometry: { type: "Point", coordinates: position } }
      );
      eventGroups.set(pin.id, pin.groupId);
    }
    spiderSource.setData({ type: "FeatureCollection", features });
    layoutVisible = true;
    groups = layout.groups;
    updatePager();
  }

  const getEventFeature = (point: maplibregl.Point) => {
    const layers = map.getZoom() >= SPIDER_MIN_ZOOM
      ? [SPIDER_LAYERS.pin]
      : [...categoryLayers.values()].flatMap(({ cluster, pin }) => [cluster, pin]);
    return layers.length ? map.queryRenderedFeatures(point, { layers })[0] : undefined;
  };

  map.on("click", (event) => {
    const version = ++clickVersion;
    const feature = getEventFeature(event.point);
    const geometry = feature?.geometry;
    if (!feature?.properties || !geometry || geometry.type !== "Point") return;

    const coordinates = geometry.coordinates as [number, number];
    const clusterId = feature.properties.cluster_id;
    if (typeof clusterId === "number") {
      const source = map.getSource<maplibregl.GeoJSONSource>(feature.source);
      void source?.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (version === clickVersion) map.easeTo({ center: coordinates, zoom, duration: 500 });
      }).catch((error) => {
        if (version === clickVersion) console.error("[map] Failed to expand event cluster", error);
      });
      return;
    }

    const properties = feature.properties as EventFeatureProperties;
    const groupId = eventGroups.get(properties.id);
    if (groupId) {
      activeGroupId = groupId;
      updatePager();
    }
    onSelectEventRef.current(properties.id);

    if (showEventPopupRef.current) {
      const popup = new maplibregl.Popup({ offset: 18 })
        .setLngLat(coordinates)
        .setHTML(renderEventPopup(properties))
        .addTo(map);
      if (groupId) spiderPopup = popup;
      bindPopupImageFallback(popup);

      if (!properties.imageUrl) {
        void loadEventPopupProperties(properties.id).then((fullProperties) => {
          if (fullProperties) {
            popup.setHTML(renderEventPopup(fullProperties));
            bindPopupImageFallback(popup);
          }
        });
      }
    }
  });

  map.on("movestart", () => {
    clickVersion += 1;
    closeSpiderPopup();
  });
  map.on("move", () => {
    const needsLayout = map.getZoom() >= SPIDER_MIN_ZOOM && events.features.length > 0;
    if (!needsLayout && !layoutVisible) return;
    if (layoutFrame === undefined && (needsLayout !== layoutVisible || performance.now() - lastRefresh >= SPIDER_REFRESH_INTERVAL)) {
      layoutFrame = window.requestAnimationFrame(refreshLayout);
    }
  });
  map.on("moveend", refreshLayout);
  map.on("resize", refreshLayout);
  map.on("mousemove", (event) => {
    map.getCanvas().style.cursor = getEventFeature(event.point) ? "pointer" : "";
  });
  map.on("mouseout", () => {
    map.getCanvas().style.cursor = "";
  });
  return {
    setEvents(data) {
      clickVersion += 1;
      events = data;
      activeGroupId = undefined;
      groupPages.clear();
      closeSpiderPopup();
      refreshLayout();
    },
    showPage(groupId, page) {
      activeGroupId = groupId;
      groupPages.set(groupId, page);
      closeSpiderPopup();
      refreshLayout();
    },
    contains: eventId => eventGroups.has(eventId),
    dispose() {
      clickVersion += 1;
      if (layoutFrame !== undefined) window.cancelAnimationFrame(layoutFrame);
      closeSpiderPopup();
    }
  };
}

function addSpiderLayers(map: maplibregl.Map) {
  map.addSource(SPIDER_LAYERS.source, {
    type: "geojson", data: EMPTY_SPIDER_DATA, maxzoom: Math.ceil(map.getMaxZoom())
  });
  map.addLayer({
    id: SPIDER_LINES,
    type: "line",
    source: SPIDER_LAYERS.source,
    minzoom: SPIDER_MIN_ZOOM,
    filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": "#334155",
      "line-width": 2,
      "line-opacity": ["interpolate", ["linear"], ["zoom"], SPIDER_MIN_ZOOM, 0.55, 15, 0.78]
    }
  });
  addEventPinLayers(map, SPIDER_LAYERS, ["==", ["geometry-type"], "Point"], { minzoom: SPIDER_MIN_ZOOM });
  return map.getSource<maplibregl.GeoJSONSource>(SPIDER_LAYERS.source)!;
}

function buildEventFeatureCollection(events: MapEvent[]): EventFeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.filter(hasCoordinates).map(event => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [event.longitude, event.latitude]
      },
      properties: {
        id: event.id,
        title: event.title,
        address: event.address,
        category: event.category,
        categorySlug: event.categorySlug,
        color: event.categoryColor,
        icon: getMapEventIcon(event),
        description: "short_description" in event ? event.short_description ?? event.description ?? "" : undefined,
        imageUrl: "imageUrl" in event ? event.imageUrl : undefined,
        startDate: event.startDate,
        city: event.city,
        url: getMapEventUrl(event)
      }
    }))
  };
}

function updateLocationMarker(
  map: maplibregl.Map,
  location: KnownLocation | undefined,
  markerRef: React.MutableRefObject<maplibregl.Marker | null>
) {
  if (!hasLocationCoordinates(location)) {
    markerRef.current?.remove();
    markerRef.current = null;
    return;
  }

  if (!markerRef.current) {
    const element = document.createElement("div");
    element.className = LOCATION_MARKER_CLASS;
    element.innerHTML = "<span>+</span>";
    markerRef.current = new maplibregl.Marker({ element, anchor: "center" });
  }

  markerRef.current.setLngLat([location.longitude, location.latitude]).addTo(map);
}

function fitMapToPoints(map: maplibregl.Map, location: KnownLocation | undefined, events: MapEvent[]) {
  if (!location) {
    fitMapToPoland(map);
    return;
  }

  const points: Array<[number, number]> = hasLocationCoordinates(location) ? [[location.longitude, location.latitude]] : [];
  events.forEach((event) => {
    if (event.latitude != null && event.longitude != null) {
      points.push([event.longitude, event.latitude]);
    }
  });

  if (!points.length) {
    fitMapToPoland(map);
    return;
  }

  if (points.length === 1) {
    map.easeTo({ center: points[0], zoom: 6, duration: 400 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
  points.slice(1).forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, { padding: 32, maxZoom: 12, duration: 500 });
}

function fitMapToPoland(map: maplibregl.Map) {
  map.fitBounds(POLAND_BOUNDS, { padding: 18, duration: 500 });
}

function focusMapOnEvent(map: maplibregl.Map, data: EventFeatureCollection, eventId: string) {
  const feature = data.features.find((item) => item.properties.id === eventId);
  if (!feature) return;

  map.easeTo({
    center: feature.geometry.coordinates as [number, number],
    zoom: Math.max(map.getZoom(), 13),
    offset: [0, -70],
    duration: 550
  });
}

function updateSelectedPaint(
  map: maplibregl.Map,
  categoryLayers: Map<string, CategoryLayers>,
  selectedEventId?: string
) {
  for (const layers of categoryLayers.values()) updatePinSelectedPaint(map, layers, selectedEventId);
  updatePinSelectedPaint(map, SPIDER_LAYERS, selectedEventId);
}

function updatePinSelectedPaint(map: maplibregl.Map, { pin, icon }: PinLayers, selectedEventId?: string) {
  if (!map.getLayer(pin)) return;
  const selectedId = selectedEventId ?? NO_SELECTED_EVENT_ID;
  map.setPaintProperty(pin, "circle-radius", selectedCircleRadius(selectedId));
  map.setPaintProperty(pin, "circle-stroke-width", selectedStrokeWidth(selectedId));
  map.setPaintProperty(pin, "circle-opacity", selectedCircleOpacity(selectedId));
  map.setPaintProperty(icon, "icon-opacity", selectedIconOpacity(selectedId));
}

function selectedCircleRadius(selectedEventId: string): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedEventId], 19, 14];
}

function selectedStrokeWidth(selectedEventId: string): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedEventId], 3.5, 1.8];
}

function selectedCircleOpacity(selectedEventId: string): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedEventId], 0.88, 0.64];
}

function selectedIconOpacity(selectedEventId: string): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedEventId], 0.96, 0.78];
}

function addAdministrativeBoundaryLayers(map: maplibregl.Map) {
  const sourceId = getVectorTileSourceId(map);

  if (!map.getSource(VOIVODESHIP_SOURCE_ID)) {
    map.addSource(VOIVODESHIP_SOURCE_ID, {
      type: "geojson",
      data: "/data/wojewodztwa-min.geojson"
    });
  }

  const beforeId = findFirstSymbolLayerId(map);

  if (!map.getLayer("eventmap-voivodeship-fill")) {
    map.addLayer(
      {
        id: "eventmap-voivodeship-fill",
        type: "fill",
        source: VOIVODESHIP_SOURCE_ID,
        paint: {
          "fill-color": [
            "match",
            ["get", "nazwa"],
            "dolnośląskie",
            "#f59e0b",
            "kujawsko-pomorskie",
            "#22c55e",
            "lubelskie",
            "#3b82f6",
            "lubuskie",
            "#ec4899",
            "łódzkie",
            "#8b5cf6",
            "małopolskie",
            "#14b8a6",
            "mazowieckie",
            "#ef4444",
            "opolskie",
            "#0ea5e9",
            "podkarpackie",
            "#eab308",
            "podlaskie",
            "#10b981",
            "pomorskie",
            "#2563eb",
            "śląskie",
            "#d946ef",
            "świętokrzyskie",
            "#f97316",
            "warmińsko-mazurskie",
            "#06b6d4",
            "wielkopolskie",
            "#84cc16",
            "zachodniopomorskie",
            "#6366f1",
            "#f59e0b"
          ],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0.18,
            7,
            0.23,
            10,
            0.17
          ]
        }
      },
      beforeId
    );
  }

  if (!map.getLayer("eventmap-voivodeship-boundaries")) {
    map.addLayer(
      {
        id: "eventmap-voivodeship-boundaries",
        type: "line",
        source: VOIVODESHIP_SOURCE_ID,
        paint: {
          "line-color": "#dc2626",
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.5,
            8,
            0.68,
            11,
            0.78
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            1.4,
            8,
            2.4,
            11,
            3.4
          ],
          "line-blur": 0.12
        }
      },
      beforeId
    );
  }

  if (sourceId && !map.getLayer("eventmap-county-boundaries")) {
    map.addLayer(
      {
        id: "eventmap-county-boundaries",
        type: "line",
        source: sourceId,
        "source-layer": "boundary",
        minzoom: 3,
        filter: adminLevelFilter("6"),
        paint: {
          "line-color": "#1d4ed8",
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            0.05,
            3.5,
            0.08,
            4,
            0.12,
            5,
            0.24,
            6,
            0.42,
            10,
            0.62,
            13,
            0.78
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            0.3,
            3.5,
            0.4,
            4,
            0.5,
            5,
            0.7,
            6,
            1,
            10,
            1.8,
            13,
            2.6
          ],
          "line-dasharray": [3, 1.5]
        }
      },
      beforeId
    );
  }
}

function addHouseNumberLayer(map: maplibregl.Map) {
  const sourceId = getVectorTileSourceId(map);
  if (!sourceId || map.getLayer("eventmap-house-numbers")) return;

  map.addLayer({
    id: "eventmap-house-numbers",
    type: "symbol",
    source: sourceId,
    "source-layer": "housenumber",
    minzoom: 17,
    layout: {
      "text-field": ["get", "housenumber"],
      "text-font": ["Noto Sans Regular"],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        17,
        10,
        19,
        12
      ],
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#4b5563",
      "text-halo-color": "rgba(255, 255, 255, 0.88)",
      "text-halo-width": 1
    }
  });
}

function getVectorTileSourceId(map: maplibregl.Map) {
  const sources = map.getStyle().sources ?? {};
  const preferredSourceIds = [
    "openmaptiles",
    "openfreemap",
    "openstreetmap",
    "openstreetmap-openmaptiles"
  ];

  const preferredSourceId = preferredSourceIds.find((sourceId) => sources[sourceId]?.type === "vector");
  if (preferredSourceId) return preferredSourceId;

  return Object.entries(sources).find(([, source]) => source.type === "vector")?.[0] ?? null;
}

function findFirstSymbolLayerId(map: maplibregl.Map) {
  return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}

function adminLevelFilter(adminLevel: string): FilterSpecification {
  return ["==", ["to-string", ["get", "admin_level"]], adminLevel];
}

const POLISH_VOIVODESHIP_NAME = ["match", ["get", "name"],
  "Lower Silesian Voivodeship", "dolnośląskie", "Kuyavian-Pomeranian Voivodeship", "kujawsko-pomorskie",
  "Lublin Voivodeship", "lubelskie", "Lubusz Voivodeship", "lubuskie",
  "Łódź Voivodeship", "łódzkie", "Lesser Poland Voivodeship", "małopolskie",
  "Masovian Voivodeship", "mazowieckie", "Opole Voivodeship", "opolskie",
  "Subcarpathian Voivodeship", "podkarpackie", "Podlaskie Voivodeship", "podlaskie",
  "Pomeranian Voivodeship", "pomorskie", "Silesian Voivodeship", "śląskie",
  "Świętokrzyskie Voivodeship", "świętokrzyskie", "Warmian-Masurian Voivodeship", "warmińsko-mazurskie",
  "Greater Poland Voivodeship", "wielkopolskie", "West Pomeranian Voivodeship", "zachodniopomorskie",
  ["get", "name"]] as unknown as ExpressionSpecification;

async function addCategoryImages(map: maplibregl.Map, data: EventFeatureCollection, signal: AbortSignal) {
  // Lucide icons are rendered synchronously into a separate React root.
  await Promise.resolve();
  if (signal.aborted) return;

  const uniqueIcons = new Set(data.features.map(({ properties }) => properties.icon));

  await Promise.all(
    Array.from(uniqueIcons, async (iconName) => {
      if (map.hasImage(iconName)) return;

      try {
        const svgString = getLucideIconSvgString(iconName);
        if (svgString) {
          const image = await loadSvgImage(svgString);
          if (!signal.aborted && !map.hasImage(iconName)) map.addImage(iconName, image);
        }
      } catch (err) {
        console.error(`Failed to load map icon ${iconName}:`, err);
      }
    })
  );
}

// Build a case-insensitive map of Lucide icon names for backward compatibility
const LOWERCASE_TO_PASCAL_MAP = new Map<string, string>();
Object.keys(LucideIcons).forEach((key) => {
  LOWERCASE_TO_PASCAL_MAP.set(key.toLowerCase(), key);
});

function getLucideIconSvgString(iconName: string): string {
  let resolvedKey: string | undefined;
  if (iconName) {
    if (iconName in LucideIcons) {
      resolvedKey = iconName;
    } else {
      resolvedKey = LOWERCASE_TO_PASCAL_MAP.get(iconName.toLowerCase());
    }
  }

  const IconComponent = resolvedKey
    ? (LucideIcons[resolvedKey as keyof typeof LucideIcons] as LucideIcon)
    : LucideIcons.CircleHelp;

  const tempDiv = document.createElement("div");
  const root = createRoot(tempDiv);
  
  flushSync(() => {
    root.render(
      <IconComponent 
        color="#ffffff" 
        size={32} 
        strokeWidth={2.3}
      />
    );
  });
  
  const svgHtml = (tempDiv.querySelector("svg")?.outerHTML || "")
    .replace(/currentColor/g, "#ffffff")
    .replace(/stroke="[^"]*"/g, 'stroke="#ffffff"')
    .replace(/color="[^"]*"/g, 'color="#ffffff"');
  root.unmount();
  return svgHtml;
}


function loadSvgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(32, 32);
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nie udało się załadować ikony mapy."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function applyPolishLabels(map: maplibregl.Map) {
  const layers = map.getStyle().layers ?? [];
  layers.forEach((layer) => {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"]) return;
    if (!shouldLocalizeLayer(layer.id, layer.layout["text-field"])) return;

    prioritizePlaceLabel(map, layer);

    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name:pl"],
      POLISH_VOIVODESHIP_NAME,
      ["get", "name"],
      ["get", "name:latin"],
      ["get", "name:nonlatin"]
    ]);
  });

  addPriorityCityLabels(map);
}

function prioritizePlaceLabel(
  map: maplibregl.Map,
  layer: Extract<maplibregl.LayerSpecification, { type: "symbol" }>
) {
  if (layer.id === "label_city" || layer.id === "label_city_capital") {
    map.setLayerZoomRange(layer.id, 1, layer.maxzoom ?? 24);
    map.setLayoutProperty(layer.id, "symbol-sort-key", ["coalesce", ["get", "rank"], 99]);
    map.setLayoutProperty(layer.id, "text-padding", 1);
    return;
  }

  if (layer.id === "label_town") {
    map.setLayerZoomRange(layer.id, 1, layer.maxzoom ?? 24);
    map.setLayoutProperty(layer.id, "symbol-sort-key", ["coalesce", ["get", "rank"], 99]);
    map.setLayoutProperty(layer.id, "text-padding", 1);
    return;
  }

  if (layer.id === "label_village") {
    map.setLayerZoomRange(layer.id, 1.5, layer.maxzoom ?? 24);
    map.setLayoutProperty(layer.id, "symbol-sort-key", ["coalesce", ["get", "rank"], 99]);
    map.setLayoutProperty(layer.id, "text-padding", 1);
  }
}

function addPriorityCityLabels(map: maplibregl.Map) {
  const sourceId = getVectorTileSourceId(map);
  if (!sourceId || map.getLayer("eventmap-major-city-labels")) return;

  map.addLayer({
    id: "eventmap-major-city-labels",
    type: "symbol",
    source: sourceId,
    "source-layer": "place",
    minzoom: 1,
    maxzoom: 7,
    filter: [
      "all",
      ["in", ["get", "class"], ["literal", ["city", "town"]]],
      ["<=", ["get", "rank"], 8]
    ] as FilterSpecification,
    layout: {
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      "text-allow-overlap": true,
      "text-field": [
        "coalesce",
        ["get", "name:pl"],
        POLISH_VOIVODESHIP_NAME,
        ["get", "name"],
        ["get", "name:latin"],
        ["get", "name:nonlatin"]
      ],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 10, 5, 12, 7, 14]
    },
    paint: {
      "text-color": "#111827",
      "text-halo-blur": 0.8,
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4
    }
  });
}

function shouldLocalizeLayer(layerId: string, textField: unknown) {
  const id = layerId.toLowerCase();
  if (id.includes("housenumber") || id.includes("address") || id.includes("shield") || id.includes("ref")) {
    return false;
  }

  const field = JSON.stringify(textField).toLowerCase();
  return field.includes("name") || id.includes("label") || id.includes("place") || id.includes("poi");
}

function hasCoordinates(event: MapEvent): event is MapEvent & { latitude: number; longitude: number } {
  return event.latitude != null && event.longitude != null;
}

function getMapEventIcon(event: MapEvent) {
  return "categoryIcon" in event
    ? event.categoryIcon || "CircleHelp"
    : event.categoryRelation?.icon || "CircleHelp";
}

function getMapEventUrl(event: MapEvent) {
  if ("imageUrl" in event) return eventPath(event);
  return `/${event.categorySlug}/${event.citySlug}/${event.slug}`.toLowerCase();
}



function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return value.replace(/[&<>"']/g, (char) => replacements[char]);
}

function renderEventPopup(properties: EventFeatureProperties) {
  const url = escapeHtml(properties.url ?? "#");
  const title = escapeHtml(properties.title);
  const address = escapeHtml(properties.address);
  const imageUrl = properties.imageUrl ? escapeHtml(properties.imageUrl) : "";
  const description = properties.description ? truncateText(properties.description, 130) : "";
  const date = properties.startDate ? formatPolishDate(properties.startDate, { day: "numeric", month: "short" }) : "";
  const photo = getEventCoverPhoto(properties);

  return `
    <article class="mapEventPopup">
      <a class="mapEventPopupImageLink" href="${url}" aria-label="${title}">
        <div class="mapEventPopupCover${photo ? " mapEventPopupCover--photo" : ""}" aria-hidden="true" ${imageUrl ? "hidden" : ""}>
          ${photo ? `<img class="mapEventPopupBackdrop" src="${escapeHtml(photo.url)}" alt="" width="1200" height="800" loading="lazy" /><em class="mapEventPopupPhotoNote">Zdjęcie ilustracyjne</em>` : ""}
          <small>${escapeHtml(properties.category)}</small><strong>${title}</strong>
          <span>${escapeHtml([date, properties.city].filter(Boolean).join(" · "))}</span>
        </div>
        ${imageUrl ? `<img class="mapEventPopupImage" src="${imageUrl}" alt="" loading="lazy" />` : ""}
      </a>
      <div class="mapEventPopupBody">
        <a class="mapEventPopupTitle" href="${url}">${title}</a>
        <p class="mapEventPopupAddress">${address}</p>
        ${description ? `<p class="mapEventPopupDescription">${escapeHtml(description)}</p>` : ""}
      </div>
    </article>
  `;
}

function bindPopupImageFallback(popup: maplibregl.Popup) {
  const element = popup.getElement();
  const image = element?.querySelector<HTMLImageElement>(".mapEventPopupImage");
  const cover = element?.querySelector<HTMLElement>(".mapEventPopupCover");
  const background = element?.querySelector<HTMLImageElement>(".mapEventPopupBackdrop");
  if (background) {
    const removeBackground = () => { background.remove(); element?.querySelector(".mapEventPopupPhotoNote")?.remove(); cover?.classList.remove("mapEventPopupCover--photo"); };
    background.addEventListener("error", removeBackground, { once: true });
    if (background.complete && background.naturalWidth === 0) removeBackground();
  }
  if (!image || !cover) return;
  const showCover = () => { image.remove(); cover.hidden = false; };
  image.addEventListener("error", showCover, { once: true });
  if (image.complete && image.naturalWidth === 0) showCover();
}

async function loadEventPopupProperties(eventId: string): Promise<EventFeatureProperties | null> {
  try {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
    if (!response.ok) return null;
    const { event } = (await response.json()) as { event?: EventItem };
    return event ? eventToFeatureProperties(event) : null;
  } catch (error) {
    console.error("[map] Failed to load event popup details", error);
    return null;
  }
}

function eventToFeatureProperties(event: EventItem): EventFeatureProperties {
  return {
    id: event.id,
    title: event.title,
    address: event.address,
    category: event.category,
    categorySlug: event.categorySlug,
    color: event.categoryColor,
    icon: event.categoryRelation?.icon || "CircleHelp",
    description: event.short_description ?? event.description ?? "",
    imageUrl: event.imageUrl,
    startDate: event.startDate,
    city: event.city,
    url: eventPath(event)
  };
}

function truncateText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trim()}...`;
}
