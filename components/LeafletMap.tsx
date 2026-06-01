"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { EventItem, KnownLocation } from "@/lib/events";

type LeafletMapProps = {
  events: EventItem[];
  selectedEventId?: string;
  location: KnownLocation;
  onSelectEvent: (eventId: string) => void;
};

export default function LeafletMap({ events, selectedEventId, location, onSelectEvent }: LeafletMapProps) {
  const center: [number, number] = [location.latitude, location.longitude];

  return (
    <MapContainer className="leafletCanvas" center={center} zoom={6} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapBounds events={events} location={location} />
      <Marker position={center} icon={createLocationIcon()}>
        <Popup>{location.label}</Popup>
      </Marker>
      {events.filter(hasCoordinates).map((event) => (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          icon={createEventIcon(event.category, selectedEventId === event.id)}
          eventHandlers={{
            click: () => onSelectEvent(event.id)
          }}
        >
          <Popup>
            <strong>{event.title}</strong>
            <br />
            {event.address}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function MapBounds({ events, location }: Pick<LeafletMapProps, "events" | "location">) {
  const map = useMap();

  // Invalidate size on mount and layout changes to prevent the blank gray container bug
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map, location, events]);

  useEffect(() => {
    const points: Array<[number, number]> = [[location.latitude, location.longitude]];
    events.forEach((event) => {
      if (event.latitude != null && event.longitude != null) {
        points.push([event.latitude, event.longitude]);
      }
    });

    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }

    map.fitBounds(points, { padding: [32, 32], maxZoom: 12 });
  }, [events, location, map]);

  return null;
}

function hasCoordinates(event: EventItem): event is EventItem & { latitude: number; longitude: number } {
  return event.latitude != null && event.longitude != null;
}

function createLocationIcon() {
  return L.divIcon({
    className: "locationMarker",
    html: "<span>⌖</span>",
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function createEventIcon(category: EventItem["category"], selected: boolean) {
  const emojiByCategory: Record<string, string> = {
    Koncert: "🎵",
    Festyn: "🎪",
    Dożynki: "🌾",
    Sport: "🏃",
    Rodzina: "🧒",
    Targi: "🛍️",
    Motoryzacja: "🚗",
    Kultura: "🎭",
    Inne: "📍"
  };

  return L.divIcon({
    className: selected ? "eventMarker selectedMarker" : "eventMarker",
    html: `<span>${emojiByCategory[category] ?? "•"}</span>`,
    iconSize: selected ? [46, 46] : [38, 38],
    iconAnchor: selected ? [23, 23] : [19, 19]
  });
}
