import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
  listPublicCategoryCityRoutes,
  resolveCityLocation,
  getActiveCityLocations,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName, toSlug, formatInCity } from "@/lib/slugs";
import { searchAddress } from "@/lib/geocoding";
import { parsePublicFilterParams } from "@/lib/filters";

type Params = { category: string };
type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug } = await params;
  
  // 1. Try category
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const pluralName = toPluralCategoryName(category.name);
    return {
      title: `${pluralName} w Polsce | MapaImprez`,
      description: `Nadchodzące wydarzenia z kategorii ${pluralName} w Polsce. Filtruj po dacie, mieście i odległości.`,
      alternates: {
        canonical: `/${toPluralCategorySlug(category.slug)}`
      }
    };
  }

  // 2. Try city
  const cityLocation = await resolveCityLocation(categorySlug);
  if (cityLocation) {
    const locationText = formatInCity(cityLocation.label);
    return {
      title: `Wydarzenia ${locationText} | MapaImprez`,
      description: `Najciekawsze wydarzenia i imprezy ${locationText}. Koncerty, sport, festiwale i kultura. Sprawdź na mapie!`,
      alternates: {
        canonical: `/${cityLocation.slug ?? toSlug(cityLocation.label)}`
      }
    };
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
  const initialFilters = parsePublicFilterParams(await searchParams);
  
  // 1. Try to resolve as category
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const pluralSlug = toPluralCategorySlug(categorySlug);
    if (categorySlug !== pluralSlug) {
      redirect(`/${pluralSlug}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      listEvents({ categoryId: category.id, dateFrom: today.toISOString(), limit: 250 }),
      listCategories(),
      getActiveCityLocations(),
      listPublicCategoryCityRoutes({ dateFrom: today.toISOString(), limit: 10000 }),
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
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
            __html: JSON.stringify({
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
          initialEvents={events}
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
    const normalizedCitySlug = cityLocation.slug ?? toSlug(cityLocation.label);
    if (categorySlug !== normalizedCitySlug) {
      redirect(`/${normalizedCitySlug}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows, activeCityLocations, availableCategoryCityRoutes] = await Promise.all([
      listEvents({ dateFrom: today.toISOString(), limit: 250 }),
      listCategories(),
      getActiveCityLocations(),
      listPublicCategoryCityRoutes({ dateFrom: today.toISOString(), limit: 10000 }),
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
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
            __html: JSON.stringify({
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
          initialEvents={events}
          initialLocation={cityLocation}
          categoryOptions={categoryRows}
          initialFilters={initialFilters}
          activeCityLocations={activeCityLocations}
          availableCategoryCityRoutes={availableCategoryCityRoutes}
        />
      </>
    );
  }

  // Try to geocode categorySlug as a fallback city
  try {
    const query = categorySlug.replace(/-/g, " ");
    const geocoded = await searchAddress(query);
    if (geocoded && geocoded.length > 0) {
      const best = geocoded[0];
      const lat = Math.round(best.latitude * 1000) / 1000;
      const lng = Math.round(best.longitude * 1000) / 1000;
      redirect(`/lokalizacja?lat=${lat}&lng=${lng}&radius=30`);
    }
  } catch (err) {
    console.error("Failed to geocode single segment city page fallback:", err);
  }

  // 3. Fallback to 404
  notFound();
}
