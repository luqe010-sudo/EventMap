import HomePage from "@/components/HomePage";
import { getHomeData } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const initialFilters = parsePublicFilterParams(await searchParams);
  const { events, categories, activeCityLocations } = await getHomeData();

  return (
    <HomePage
      initialEvents={events}
      categoryOptions={categories}
      initialFilters={initialFilters}
      activeCityLocations={activeCityLocations}
    />
  );
}
