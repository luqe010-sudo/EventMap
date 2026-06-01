import { redirect } from "next/navigation";

type Params = { category: string };

export default async function LegacyCategoryPage({ params }: { params: Promise<Params> }) {
  const { category } = await params;
  redirect(`/kategoria/${category}`);
}
