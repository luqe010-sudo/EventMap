"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import type { MutableRefObject } from "react";
import type { EventItem, KnownLocation } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import * as LucideIcons from "lucide-react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

type MapLibreMapProps = {
  events: EventItem[];
  selectedEventId?: string;
  location?: KnownLocation;
  onSelectEvent: (eventId: string) => void;
};

type EventFeatureProperties = {
  id: string;
  title: string;
  address: string;
  category: string;
  color: string;
  icon: string;
  description: string;
  imageUrl: string;
  url: string;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const EVENT_SOURCE_ID = "eventmap-events";
const VOIVODESHIP_SOURCE_ID = "eventmap-voivodeships";
const LOCATION_MARKER_CLASS = "locationMarker";
const NO_SELECTED_EVENT_ID = "__none__";
const EVENT_CLUSTER_MAX_ZOOM = 11;
const EVENT_CLUSTER_RADIUS = 34;
const OVERLAPPING_MARKER_OFFSET_METERS = 28;
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
  location,
  onSelectEvent
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectEventRef = useRef(onSelectEvent);
  const initialCenterRef = useRef<[number, number]>(
    location ? [location.longitude, location.latitude] : POLAND_CENTER
  );
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
      zoom: location ? 6 : 4.8,
      attributionControl: false,
      locale: MAP_LOCALE
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    map.on("load", async () => {
      applyPolishLabels(map);
      await addCategoryImages(map, events);
      addAdministrativeBoundaryLayers(map);
      addHouseNumberLayer(map);
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

    void addCategoryImages(map, events).then(() => {
      const source = map.getSource(EVENT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(buildEventFeatureCollection(events));
    });
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
      clusterMaxZoom: EVENT_CLUSTER_MAX_ZOOM,
      clusterRadius: EVENT_CLUSTER_RADIUS
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
        "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 25, 26, 50, 32],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.4,
        "circle-stroke-opacity": 0.78,
        "circle-opacity": 0.7
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
        "text-size": 12
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
        "circle-stroke-opacity": 0.76,
        "circle-opacity": selectedCircleOpacity(NO_SELECTED_EVENT_ID)
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
        "icon-size": 0.61,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      },
      paint: {
        "icon-opacity": selectedIconOpacity(NO_SELECTED_EVENT_ID)
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
      .setHTML(renderEventPopup(properties))
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
  const positionedEvents = spreadOverlappingEventCoordinates(events.filter(hasCoordinates));

  return {
    type: "FeatureCollection",
    features: positionedEvents.map(({ event, coordinates }) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates
      },
      properties: {
        id: event.id,
        title: event.title,
        address: event.address,
        category: event.category,
        color: event.categoryColor,
        icon: event.categoryRelation?.icon || "CircleHelp",
        description: event.short_description ?? event.description ?? "",
        imageUrl: event.imageUrl,
        url: eventPath(event)
      }
    }))
  };
}

function spreadOverlappingEventCoordinates(events: Array<EventItem & { latitude: number; longitude: number }>) {
  const groups = new Map<string, Array<EventItem & { latitude: number; longitude: number }>>();

  for (const event of events) {
    const key = `${event.latitude.toFixed(5)}:${event.longitude.toFixed(5)}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return Array.from(groups.values()).flatMap((group) => {
    if (group.length === 1) {
      const event = group[0];
      return [{ event, coordinates: [event.longitude, event.latitude] as [number, number] }];
    }

    return group.map((event, index) => ({
      event,
      coordinates: offsetCoordinates(event.longitude, event.latitude, index, group.length)
    }));
  });
}

function offsetCoordinates(longitude: number, latitude: number, index: number, total: number): [number, number] {
  const angle = (Math.PI * 2 * index) / total;
  const ring = Math.floor(index / 8);
  const radiusMeters = OVERLAPPING_MARKER_OFFSET_METERS * (1 + ring * 0.55);
  const eastMeters = Math.cos(angle) * radiusMeters;
  const northMeters = Math.sin(angle) * radiusMeters;
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.max(Math.cos(latitude * Math.PI / 180), 0.2);

  return [
    longitude + eastMeters / metersPerDegreeLongitude,
    latitude + northMeters / metersPerDegreeLatitude
  ];
}

function updateLocationMarker(
  map: maplibregl.Map,
  location: KnownLocation | undefined,
  markerRef: React.MutableRefObject<maplibregl.Marker | null>
) {
  if (!location) {
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

function fitMapToPoints(map: maplibregl.Map, location: KnownLocation | undefined, events: EventItem[]) {
  if (!location) {
    fitMapToPoland(map);
    return;
  }

  const points: Array<[number, number]> = location ? [[location.longitude, location.latitude]] : [];
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

function updateSelectedPaint(map: maplibregl.Map, selectedEventId?: string) {
  if (!map.getLayer("event-pins")) return;
  const selectedId = selectedEventId ?? NO_SELECTED_EVENT_ID;
  map.setPaintProperty("event-pins", "circle-radius", selectedCircleRadius(selectedId));
  map.setPaintProperty("event-pins", "circle-stroke-width", selectedStrokeWidth(selectedId));
  map.setPaintProperty("event-pins", "circle-opacity", selectedCircleOpacity(selectedId));
  if (map.getLayer("event-pin-icons")) {
    map.setPaintProperty("event-pin-icons", "icon-opacity", selectedIconOpacity(selectedId));
  }
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

async function addCategoryImages(map: maplibregl.Map, events: EventItem[]) {
  const uniqueIcons = Array.from(
    new Set(events.map((e) => e.categoryRelation?.icon || "CircleHelp"))
  );

  await Promise.all(
    uniqueIcons.map(async (iconName) => {
      if (map.hasImage(iconName)) return;

      try {
        const svgString = getLucideIconSvgString(iconName);
        if (svgString) {
          const image = await loadSvgImage(svgString);
          map.addImage(iconName, image);
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
    ? (LucideIcons[resolvedKey as keyof typeof LucideIcons] as React.ComponentType<any>)
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
  
  const svgHtml = tempDiv.querySelector("svg")?.outerHTML || "";
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

function hasCoordinates(event: EventItem): event is EventItem & { latitude: number; longitude: number } {
  return event.latitude != null && event.longitude != null;
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
  const url = escapeHtml(properties.url);
  const title = escapeHtml(properties.title);
  const address = escapeHtml(properties.address);
  const imageUrl = escapeHtml(properties.imageUrl);
  const description = truncateText(properties.description, 130);

  return `
    <article class="mapEventPopup">
      <a class="mapEventPopupImageLink" href="${url}" aria-label="${title}">
        <img class="mapEventPopupImage" src="${imageUrl}" alt="" loading="lazy" />
      </a>
      <div class="mapEventPopupBody">
        <a class="mapEventPopupTitle" href="${url}">${title}</a>
        <p class="mapEventPopupAddress">${address}</p>
        ${description ? `<p class="mapEventPopupDescription">${escapeHtml(description)}</p>` : ""}
      </div>
    </article>
  `;
}

function truncateText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trim()}...`;
}
