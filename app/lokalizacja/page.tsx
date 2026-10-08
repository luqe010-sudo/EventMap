import { serializeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import { listCategories, getActiveCityLocations, searchPublicEvents, type KnownLocation } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";
import { appendPublicFilters } from "@/lib/slugs";
import { publicSearchOptionsFromParams } from "@/lib/public-search-params";
import { hasLocationCoordinates } from "@/lib/event-search";

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
  const pointSearch = readPointSearch(params);

  if (!pointSearch) {
    return {
      title: "Wydarzenia w okolicy | MapaImprez",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: "Wydarzenia w okolicy | MapaImprez",
    description: `Odkryj wydarzenia w promieniu ${pointSearch.radiusKm ?? 30} km od wybranego punktu.`,
    robots: { index: false, follow: false },
  };
}

export default async function LocationPage({ searchParams }: Props) {
  const params = await searchParams;
  const requestedFilters = parsePublicFilterParams(params);
  const pointSearch = readPointSearch(params);

  if (!pointSearch) {
    redirect(appendPublicFilters("/", { ...requestedFilters, radiusKm: undefined, sortBy: "date" }));
  }

  const radius = pointSearch.radiusKm ?? 30;
  const initialFilters = { ...requestedFilters, radiusKm: radius };

  const geoLocation: KnownLocation = {
    label: "Wybrana lokalizacja",
    aliases: [],
    latitude: pointSearch.location.latitude,
    longitude: pointSearch.location.longitude,
  };

  const [eventSearch, categoryRows, activeCityLocations] = await Promise.all([
    searchPublicEvents({
      location: geoLocation,
      radiusKm: radius,
      dateFilter: initialFilters.dateFilter ?? "all",
      customDate: initialFilters.customDate,
      priceMode: initialFilters.priceMode ?? "all",
      maxPrice: initialFilters.maxPrice,
      sortBy: initialFilters.sortBy
    }),
    listCategories(),
    getActiveCityLocations(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Wydarzenia w okolicy",
            description: `Nadchodzące wydarzenia w promieniu ${radius} km.`,
          }),
        }}
      />
      <HomePage
        initialEvents={eventSearch.events}
        initialEventSearch={eventSearch}
        initialLocation={geoLocation}
        categoryOptions={categoryRows}
        initialFilters={initialFilters}
        activeCityLocations={activeCityLocations}
        availableCategoryCityRoutes={[]}
      />
    </>
  );
}

function readPointSearch(params: Awaited<Props["searchParams"]>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first != null) query.set(key, first);
  }
  try {
    const options = publicSearchOptionsFromParams(query);
    return hasLocationCoordinates(options.location) ? { ...options, location: options.location } : null;
  } catch {
    return null;
  }
}
