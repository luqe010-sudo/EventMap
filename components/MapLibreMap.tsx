"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import type { MutableRefObject } from "react";
import type { EventItem, KnownLocation } from "@/lib/events";

type MapLibreMapProps = {
  events: EventItem[];
  selectedEventId?: string;
  location: KnownLocation;
  onSelectEvent: (eventId: string) => void;
};

type EventFeatureProperties = {
  id: string;
  title: string;
  address: string;
  category: string;
  color: string;
  icon: string;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const EVENT_SOURCE_ID = "eventmap-events";
const LOCATION_MARKER_CLASS = "locationMarker";
const NO_SELECTED_EVENT_ID = "__none__";

const MAP_LOCALE = {
  "NavigationControl.ZoomIn": "Powiększ",
  "NavigationControl.ZoomOut": "Pomniejsz",
  "NavigationControl.ResetBearing": "Resetuj obrót",
  "AttributionControl.ToggleAttribution": "Pokaż atrybucję"
};

const CATEGORY_ICONS: Record<string, string> = {
  Koncert: "event-icon-koncert",
  Festyn: "event-icon-festyn",
  Dozynki: "event-icon-dozynki",
  Sport: "event-icon-sport",
  Rodzina: "event-icon-rodzina",
  Targi: "event-icon-targi",
  Motoryzacja: "event-icon-motoryzacja",
  Kultura: "event-icon-kultura",
  Inne: "event-icon-inne"
};

const CATEGORY_ICON_SVGS: Record<string, string> = {
  "event-icon-koncert": '<path d="M9 18V5l10-2v13" /><circle cx="7" cy="18" r="3" /><circle cx="17" cy="16" r="3" />',
  "event-icon-festyn": '<path d="M4 19h16L12 5 4 19Z" /><path d="M12 5v14M7 14h10" />',
  "event-icon-dozynki": '<path d="M12 21V5" /><path d="M12 9C8 8 6 6 5 3c4 0 6 2 7 6ZM12 14c4-1 6-3 7-6-4 0-6 2-7 6ZM12 18c-4-1-6-3-7-6 4 0 6 2 7 6Z" />',
  "event-icon-sport": '<circle cx="12" cy="12" r="8" /><path d="m8 6 4 4 4-4M4.5 13h5L8 18M19.5 13h-5l1.5 5" />',
  "event-icon-rodzina": '<circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M4 20c.7-3.8 3-6 6-6s5.3 2.2 6 6M14 19c.5-2.5 2-4 4-4 1.7 0 3 1.1 3.6 3" />',
  "event-icon-targi": '<path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0M5 8h14" />',
  "event-icon-motoryzacja": '<path d="M5 15h14l-2-5H7l-2 5Z" /><path d="M7 15v3M17 15v3" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" />',
  "event-icon-kultura": '<path d="M6 5c4 0 6 2 6 5 0-3 2-5 6-5v13c-4 0-6 1.2-6 3 0-1.8-2-3-6-3V5Z" /><path d="M12 10v11" />',
  "event-icon-inne": '<path d="M12 3v18M5 8l14 8M19 8 5 16" />'
};

export default function MapLibreMap({
  events,
  selectedEventId,
  location,
  onSelectEvent
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectEventRef = useRef(onSelectEvent);
  const initialCenterRef = useRef<[number, number]>([location.longitude, location.latitude]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: initialCenterRef.current,
      zoom: 6,
      attributionControl: false,
      locale: MAP_LOCALE
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    map.on("load", async () => {
      applyPolishLabels(map);
      await addCategoryImages(map);
      addEventSourceAndLayers(map, onSelectEventRef);
      setMapReady(true);
    });

    return () => {
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(EVENT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildEventFeatureCollection(events));
    updateSelectedPaint(map, selectedEventId);
    updateLocationMarker(map, location, locationMarkerRef);
    fitMapToPoints(map, location, events);
  }, [events, location, mapReady, selectedEventId]);

  return <div ref={containerRef} className="mapLibreCanvas" />;
}

function addEventSourceAndLayers(
  map: maplibregl.Map,
  onSelectEventRef: MutableRefObject<(eventId: string) => void>
) {
  if (!map.getSource(EVENT_SOURCE_ID)) {
    map.addSource(EVENT_SOURCE_ID, {
      type: "geojson",
      data: buildEventFeatureCollection([]),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 54
    });
  }

  if (!map.getLayer("event-clusters")) {
    map.addLayer({
      id: "event-clusters",
      type: "circle",
      source: EVENT_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#2563eb",
          10,
          "#7c3aed",
          25,
          "#f59e0b",
          50,
          "#ef3f18"
        ],
        "circle-radius": ["step", ["get", "point_count"], 20, 10, 25, 25, 31, 50, 38],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
        "circle-opacity": 0.94
      }
    });
  }

  if (!map.getLayer("event-cluster-count")) {
    map.addLayer({
      id: "event-cluster-count",
      type: "symbol",
      source: EVENT_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 13
      },
      paint: {
        "text-color": "#ffffff"
      }
    });
  }

  if (!map.getLayer("event-pins")) {
    map.addLayer({
      id: "event-pins",
      type: "circle",
      source: EVENT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["coalesce", ["get", "color"], "#ef3f18"],
        "circle-radius": selectedCircleRadius(NO_SELECTED_EVENT_ID),
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": selectedStrokeWidth(NO_SELECTED_EVENT_ID),
        "circle-opacity": 0.96
      }
    });
  }

  if (!map.getLayer("event-pin-icons")) {
    map.addLayer({
      id: "event-pin-icons",
      type: "symbol",
      source: EVENT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": 0.68,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    });
  }

  bindEventLayerInteractions(map, onSelectEventRef);
}

function bindEventLayerInteractions(
  map: maplibregl.Map,
  onSelectEventRef: MutableRefObject<(eventId: string) => void>
) {
  map.on("click", "event-clusters", (event) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: ["event-clusters"] })[0];
    const clusterId = feature?.properties?.cluster_id;
    const geometry = feature?.geometry;
    if (clusterId == null || !geometry || geometry.type !== "Point") return;

    const source = map.getSource(EVENT_SOURCE_ID) as maplibregl.GeoJSONSource;
    void source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({
        center: geometry.coordinates as [number, number],
        zoom,
        duration: 500
      });
    });
  });

  map.on("click", "event-pins", (event) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: ["event-pins"] })[0];
    const geometry = feature?.geometry;
    if (!feature?.properties || !geometry || geometry.type !== "Point") return;

    const properties = feature.properties as EventFeatureProperties;
    onSelectEventRef.current(properties.id);

    new maplibregl.Popup({ offset: 18 })
      .setLngLat(geometry.coordinates as [number, number])
      .setHTML(`<strong>${escapeHtml(properties.title)}</strong><br />${escapeHtml(properties.address)}`)
      .addTo(map);
  });

  ["event-clusters", "event-pins"].forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

function buildEventFeatureCollection(events: EventItem[]): GeoJSON.FeatureCollection<GeoJSON.Point, EventFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: events.filter(hasCoordinates).map((event) => ({
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
        color: event.categoryColor,
        icon: getCategoryIconId(event.category)
      }
    }))
  };
}

function updateLocationMarker(
  map: maplibregl.Map,
  location: KnownLocation,
  markerRef: React.MutableRefObject<maplibregl.Marker | null>
) {
  if (!markerRef.current) {
    const element = document.createElement("div");
    element.className = LOCATION_MARKER_CLASS;
    element.innerHTML = "<span>+</span>";
    markerRef.current = new maplibregl.Marker({ element, anchor: "center" });
  }

  markerRef.current.setLngLat([location.longitude, location.latitude]).addTo(map);
}

function fitMapToPoints(map: maplibregl.Map, location: KnownLocation, events: EventItem[]) {
  const points: Array<[number, number]> = [[location.longitude, location.latitude]];
  events.forEach((event) => {
    if (event.latitude != null && event.longitude != null) {
      points.push([event.longitude, event.latitude]);
    }
  });

  if (points.length === 1) {
    map.easeTo({ center: points[0], zoom: 6, duration: 400 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
  points.slice(1).forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, { padding: 32, maxZoom: 12, duration: 500 });
}

function updateSelectedPaint(map: maplibregl.Map, selectedEventId?: string) {
  if (!map.getLayer("event-pins")) return;
  const selectedId = selectedEventId ?? NO_SELECTED_EVENT_ID;
  map.setPaintProperty("event-pins", "circle-radius", selectedCircleRadius(selectedId));
  map.setPaintProperty("event-pins", "circle-stroke-width", selectedStrokeWidth(selectedId));
}

function selectedCircleRadius(selectedEventId: string): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedEventId], 21, 16];
}

function selectedStrokeWidth(selectedEventId: string): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedEventId], 4, 2];
}

async function addCategoryImages(map: maplibregl.Map) {
  await Promise.all(
    Object.entries(CATEGORY_ICON_SVGS).map(async ([id, paths]) => {
      if (map.hasImage(id)) return;
      const image = await loadSvgImage(buildIconSvg(paths));
      map.addImage(id, image);
    })
  );
}

function buildIconSvg(paths: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
      <g fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        ${paths}
      </g>
    </svg>
  `;
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

    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name:pl"],
      ["get", "name"],
      ["get", "name:latin"],
      ["get", "name:nonlatin"]
    ]);
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

function hasCoordinates(event: EventItem): event is EventItem & { latitude: number; longitude: number } {
  return event.latitude != null && event.longitude != null;
}

function getCategoryIconId(category: EventItem["category"]) {
  const normalizedCategory = normalizeCategory(category);
  return CATEGORY_ICONS[normalizedCategory] ?? CATEGORY_ICONS.Inne;
}

function normalizeCategory(category: string) {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("koncert")) return "Koncert";
  if (normalized.includes("festyn")) return "Festyn";
  if (normalized.includes("dozynki")) return "Dozynki";
  if (normalized.includes("sport")) return "Sport";
  if (normalized.includes("rodzina")) return "Rodzina";
  if (normalized.includes("targi")) return "Targi";
  if (normalized.includes("motoryzacja")) return "Motoryzacja";
  if (normalized.includes("kultura")) return "Kultura";
  return "Inne";
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
