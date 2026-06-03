import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
  resolveCityLocation,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName, formatInCity, toSlug } from "@/lib/slugs";

type Params = { category: string; city: string };

export const dynamic = "force-dynamic";

const dateFilterMap = {
  "dzis": "today",
  "weekend": "weekend",
  "ten-tydzien": "week",
} as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug, city: citySlug } = await params;
  
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
        canonical: `/${toPluralCategorySlug(category.slug)}/${toSlug(cityLocation.label)}`
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
        canonical: `/${toSlug(cityLocation.label)}/${citySlug}`
      }
    };
  }

  return {};
}

export default async function CategoryCityPage({ params }: { params: Promise<Params> }) {
  const { category: categorySlug, city: citySlug } = await params;

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
      notFound();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows] = await Promise.all([
      listEvents({ categoryId: category.id, dateFrom: today.toISOString(), limit: 250 }),
      listCategories()
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

    const normalizedCitySlug = toSlug(cityLocation.label);
    if (categorySlug !== normalizedCitySlug) {
      redirect(`/${normalizedCitySlug}/${citySlug}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [events, categoryRows] = await Promise.all([
      listEvents({ dateFrom: today.toISOString(), limit: 250 }),
      listCategories()
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
        />
      </>
    );
  }

  // 3. Fallback to 404
  notFound();
}

