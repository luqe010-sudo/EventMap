import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventExplorer from "@/components/EventExplorer";
import {
  getCityPageBySlug,
  getEventBySlug,
  listCategories,
  listEvents,
  mapCityPageToLocation
} from "@/lib/events";
import { distanceInKm } from "@/lib/filters";
import { toSlug } from "@/lib/slugs";

type Params = { city: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city: slug } = await params;
  const cityPage = await getCityPageBySlug(slug);

  if (cityPage) {
    return {
      title: cityPage.meta_title ?? `Wydarzenia ${cityPage.city} | EventMap`,
      description: cityPage.meta_description ?? `Nadchodzace wydarzenia w miescie ${cityPage.city} i okolicy.`,
      openGraph: {
        title: cityPage.meta_title ?? `Wydarzenia ${cityPage.city}`,
        description: cityPage.meta_description ?? undefined,
        url: `https://eventmap.pl/wydarzenia/${cityPage.slug}`
      }
    };
  }

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

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { city: slug } = await params;
  const cityPage = await getCityPageBySlug(slug);

  if (!cityPage) {
    const event = await getEventBySlug(slug);
    if (event) redirect(`/wydarzenie/${event.slug}`);
    notFound();
  }

  const location = mapCityPageToLocation(cityPage);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, categoryRows] = await Promise.all([
    listEvents({ dateFrom: today.toISOString(), limit: 250 }),
    listCategories()
  ]);

  const nearbyEvents = events.filter((item) => {
    const sameCity = item.city && toSlug(item.city) === cityPage.slug;
    const nearby = distanceInKm(location, item) <= 50;
    return sameCity || nearby;
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: cityPage.meta_title ?? `Wydarzenia ${cityPage.city}`,
            description: cityPage.meta_description ?? cityPage.intro_text,
            url: `https://eventmap.pl/wydarzenia/${cityPage.slug}`
          })
        }}
      />
      <EventExplorer
        initialEvents={nearbyEvents}
        initialLocation={location}
        categoryOptions={categoryRows.map((item) => item.name)}
      />
    </>
  );
}
