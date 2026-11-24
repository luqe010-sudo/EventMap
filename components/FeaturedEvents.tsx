"use client";

import EventCarousel, { type CarouselEvent } from "./EventCarousel";

export default function FeaturedEvents({ events, onOpenEvent, onSeeAll }: { events: CarouselEvent[]; onOpenEvent?: (eventId: string) => void; onSeeAll?: () => void }) {
  return (
    <EventCarousel
      events={events}
      featured
      title="Polecane wydarzenia"
      onOpenEvent={onOpenEvent}
      seeAllHref="#events-list"
      onSeeAll={onSeeAll}
    />
  );
}
