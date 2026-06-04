import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import EventDetailView from "@/components/EventDetailView";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
  resolveCityLocation,
  getEventBySlug,
  getActiveCitySlugs,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName, formatInCity, toSlug, eventPath } from "@/lib/slugs";
import { searchAddress } from "@/lib/geocoding";

type Params = { category: string; city: string; event: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug, city: citySlug, event: eventOrTime } = await params;

  const isTimeKeyword = eventOrTime === "dzis" || eventOrTime === "weekend" || eventOrTime === "ten-tydzien";

  if (isTimeKeyword) {
    const [category, cityLocation] = await Promise.all([
      getCategoryBySlugFromDb(categorySlug),
      resolveCityLocation(citySlug),
    ]);
    if (!category || !cityLocation) return {};

    const pluralCategory = toPluralCategoryName(category.name);
    const locationText = formatInCity(cityLocation.label);
    const timeLabel = eventOrTime === "dzis" ? "dzisiaj" : eventOrTime === "weekend" ? "w weekend" : "w tym tygodniu";
    return {
      title: `${pluralCategory} ${locationText} - wydarzenia ${timeLabel} | MapaImprez`,
      description: `Wydarzenia z kategorii ${pluralCategory} ${locationText} zaplanowane ${timeLabel}. Sprawdź kalendarz i mapę.`,
      alternates: {
        canonical: `/${toPluralCategorySlug(category.slug)}/${cityLocation.slug ?? toSlug(cityLocation.label)}/${eventOrTime}`
      }
    };
  }

  const event = await getEventBySlug(eventOrTime);
  if (!event) return {};

  return {
    title: `${event.title} | MapaImprez`,
    description: event.short_description || event.description || `Wydarzenie ${event.title} w miejscowości ${event.city}.`,
    alternates: {
      canonical: eventPath(event),
    },
  };
}

export default async function EventOrTimePage({ params }: { params: Promise<Params> }) {
  const { category: categorySlug, city: citySlug, event: eventOrTime } = await params;

  const isTimeKeyword = eventOrTime === "dzis" || eventOrTime === "weekend" || eventOrTime === "ten-tydzien";

  if (isTimeKeyword) {
    const pluralCategorySlug = toPluralCategorySlug(categorySlug);
    const normalizedCitySlug = toSlug(citySlug);
    if (categorySlug !== pluralCategorySlug || citySlug !== normalizedCitySlug) {
      redirect(`/${pluralCategorySlug}/${normalizedCitySlug}/${eventOrTime}`);
    }

    const [category, cityLocation] = await Promise.all([
      getCategoryBySlugFromDb(categorySlug),
      resolveCityLocation(citySlug),
    ]);

    if (!category) {
      notFound();
    }

    if (!cityLocation) {
      // Try to geocode the citySlug as a fallback
      try {
        const query = citySlug.replace(/-/g, " ");
        const geocoded = await searchAddress(query);
        if (geocoded && geocoded.length > 0) {
          const best = geocoded[0];
          const lat = Math.round(best.latitude * 1000) / 1000;
          const lng = Math.round(best.longitude * 1000) / 1000;
          redirect(`/${pluralCategorySlug}/lokalizacja?lat=${lat}&lng=${lng}&radius=30`);
        }
      } catch (err) {
        console.error("Failed to geocode fallback city for event or time page:", err);
      }
      notFound();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows, activeCitySlugs] = await Promise.all([
      listEvents({ categoryId: category.id, dateFrom: today.toISOString(), limit: 250 }),
      listCategories(),
      getActiveCitySlugs(),
    ]);

    const dateFilterMap = {
      "dzis": "today",
      "weekend": "weekend",
      "ten-tydzien": "week",
    } as const;

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `${category.name} ${formatInCity(cityLocation.label)} - wydarzenia ${eventOrTime}`,
              description: `Wydarzenia z kategorii ${category.name} ${formatInCity(cityLocation.label)} na ${eventOrTime}.`,
              url: `https://mapaimprez.pl/${category.slug}/${citySlug}/${eventOrTime}`
            })
          }}
        />
        <HomePage
          initialEvents={events}
          initialCategory={category.name}
          initialLocation={cityLocation}
          initialDateFilter={dateFilterMap[eventOrTime]}
          categoryOptions={categoryRows}
          activeCitySlugs={activeCitySlugs}
        />
      </>
    );
  }

  const event = await getEventBySlug(eventOrTime);
  if (!event) {
    notFound();
  }

  const canonPath = eventPath(event);
  const currentPath = `/${categorySlug}/${citySlug}/${eventOrTime}`;
  if (currentPath !== canonPath) {
    redirect(canonPath);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allEventsForCategory = await listEvents({
    categoryId: event.categoryRelation?.id,
    dateFrom: today.toISOString(),
    limit: 50,
  });

  const relatedEvents = allEventsForCategory
    .filter((e) => e.id !== event.id)
    .slice(0, 3);

  return <EventDetailView event={event} relatedEvents={relatedEvents} />;
}
