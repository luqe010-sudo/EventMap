import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventExplorer from "@/components/EventExplorer";
import {
  listCategories,
  listEvents,
  resolveCityLocation,
} from "@/lib/events";
import { formatInCity, toSlug } from "@/lib/slugs";

type Params = { city: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city: citySlug } = await params;
  const cityLocation = await resolveCityLocation(citySlug);
  if (!cityLocation) return {};

  const locationText = formatInCity(cityLocation.label);
  return {
    title: `Wydarzenia ${locationText} | MapaImprez`,
    description: `Najciekawsze wydarzenia i imprezy ${locationText}. Koncerty, sport, festiwale i kultura. Sprawdź na mapie!`,
    alternates: {
      canonical: `/miasto/${toSlug(cityLocation.label)}`
    }
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { city: citySlug } = await params;

  const normalizedCitySlug = toSlug(citySlug);
  if (citySlug !== normalizedCitySlug) {
    redirect(`/miasto/${normalizedCitySlug}`);
  }

  const cityLocation = await resolveCityLocation(citySlug);
  if (!cityLocation) {
    notFound();
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
            url: `https://mapaimprez.pl/miasto/${citySlug}`
          })
        }}
      />
      <EventExplorer
        initialEvents={events}
        initialLocation={cityLocation}
        categoryOptions={categoryRows.map((item) => item.name)}
      />
    </>
  );
}
