import { listingMetadata } from "@/lib/listing-metadata";
import { redirectLowercasePath } from "@/lib/canonical-path";
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
} from "@/lib/events";
import { appendPublicFilters, toPluralCategorySlug, toPluralCategoryName, toSlug, formatInCity } from "@/lib/slugs";
import { parsePublicFilterParams } from "@/lib/filters";
import { normalizeCitySearchFilters } from "@/lib/public-search-params";

type Params = { category: string };
type SearchParams = Record<string, string | string[] | undefined>;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug } = await params;
  
  // 1. Try category
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const pluralName = toPluralCategoryName(category.name);
    return listingMetadata({
      title: `${pluralName} w Polsce | MapaImprez`,
      description: `Nadchodzące wydarzenia z kategorii ${pluralName} w Polsce. Filtruj po dacie, mieście i odległości.`,
      alternates: {
        canonical: `/${toPluralCategorySlug(category.slug)}`
      }
    });
  }

  // 2. Try city
  const cityLocation = await resolveCityLocation(categorySlug);
  if (cityLocation) {
    const locationText = formatInCity(cityLocation.label);
    return listingMetadata({
      title: `Wydarzenia ${locationText} | MapaImprez`,
      description: `Najciekawsze wydarzenia i imprezy ${locationText}. Koncerty, sport, festiwale i kultura. Sprawdź na mapie!`,
      alternates: {
        canonical: `/${cityLocation.slug ?? toSlug(cityLocation.label)}`
      }
    });
  }

  return {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { category: categorySlug } = await params;
  const rawSearchParams = await searchParams;
  redirectLowercasePath([categorySlug], rawSearchParams);
  const requestedFilters = parsePublicFilterParams(rawSearchParams);
  
  // 1. Try to resolve as category
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const initialFilters = { ...requestedFilters, radiusKm: undefined, sortBy: "date" as const };
    const pluralSlug = toPluralCategorySlug(category.slug);
    if (categorySlug !== pluralSlug) {
      redirect(appendPublicFilters(`/${pluralSlug}`, initialFilters));
    }

    const [eventSearch, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      searchPublicEvents({
        categoryId: category.id,
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
              name: `${category.name} - wydarzenia w Polsce`,
              description: `Wszystkie wydarzenia z kategorii ${category.name} w Polsce na MapaImprez.pl.`,
              url: `https://mapaimprez.pl/${category.slug}`
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Strona główna", item: "https://mapaimprez.pl" },
                { "@type": "ListItem", position: 2, name: toPluralCategoryName(category.name), item: `https://mapaimprez.pl/${toPluralCategorySlug(category.slug)}` },
              ],
            })
          }}
        />
        <HomePage
          initialEvents={eventSearch.events}
          initialEventSearch={eventSearch}
          initialCategory={category.name}
          categoryOptions={categoryRows}
          initialFilters={initialFilters}
          activeCityLocations={activeCityLocations}
          availableCategoryCityRoutes={availableCategoryCityRoutes}
        />
      </>
    );
  }

  // 2. Try to resolve as city
  const cityLocation = await resolveCityLocation(categorySlug);
  if (cityLocation) {
    const initialFilters = normalizeCitySearchFilters(requestedFilters, cityLocation);
    const normalizedCitySlug = cityLocation.slug ?? toSlug(cityLocation.label);
    if (categorySlug !== normalizedCitySlug) {
      redirect(appendPublicFilters(`/${normalizedCitySlug}`, initialFilters));
    }

    const [eventSearch, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      searchPublicEvents({
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
              name: `Wydarzenia ${formatInCity(cityLocation.label)} - kalendarz imprez`,
              description: `Wszystkie nadchodzące wydarzenia i imprezy ${formatInCity(cityLocation.label)} na MapaImprez.pl.`,
              url: `https://mapaimprez.pl/${normalizedCitySlug}`
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Strona główna", item: "https://mapaimprez.pl" },
                { "@type": "ListItem", position: 2, name: `Wydarzenia ${formatInCity(cityLocation.label)}`, item: `https://mapaimprez.pl/${normalizedCitySlug}` },
              ],
            })
          }}
        />
        <HomePage
          initialEvents={eventSearch.events}
          initialEventSearch={eventSearch}
          initialLocation={cityLocation}
          categoryOptions={categoryRows}
          initialFilters={initialFilters}
          activeCityLocations={activeCityLocations}
          availableCategoryCityRoutes={availableCategoryCityRoutes}
        />
      </>
    );
  }

  // 3. Fallback to 404
  notFound();
}
