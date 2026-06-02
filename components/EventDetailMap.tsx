"use client";

import dynamic from "next/dynamic";
import type { EventItem, KnownLocation } from "@/lib/events";

const MapLibreMap = dynamic(() => import("@/components/MapLibreMap"), {
  ssr: false,
  loading: () => <div className="mapLoading">Ładowanie mapy szczegółów…</div>
});

type EventDetailMapProps = {
  event: EventItem;
  location: KnownLocation;
};

export default function EventDetailMap({ event, location }: EventDetailMapProps) {
  return (
    <MapLibreMap
      events={[event]}
      selectedEventId={event.id}
      location={location}
      onSelectEvent={() => {}}
    />
  );
}
