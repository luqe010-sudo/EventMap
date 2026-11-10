import SeasonalPage, { seasonalMetadata } from "@/components/SeasonalPage";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return seasonalMetadata("jarmarki-bozonarodzeniowe");
}

export default function Page() {
  return <SeasonalPage slug="jarmarki-bozonarodzeniowe" />;
}
