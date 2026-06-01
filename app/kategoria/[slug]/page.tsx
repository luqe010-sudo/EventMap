import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventExplorer from "@/components/EventExplorer";
import {
  getCategoryBySlugFromDb,
  getCityPageBySlug,
  listCategories,
  listEvents,
  mapCityPageToLocation
} from "@/lib/events";
import { distanceInKm } from "@/lib/filters";
import { toSlug } from "@/lib/slugs";

type Params = { slug: string };
type SearchParams = { city?: string | string[] };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlugFromDb(slug);
  if (!category) return {};

  return {
    title: `${category.name} - wydarzenia | EventMap`,
    description: `Nadchodzace wydarzenia z kategorii ${category.name}. Filtruj po dacie, miescie i odleglosci.`,
    openGraph: {
      title: `${category.name} - wydarzenia | EventMap`,
      description: `Znajdz wydarzenia z kategorii ${category.name} blisko siebie.`
    }
  };
}

export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { city } = await searchParams;
  const citySlug = typeof city === "string" ? city : null;
  const category = await getCategoryBySlugFromDb(slug);
  if (!category) notFound();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, categoryRows, cityPage] = await Promise.all([
    listEvents({ categoryId: category.id, dateFrom: today.toISOString(), limit: 250 }),
    listCategories(),
    citySlug ? getCityPageBySlug(citySlug) : Promise.resolve(null)
  ]);
  const cityLocation = cityPage ? mapCityPageToLocation(cityPage) : null;
  const scopedEvents = citySlug
    ? events.filter((item) => {
        const sameCity = item.city && toSlug(item.city) === citySlug;
        const nearby = cityLocation ? distanceInKm(cityLocation, item) <= 50 : false;
        return sameCity || nearby;
      })
    : events;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${category.name} - wydarzenia`,
            description: `Wydarzenia z kategorii ${category.name} na EventMap.`,
            url: `https://eventmap.pl/kategoria/${category.slug}`
          })
        }}
      />
      <EventExplorer
        initialEvents={scopedEvents}
        initialLocation={cityLocation ?? undefined}
        initialCategory={category.name}
        categoryOptions={categoryRows.map((item) => item.name)}
      />
    </>
  );
}
