import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
  resolveCityLocation,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName, toSlug, formatInCity } from "@/lib/slugs";

type Params = { category: string };

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
        canonical: `/${toSlug(cityLocation.label)}`
      }
    };
  }

  return {};
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { category: categorySlug } = await params;
  
  // 1. Try to resolve as category
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (category) {
    const pluralSlug = toPluralCategorySlug(categorySlug);
    if (categorySlug !== pluralSlug) {
      redirect(`/${pluralSlug}`);
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
              name: `${category.name} - wydarzenia w Polsce`,
              description: `Wszystkie wydarzenia z kategorii ${category.name} w Polsce na MapaImprez.pl.`,
              url: `https://mapaimprez.pl/${category.slug}`
            })
          }}
        />
        <HomePage
          initialEvents={events}
          initialCategory={category.name}
          categoryOptions={categoryRows}
        />
      </>
    );
  }

  // 2. Try to resolve as city
  const cityLocation = await resolveCityLocation(categorySlug);
  if (cityLocation) {
    const normalizedCitySlug = toSlug(cityLocation.label);
    if (categorySlug !== normalizedCitySlug) {
      redirect(`/${normalizedCitySlug}`);
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
              name: `Wydarzenia ${formatInCity(cityLocation.label)} - kalendarz imprez`,
              description: `Wszystkie nadchodzące wydarzenia i imprezy ${formatInCity(cityLocation.label)} na MapaImprez.pl.`,
              url: `https://mapaimprez.pl/${normalizedCitySlug}`
            })
          }}
        />
        <HomePage
          initialEvents={events}
          initialLocation={cityLocation}
          categoryOptions={categoryRows}
        />
      </>
    );
  }

  // 3. Fallback to 404
  notFound();
}

