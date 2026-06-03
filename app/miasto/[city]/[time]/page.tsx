import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  listCategories,
  listEvents,
  resolveCityLocation,
} from "@/lib/events";
import { formatInCity, toSlug } from "@/lib/slugs";

type Params = { city: string; time: string };

export const dynamic = "force-dynamic";

const dateFilterMap = {
  "dzis": "today",
  "weekend": "weekend",
  "ten-tydzien": "week",
} as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city: citySlug, time } = await params;
  
  if (time !== "dzis" && time !== "weekend" && time !== "ten-tydzien") {
    return {};
  }

  const cityLocation = await resolveCityLocation(citySlug);
  if (!cityLocation) return {};

  const locationText = formatInCity(cityLocation.label);
  const timeLabel = time === "dzis" ? "dzisiaj" : time === "weekend" ? "w weekend" : "w tym tygodniu";

  return {
    title: `Wydarzenia ${locationText} ${timeLabel} | MapaImprez`,
    description: `Imprezy i wydarzenia ${locationText} zaplanowane ${timeLabel}. Koncerty, teatr, sport. Sprawdź co robić ${timeLabel}!`,
    alternates: {
      canonical: `/miasto/${toSlug(cityLocation.label)}/${time}`
    }
  };
}

export default async function CityTimePage({ params }: { params: Promise<Params> }) {
  const { city: citySlug, time } = await params;

  if (time !== "dzis" && time !== "weekend" && time !== "ten-tydzien") {
    notFound();
  }

  const normalizedCitySlug = toSlug(citySlug);
  if (citySlug !== normalizedCitySlug) {
    redirect(`/miasto/${normalizedCitySlug}/${time}`);
  }

  const cityLocation = await resolveCityLocation(citySlug);
  if (!cityLocation) {
    notFound();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, categoryRows] = await Promise.all([
    listEvents({ dateFrom: today.toISOString(), limit: 250 }),
    listCategories()
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Wydarzenia ${formatInCity(cityLocation.label)} - imprezy ${time}`,
            description: `Wydarzenia i imprezy ${formatInCity(cityLocation.label)} zaplanowane na ${time}.`,
            url: `https://mapaimprez.pl/miasto/${citySlug}/${time}`
          })
        }}
      />
      <HomePage
        initialEvents={events}
        initialLocation={cityLocation}
        initialDateFilter={dateFilterMap[time]}
        categoryOptions={categoryRows}
      />
    </>
  );
}
