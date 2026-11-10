import { Suspense } from "react";
import HomeLoading from "@/components/HomeLoading";
import HomePage from "@/components/HomePage";
import { getHomeData } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";
import type { Metadata } from "next";
import { listingMetadata } from "@/lib/listing-metadata";

export const dynamic = "force-dynamic";

const HOME_TITLE = "Kalendarz imprez w Polsce – imprezy w okolicy dziś | MapaImprez.pl";
const HOME_DESCRIPTION = "Imprezy, koncerty i festyny w Twojej okolicy – dziś, w weekend i w najbliższych dniach. Kalendarz wydarzeń w Polsce na mapie: filtruj po mieście, dacie i cenie.";

export const metadata: Metadata = listingMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
});

type SearchParams = Record<string, string | string[] | undefined>;

async function HomeContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const initialFilters = parsePublicFilterParams(await searchParams);
  const { events, featuredEvents, eventSearch, categories, activeCityLocations } = await getHomeData({
    dateFilter: initialFilters.dateFilter ?? "all",
    customDate: initialFilters.customDate,
    priceMode: initialFilters.priceMode ?? "all",
    maxPrice: initialFilters.maxPrice,
    sortBy: "date"
  });

  return (
    <HomePage
      initialEvents={events}
      initialFeaturedEvents={featuredEvents}
      initialEventSearch={eventSearch}
      categoryOptions={categories}
      initialFilters={initialFilters}
      activeCityLocations={activeCityLocations}
    />
  );
}

export default function Home(props: { searchParams: Promise<SearchParams> }) {
  return <Suspense fallback={<HomeLoading />}><HomeContent {...props} /></Suspense>;
}
