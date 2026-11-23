"use client";

import Link from "next/link";
import EventCarousel, { type CarouselEvent } from "./EventCarousel";
import { PROMOTION_PAGE_PATH, PROMOTION_PRICE_LABEL } from "@/lib/promotion";

export default function FeaturedEvents({ events, onOpenEvent }: { events: CarouselEvent[]; onOpenEvent?: (eventId: string) => void }) {
  return (
    <EventCarousel
      events={events}
      title="Polecane wydarzenia"
      description="Wydarzenia pasujące do Twoich filtrów. Najpierw pokazujemy płatne wyróżnienia organizatorów, oznaczone jako „Promowane”."
      onOpenEvent={onOpenEvent}
      seeAllHref="#events-list"
      footer={<p className="eventCarouselPromoteNote">Organizujesz wydarzenie? <Link href={PROMOTION_PAGE_PATH}>Wyróżnij je za {PROMOTION_PRICE_LABEL}</Link>.</p>}
    />
  );
}
