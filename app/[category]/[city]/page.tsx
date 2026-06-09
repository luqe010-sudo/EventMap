import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
  resolveCityLocation,
  getActiveCityLocations,
  type KnownLocation,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName, formatInCity, toSlug } from "@/lib/slugs";
import { searchAddress } from "@/lib/geocoding";

type Params = { category: string; city: string };
type SearchParams = { lat?: string; lng?: string; radius?: string };

export const dynamic = "force-dynamic";

const dateFilterMap = {
  "dzis": "today",
  "weekend": "weekend",
  "ten-tydzien": "week",
} as const;

export async function generateMetadata({
  params,
  searchParams,
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

  // Handle /{category}/lokalizacja?lat=...&lng=...&radius=...
  if (citySlug === "lokalizacja") {
    const category = await getCategoryBySlugFromDb(categorySlug);
    if (!category) {
      notFound();
    }

    const pluralCategorySlug = toPluralCategorySlug(categorySlug);
    if (categorySlug !== pluralCategorySlug) {
      const sp = await searchParams;
      const qs = new URLSearchParams();
      if (sp.lat) qs.set("lat", sp.lat);
      if (sp.lng) qs.set("lng", sp.lng);
      if (sp.radius) qs.set("radius", sp.radius);
      redirect(`/${pluralCategorySlug}/lokalizacja?${qs.toString()}`);
    }

    const sp = await searchParams;
    const lat = parseFloat(sp.lat ?? "");
    const lng = parseFloat(sp.lng ?? "");
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      redirect(`/${pluralCategorySlug}`);
    }

    const radius = Math.min(Math.max(parseInt(sp.radius ?? "30", 10) || 30, 5), 200);

    const geoLocation: KnownLocation = {
      label: "Wybrana lokalizacja",
      aliases: [],
      latitude: lat,
      longitude: lng,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows, activeCityLocations] = await Promise.all([
      listEvents({ categoryId: category.id, dateFrom: today.toISOString(), limit: 250 }),
      listCategories(),
      getActiveCityLocations(),
    ]);

    return (
      <HomePage
        initialEvents={events}
        initialCategory={category.name}
        initialLocation={geoLocation}
        categoryOptions={categoryRows}
        activeCityLocations={activeCityLocations}
      />
    );
  }

  // 1. Try category + city
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const pluralCategorySlug = toPluralCategorySlug(categorySlug);
    const normalizedCitySlug = toSlug(citySlug);
    if (categorySlug !== pluralCategorySlug || citySlug !== normalizedCitySlug) {
      redirect(`/${pluralCategorySlug}/${normalizedCitySlug}`);
    }

    const cityLocation = await resolveCityLocation(citySlug);
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
        console.error("Failed to geocode fallback city:", err);
      }
      notFound();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows, activeCityLocations] = await Promise.all([
      listEvents({ categoryId: category.id, dateFrom: today.toISOString(), limit: 250 }),
      listCategories(),
      getActiveCityLocations(),
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `${category.name} ${formatInCity(cityLocation.label)} - wydarzenia`,
              description: `Wszystkie wydarzenia z kategorii ${category.name} ${formatInCity(cityLocation.label)} na MapaImprez.pl.`,
              url: `https://mapaimprez.pl/${category.slug}/${citySlug}`
            })
          }}
        />
        <HomePage
          initialEvents={events}
          initialCategory={category.name}
          initialLocation={cityLocation}
          categoryOptions={categoryRows}
          activeCityLocations={activeCityLocations}
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
    if (categorySlug !== normalizedCitySlug) {
      redirect(`/${normalizedCitySlug}/${citySlug}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows, activeCityLocations] = await Promise.all([
      listEvents({ dateFrom: today.toISOString(), limit: 250 }),
      listCategories(),
      getActiveCityLocations(),
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `Wydarzenia ${formatInCity(cityLocation.label)} - imprezy ${citySlug}`,
              description: `Wydarzenia i imprezy ${formatInCity(cityLocation.label)} zaplanowane na ${citySlug}.`,
              url: `https://mapaimprez.pl/${normalizedCitySlug}/${citySlug}`
            })
          }}
        />
        <HomePage
          initialEvents={events}
          initialLocation={cityLocation}
          initialDateFilter={dateFilterMap[citySlug]}
          categoryOptions={categoryRows}
          activeCityLocations={activeCityLocations}
        />
      </>
    );
  } else {
    // Fallback: if categorySlug is not a known city, but citySlug is a time keyword, try geocoding categorySlug
    const isTimeKeyword = citySlug === "dzis" || citySlug === "weekend" || citySlug === "ten-tydzien";
    if (isTimeKeyword) {
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
        console.error("Failed to geocode city+time page fallback:", err);
      }
    }
  }

  // 3. Fallback to 404
  notFound();
}
