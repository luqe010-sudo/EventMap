import { serializeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listPublicCategoryCityRoutes,
  resolveCityLocation,
  getActiveCityLocations,
  searchPublicEvents,
  type KnownLocation,
} from "@/lib/events";
import { appendPublicFilters, buildSearchUrl, toPluralCategorySlug, toPluralCategoryName, formatInCity, toSlug } from "@/lib/slugs";
import { searchAddress } from "@/lib/geocoding";
import { parsePublicFilterParams } from "@/lib/filters";
import { normalizeCitySearchFilters, publicSearchOptionsFromParams } from "@/lib/public-search-params";
import { hasLocationCoordinates } from "@/lib/event-search";

type Params = { category: string; city: string };
type SearchParams = {
  lat?: string;
  lng?: string;
  radius?: string;
} & Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

const dateFilterMap = {
  "dzis": "today",
  "weekend": "weekend",
  "ten-tydzien": "week",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { category: categorySlug, city: citySlug } = await params;

  // Handle /{category}/lokalizacja?lat=...&lng=...
  if (citySlug === "lokalizacja") {
    const category = await getCategoryBySlugFromDb(categorySlug);
    if (!category) return {};
    const pluralName = toPluralCategoryName(category.name);
    return {
      title: `${pluralName} w okolicy | MapaImprez`,
      description: `Odkryj wydarzenia z kategorii ${pluralName} w pobliżu wybranego punktu.`,
      robots: { index: false, follow: false },
    };
  }

  // 1. Try category + city
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const cityLocation = await resolveCityLocation(citySlug);
    if (!cityLocation) return {};

    const pluralCategory = toPluralCategoryName(category.name);
    const locationText = formatInCity(cityLocation.label);
    return {
      title: `${pluralCategory} ${locationText} | MapaImprez`,
      description: `Nadchodzące wydarzenia z kategorii ${pluralCategory} ${locationText}. Filtruj po dacie, odległości i cenie.`,
      alternates: {
        canonical: `/${toPluralCategorySlug(category.slug)}/${cityLocation.slug ?? toSlug(cityLocation.label)}`
      }
    };
  }

  // 2. Try city + time
  const cityLocation = await resolveCityLocation(categorySlug);
  if (cityLocation) {
    const isTimeKeyword = citySlug === "dzis" || citySlug === "weekend" || citySlug === "ten-tydzien";
    if (!isTimeKeyword) return {};

    const locationText = formatInCity(cityLocation.label);
    const timeLabel = citySlug === "dzis" ? "dzisiaj" : citySlug === "weekend" ? "w weekend" : "w tym tygodniu";

    return {
      title: `Wydarzenia ${locationText} ${timeLabel} | MapaImprez`,
      description: `Imprezy i wydarzenia ${locationText} zaplanowane ${timeLabel}. Koncerty, teatr, sport. Sprawdź co robić ${timeLabel}!`,
      alternates: {
        canonical: `/${cityLocation.slug ?? toSlug(cityLocation.label)}/${citySlug}`
      }
    };
  }

  return {};
}

export default async function CategoryCityPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { category: categorySlug, city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedFilters = parsePublicFilterParams(resolvedSearchParams);

  // Handle /{category}/lokalizacja?lat=...&lng=...&radius=...
  if (citySlug === "lokalizacja") {
    const category = await getCategoryBySlugFromDb(categorySlug);
    if (!category) {
      notFound();
    }

    const pluralCategorySlug = toPluralCategorySlug(category.slug);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (first != null) query.set(key, first);
    }
    let pointOptions: ReturnType<typeof publicSearchOptionsFromParams> | null = null;
    try {
      pointOptions = publicSearchOptionsFromParams(query);
    } catch {
      // Invalid points return to the category without a radius or distance sort.
    }
    const point = pointOptions?.location;
    if (!hasLocationCoordinates(point)) {
      redirect(appendPublicFilters(`/${pluralCategorySlug}`, { ...requestedFilters, radiusKm: undefined, sortBy: "date" }));
    }
    const radius = pointOptions?.radiusKm ?? 30;
    const initialFilters = { ...requestedFilters, radiusKm: radius };
    if (categorySlug !== pluralCategorySlug) {
      redirect(buildSearchUrl({
        ...initialFilters,
        categorySlug: pluralCategorySlug,
        geoLocation: { lat: point.latitude, lng: point.longitude, radius }
      }));
    }

    const geoLocation: KnownLocation = {
      label: "Wybrana lokalizacja",
      aliases: [],
      latitude: point.latitude,
      longitude: point.longitude,
    };

    const [eventSearch, categoryRows, activeCityLocations] = await Promise.all([
      searchPublicEvents({
        categoryId: category.id,
        location: geoLocation,
        radiusKm: radius,
        dateFilter: initialFilters.dateFilter ?? "all",
        customDate: initialFilters.customDate,
        priceMode: initialFilters.priceMode ?? "all",
        maxPrice: initialFilters.maxPrice,
        sortBy: initialFilters.sortBy
      }),
      listCategories(),
      getActiveCityLocations(),
    ]);

    return (
      <HomePage
        initialEvents={eventSearch.events}
        initialEventSearch={eventSearch}
        initialCategory={category.name}
        initialLocation={geoLocation}
        categoryOptions={categoryRows}
        initialFilters={initialFilters}
        activeCityLocations={activeCityLocations}
        availableCategoryCityRoutes={[]}
      />
    );
  }

  // 1. Try category + city
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const pluralCategorySlug = toPluralCategorySlug(category.slug);

    const cityLocation = await resolveCityLocation(citySlug);
    if (!cityLocation) {
      // Try to geocode the citySlug as a fallback
      let geocoded: Awaited<ReturnType<typeof searchAddress>> = [];
      try {
        const query = citySlug.replace(/-/g, " ");
        geocoded = await searchAddress(query);
      } catch (err) {
        console.error("Failed to geocode fallback city:", err);
      }
      const best = geocoded.find(hasLocationCoordinates);
      if (best) {
        redirect(buildSearchUrl({
          ...requestedFilters,
          categorySlug: pluralCategorySlug,
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
      redirect(appendPublicFilters(`/${pluralCategorySlug}/${normalizedCitySlug}`, initialFilters));
    }

    const [eventSearch, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      searchPublicEvents({
        categoryId: category.id,
        citySlug: normalizedCitySlug,
        radiusKm: initialFilters.radiusKm,
        dateFilter: initialFilters.dateFilter ?? "all",
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
              name: `${category.name} ${formatInCity(cityLocation.label)} - wydarzenia`,
              description: `Wszystkie wydarzenia z kategorii ${category.name} ${formatInCity(cityLocation.label)} na MapaImprez.pl.`,
              url: `https://mapaimprez.pl/${category.slug}/${citySlug}`
            })
          }}
      />
        <HomePage
          initialEvents={eventSearch.events}
          initialEventSearch={eventSearch}
          initialCategory={category.name}
          initialLocation={cityLocation}
          categoryOptions={categoryRows}
          initialFilters={initialFilters}
          activeCityLocations={activeCityLocations}
          availableCategoryCityRoutes={availableCategoryCityRoutes}
        />
      </>
    );
  }

  // 2. Try city + time keyword
  const cityLocation = await resolveCityLocation(categorySlug);
  if (cityLocation) {
    const isTimeKeyword = citySlug === "dzis" || citySlug === "weekend" || citySlug === "ten-tydzien";
    if (!isTimeKeyword) {
      notFound();
    }

    const normalizedCitySlug = cityLocation.slug ?? toSlug(cityLocation.label);
    const initialFilters = normalizeCitySearchFilters(requestedFilters, cityLocation);
    if (categorySlug !== normalizedCitySlug) {
      redirect(appendPublicFilters(`/${normalizedCitySlug}/${citySlug}`, initialFilters));
    }

    const [eventSearch, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      searchPublicEvents({
        citySlug: normalizedCitySlug,
        radiusKm: initialFilters.radiusKm,
        dateFilter: initialFilters.dateFilter ?? dateFilterMap[citySlug],
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
              name: `Wydarzenia ${formatInCity(cityLocation.label)} - imprezy ${citySlug}`,
              description: `Wydarzenia i imprezy ${formatInCity(cityLocation.label)} zaplanowane na ${citySlug}.`,
              url: `https://mapaimprez.pl/${normalizedCitySlug}/${citySlug}`
            })
          }}
        />
        <HomePage
          initialEvents={eventSearch.events}
          initialEventSearch={eventSearch}
          initialLocation={cityLocation}
          initialDateFilter={dateFilterMap[citySlug]}
          categoryOptions={categoryRows}
          initialFilters={initialFilters}
          activeCityLocations={activeCityLocations}
          availableCategoryCityRoutes={availableCategoryCityRoutes}
        />
      </>
    );
  } else {
    // Fallback: if categorySlug is not a known city, but citySlug is a time keyword, try geocoding categorySlug
    const isTimeKeyword = citySlug === "dzis" || citySlug === "weekend" || citySlug === "ten-tydzien";
    if (isTimeKeyword) {
      let geocoded: Awaited<ReturnType<typeof searchAddress>> = [];
      try {
        const query = categorySlug.replace(/-/g, " ");
        geocoded = await searchAddress(query);
      } catch (err) {
        console.error("Failed to geocode city+time page fallback:", err);
      }
      const best = geocoded.find(hasLocationCoordinates);
      if (best) {
        redirect(buildSearchUrl({
          ...requestedFilters,
          dateFilter: requestedFilters.dateFilter ?? dateFilterMap[citySlug],
          geoLocation: {
            lat: Math.round(best.latitude * 1000) / 1000,
            lng: Math.round(best.longitude * 1000) / 1000,
            radius: requestedFilters.radiusKm ?? 30
          }
        }));
      }
    }
  }

  // 3. Fallback to 404
  notFound();
}
