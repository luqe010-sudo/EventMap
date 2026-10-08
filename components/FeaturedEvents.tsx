"use client";

import EventCarousel, { type CarouselEvent } from "./EventCarousel";

export default function FeaturedEvents({ events, onOpenEvent }: { events: CarouselEvent[]; onOpenEvent?: (eventId: string) => void }) {
  return <EventCarousel events={events} title="Polecane wydarzenia" description="Wyróżnione i najbliższe wydarzenia pasujące do Twoich filtrów." onOpenEvent={onOpenEvent} seeAllHref="#events-list" />;
}
