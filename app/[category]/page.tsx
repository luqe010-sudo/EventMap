import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventExplorer from "@/components/EventExplorer";
import {
  getCategoryBySlugFromDb,
  listCategories,
  listEvents,
} from "@/lib/events";
import { toPluralCategorySlug, toPluralCategoryName } from "@/lib/slugs";

type Params = { category: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlugFromDb(categorySlug);
  if (!category) return {};

  const pluralName = toPluralCategoryName(category.name);
  return {
    title: `${pluralName} w Polsce | MapaImprez`,
    description: `Nadchodzące wydarzenia z kategorii ${pluralName} w Polsce. Filtruj po dacie, mieście i odległości.`,
    alternates: {
      canonical: `/${toPluralCategorySlug(category.slug)}`
    }
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { category: categorySlug } = await params;
  
  // Przekierowanie z liczby pojedynczej na liczbę mnogą w URL
  const pluralSlug = toPluralCategorySlug(categorySlug);
  if (categorySlug !== pluralSlug) {
    redirect(`/${pluralSlug}`);
  }

  const category = await getCategoryBySlugFromDb(categorySlug);
  if (!category) notFound();

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
      <EventExplorer
        initialEvents={events}
        initialCategory={category.name}
        categoryOptions={categoryRows.map((item) => item.name)}
      />
    </>
  );
}
