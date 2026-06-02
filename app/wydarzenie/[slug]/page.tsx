import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventDetailView from "@/components/EventDetailView";
import { getEventBySlug, listEvents } from "@/lib/events";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  return {
    title: `${event.title} - ${event.city} | EventMap`,
    description: event.short_description ?? event.description ?? `Szczegoly wydarzenia ${event.title}.`,
    alternates: {
      canonical: `/wydarzenie/${event.slug}`
    },
    openGraph: {
      title: `${event.title} - ${event.city}`,
      description: event.short_description ?? event.description ?? undefined,
      images: event.imageUrl ? [{ url: event.imageUrl }] : undefined,
      url: `https://eventmap.pl/wydarzenie/${event.slug}`
    }
  };
}

export default async function EventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const relatedEvents = await getRelatedEvents(event.id, event.category, today.toISOString());

  return <EventDetailView event={event} relatedEvents={relatedEvents} />;
}

async function getRelatedEvents(eventId: string, category: string, dateFrom: string) {
  try {
    return (await listEvents({ dateFrom, limit: 24 }))
      .filter((item) => item.id !== eventId && item.category === category)
      .slice(0, 3);
  } catch (error) {
    console.error("[events] Failed to load related events", error);
    return [];
  }
}
