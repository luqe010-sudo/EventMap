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
  type CategoryCityRoute,
  type KnownLocation,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName, formatInCity, toSlug, eventPath } from "@/lib/slugs";
import { searchAddress } from "@/lib/geocoding";
import { parsePublicFilterParams } from "@/lib/filters";
import { getEventSaveState } from "@/lib/user-account";

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
  const initialFilters = parsePublicFilterParams(await searchParams);

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

    const dateFilterMap = {
      "dzis": "today",
      "weekend": "weekend",
      "ten-tydzien": "week",
    } as const;

    const [eventSearch, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      searchPublicEvents({
        categoryId: category.id,
        citySlug,
        dateFilter: initialFilters.dateFilter ?? dateFilterMap[eventOrTime],
        customDate: initialFilters.customDate,
        priceMode: initialFilters.priceMode ?? "all",
        maxPrice: initialFilters.maxPrice
      }),
      listCategories(),
      getActiveCityLocations(),
      listPublicCategoryCityRoutes({ dateFrom: new Date().toISOString(), limit: 10000 }),
    ]);

    if (!hasCategoryCityRoute(availableCategoryCityRoutes, pluralCategorySlug, cityLocation)) {
      redirectToCategoryLocation(pluralCategorySlug, cityLocation);
    }

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
    redirect(canonPath);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [allEventsForCategory, saveState] = await Promise.all([
    listEvents({
      categoryId: event.categoryRelation?.id,
      dateFrom: today.toISOString(),
      limit: 50,
    }),
    getEventSaveState(event.id)
  ]);

  const relatedEvents = allEventsForCategory
    .filter((e) => e.id !== event.id)
    .slice(0, 3);

  return <EventDetailView event={event} relatedEvents={relatedEvents} saveState={saveState} />;
}

function hasCategoryCityRoute(routes: CategoryCityRoute[], categorySlug: string, cityLocation: KnownLocation) {
  const citySlug = cityLocation.slug ?? toSlug(cityLocation.label);
  return routes.some((route) => route.categorySlug === categorySlug && route.citySlug === citySlug);
}

function redirectToCategoryLocation(categorySlug: string, cityLocation: KnownLocation) {
  const query = new URLSearchParams();
  query.set("lat", String(Math.round(cityLocation.latitude * 1000) / 1000));
  query.set("lng", String(Math.round(cityLocation.longitude * 1000) / 1000));
  query.set("radius", "30");

  redirect(`/${categorySlug}/lokalizacja?${query.toString()}`);
}
