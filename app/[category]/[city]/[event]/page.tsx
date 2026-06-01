import { redirect } from "next/navigation";

type Params = { event: string };

export default async function LegacyEventPage({ params }: { params: Promise<Params> }) {
  const { event } = await params;
  redirect(`/wydarzenie/${event}`);
}
