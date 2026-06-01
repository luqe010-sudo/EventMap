import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventDetailView from "@/components/EventDetailView";
import { getEventBySlug } from "@/lib/events";

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

  return <EventDetailView event={event} />;
}
