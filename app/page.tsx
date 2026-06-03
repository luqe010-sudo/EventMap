import HomePage from "@/components/HomePage";
import { getHomeData } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { events, categories, activeCitySlugs } = await getHomeData();

  return (
    <HomePage
      initialEvents={events}
      categoryOptions={categories}
      activeCitySlugs={activeCitySlugs}
    />
  );
}
