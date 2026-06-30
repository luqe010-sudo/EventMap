import HomePage from "@/components/HomePage";
import { getHomeData } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "MapaImprez.pl - lokalne wydarzenia w Polsce",
  description: "Znajdz koncerty, festyny, targi, wydarzenia sportowe, rodzinne i kulturalne w Polsce. Filtruj wydarzenia po dacie, miescie, kategorii, cenie i promieniu.",
  alternates: {
    canonical: "/",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const initialFilters = parsePublicFilterParams(await searchParams);
  const { events, eventSearch, categories, activeCityLocations } = await getHomeData({
    dateFilter: initialFilters.dateFilter ?? "all",
    customDate: initialFilters.customDate,
    priceMode: initialFilters.priceMode ?? "all",
    maxPrice: initialFilters.maxPrice
  });

  return (
    <HomePage
      initialEvents={events}
      initialEventSearch={eventSearch}
      categoryOptions={categories}
      initialFilters={initialFilters}
      activeCityLocations={activeCityLocations}
    />
  );
}
