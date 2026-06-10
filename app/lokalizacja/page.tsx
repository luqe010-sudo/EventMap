import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import { listCategories, listEvents, getActiveCityLocations, type KnownLocation } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    lat?: string;
    lng?: string;
    radius?: string;
    kategoria?: string;
  } & Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const lat = parseFloat(params.lat ?? "");
  const lng = parseFloat(params.lng ?? "");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return {
      title: "Wydarzenia w okolicy | MapaImprez",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: "Wydarzenia w okolicy | MapaImprez",
    description: `Odkryj wydarzenia w promieniu ${params.radius ?? 30} km od wybranego punktu.`,
    robots: { index: false, follow: false },
  };
}

export default async function LocationPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialFilters = parsePublicFilterParams(params);
  const lat = parseFloat(params.lat ?? "");
  const lng = parseFloat(params.lng ?? "");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    redirect("/");
  }

  const radius = Math.min(Math.max(parseInt(params.radius ?? "30", 10) || 30, 5), 200);

  const geoLocation: KnownLocation = {
    label: "Wybrana lokalizacja",
    aliases: [],
    latitude: lat,
    longitude: lng,
  };

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
            name: "Wydarzenia w okolicy",
            description: `Nadchodzące wydarzenia w promieniu ${radius} km.`,
          }),
        }}
      />
      <HomePage
        initialEvents={events}
        initialLocation={geoLocation}
        categoryOptions={categoryRows}
        initialFilters={initialFilters}
        activeCityLocations={activeCityLocations}
      />
    </>
  );
}
