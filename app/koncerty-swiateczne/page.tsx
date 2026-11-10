import SeasonalPage, { seasonalMetadata } from "@/components/SeasonalPage";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return seasonalMetadata("koncerty-swiateczne");
}

export default function Page() {
  return <SeasonalPage slug="koncerty-swiateczne" />;
}
