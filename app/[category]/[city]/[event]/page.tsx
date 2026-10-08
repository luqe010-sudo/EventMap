import { serializeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import EventDetailView from "@/components/EventDetailView";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
  listPublicCategoryCityRoutes,
  resolveCityLocation,
  getEventBySlug,
  getActiveCityLocations,
  searchPublicEvents,
} from "@/lib/events";
import { appendPublicFilters, buildSearchUrl, toPluralCategorySlug, toPluralCategoryName, formatInCity, toSlug, eventPath } from "@/lib/slugs";
import { searchAddress } from "@/lib/geocoding";
import { parsePublicFilterParams } from "@/lib/filters";
import { normalizeCitySearchFilters } from "@/lib/public-search-params";
import { hasLocationCoordinates } from "@/lib/event-search";

type Params = { category: string; city: string; event: string };
type SearchParams = Record<string, string | string[] | undefined>;
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
    openGraph: {
      title: `${event.title} | MapaImprez`,
      description: event.short_description || event.description || `Wydarzenie ${event.title} w miejscowości ${event.city}.`,
      url: `https://mapaimprez.pl${eventPath(event)}`,
      type: "article",
      ...(event.imageUrl ? {
        images: [{
          url: event.imageUrl,
          width: 1200,
          height: 630,
          alt: event.title,
        }],
      } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${event.title} | MapaImprez`,
      description: event.short_description || event.description || `Wydarzenie ${event.title} w miejscowości ${event.city}.`,
      ...(event.imageUrl ? { images: [event.imageUrl] } : {}),
    },
  };
}

export default async function EventOrTimePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { category: categorySlug, city: citySlug, event: eventOrTime } = await params;
  const requestedFilters = parsePublicFilterParams(await searchParams);

  const isTimeKeyword = eventOrTime === "dzis" || eventOrTime === "weekend" || eventOrTime === "ten-tydzien";

  if (isTimeKeyword) {
    const [category, cityLocation] = await Promise.all([
      getCategoryBySlugFromDb(categorySlug),
      resolveCityLocation(citySlug),
    ]);

    if (!category) {
      notFound();
    }
    const pluralCategorySlug = toPluralCategorySlug(category.slug);
    const dateFilterMap = {
      "dzis": "today",
      "weekend": "weekend",
      "ten-tydzien": "week",
    } as const;

    if (!cityLocation) {
      // Try to geocode the citySlug as a fallback
      let geocoded: Awaited<ReturnType<typeof searchAddress>> = [];
      try {
        const query = citySlug.replace(/-/g, " ");
        geocoded = await searchAddress(query);
      } catch (err) {
        console.error("Failed to geocode fallback city for event or time page:", err);
      }
      const best = geocoded.find(hasLocationCoordinates);
      if (best) {
        redirect(buildSearchUrl({
          ...requestedFilters,
          categorySlug: pluralCategorySlug,
          dateFilter: requestedFilters.dateFilter ?? dateFilterMap[eventOrTime],
          geoLocation: {
            lat: Math.round(best.latitude * 1000) / 1000,
            lng: Math.round(best.longitude * 1000) / 1000,
            radius: requestedFilters.radiusKm ?? 30
          }
        }));
      }
      notFound();
    }
    const initialFilters = normalizeCitySearchFilters(requestedFilters, cityLocation);
    const normalizedCitySlug = cityLocation.slug ?? toSlug(cityLocation.label);
    if (categorySlug !== pluralCategorySlug || citySlug !== normalizedCitySlug) {
      redirect(appendPublicFilters(`/${pluralCategorySlug}/${normalizedCitySlug}/${eventOrTime}`, initialFilters));
    }

    const [eventSearch, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      searchPublicEvents({
        categoryId: category.id,
        citySlug: normalizedCitySlug,
        radiusKm: initialFilters.radiusKm,
        dateFilter: initialFilters.dateFilter ?? dateFilterMap[eventOrTime],
        customDate: initialFilters.customDate,
        priceMode: initialFilters.priceMode ?? "all",
        maxPrice: initialFilters.maxPrice,
        sortBy: initialFilters.sortBy
      }),
      listCategories(),
      getActiveCityLocations(),
      listPublicCategoryCityRoutes({ dateFrom: new Date().toISOString(), limit: 10000 }),
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `${category.name} ${formatInCity(cityLocation.label)} - wydarzenia ${eventOrTime}`,
              description: `Wydarzenia z kategorii ${category.name} ${formatInCity(cityLocation.label)} na ${eventOrTime}.`,
              url: `https://mapaimprez.pl/${category.slug}/${citySlug}/${eventOrTime}`
            })
          }}
        />
        <HomePage
          initialEvents={eventSearch.events}
          initialEventSearch={eventSearch}
          initialCategory={category.name}
          initialLocation={cityLocation}
          initialDateFilter={dateFilterMap[eventOrTime]}
          categoryOptions={categoryRows}
          initialFilters={initialFilters}
          activeCityLocations={activeCityLocations}
          availableCategoryCityRoutes={availableCategoryCityRoutes}
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
    redirect(appendPublicFilters(canonPath, requestedFilters));
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
