import { redirect } from "next/navigation";

type Params = { category: string; city: string };

export default async function LegacyCategoryCityPage({ params }: { params: Promise<Params> }) {
  const { category, city } = await params;
  redirect(`/kategoria/${category}?city=${encodeURIComponent(city)}`);
}
