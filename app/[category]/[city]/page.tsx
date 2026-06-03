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

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug, city: citySlug } = await params;
  const [category, cityLocation] = await Promise.all([
    getCategoryBySlugFromDb(categorySlug),
    resolveCityLocation(citySlug),
  ]);

  if (!category || !cityLocation) return {};

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

export default async function CategoryCityPage({ params }: { params: Promise<Params> }) {
  const { category: categorySlug, city: citySlug } = await params;

  const pluralCategorySlug = toPluralCategorySlug(categorySlug);
  const normalizedCitySlug = toSlug(citySlug);
  if (categorySlug !== pluralCategorySlug || citySlug !== normalizedCitySlug) {
    redirect(`/${pluralCategorySlug}/${normalizedCitySlug}`);
  }

  const [category, cityLocation] = await Promise.all([
    getCategoryBySlugFromDb(categorySlug),
    resolveCityLocation(citySlug),
  ]);

  if (!category || !cityLocation) {
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
