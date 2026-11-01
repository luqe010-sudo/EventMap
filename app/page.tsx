import { Suspense } from "react";
import HomeLoading from "@/components/HomeLoading";
import HomePage from "@/components/HomePage";
import { getHomeData } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MapaImprez.pl - lokalne wydarzenia w Polsce",
  description: "Znajdź koncerty, festyny, targi, wydarzenia sportowe, rodzinne i kulturalne w Polsce. Filtruj wydarzenia po dacie, mieście, kategorii, cenie i promieniu.",
  alternates: {
    canonical: "/",
  },
};

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
