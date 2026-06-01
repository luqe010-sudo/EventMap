import HomePage from "@/components/HomePage";
import { getHomeData } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { events, categories } = await getHomeData();

  return <HomePage initialEvents={events} categoryOptions={categories} />;
}
