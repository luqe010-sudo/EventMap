import SeasonalPage, { seasonalMetadata } from "@/components/SeasonalPage";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return seasonalMetadata("mikolajki");
}

export default function Page() {
  return <SeasonalPage slug="mikolajki" />;
}
