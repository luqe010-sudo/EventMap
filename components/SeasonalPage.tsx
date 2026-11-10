import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventCard from "@/components/EventCard";
import { serializeJsonLd } from "@/lib/json-ld";
import { getSeasonalEvents } from "@/lib/seasonal-events";
import { getSeason, groupEventsByCity, isSeasonIndexable, listSeasons, type SeasonSlug } from "@/lib/seasons";
import { eventPath, formatInCity } from "@/lib/slugs";
import "@/app/seasonal.css";

const SITE_URL = "https://mapaimprez.pl";

export async function seasonalMetadata(slug: SeasonSlug): Promise<Metadata> {
  const season = getSeason(slug);
  if (!season) return {};
  const { year, events } = await getSeasonalEvents(slug);
  const title = season.title(year);
  const description = season.description(year);
  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    robots: isSeasonIndexable(events.length) ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: `${SITE_URL}/${slug}`, locale: "pl_PL", type: "website", siteName: "MapaImprez.pl", images: ["/og-default.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-default.png"] },
  };
}

function eventNoun(count: number) {
  if (count === 1) return "wydarzenie";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "wydarzenia" : "wydarzeń";
}

function cityAnchor(citySlug: string) {
  return `miasto-${citySlug}`;
}

export default async function SeasonalPage({ slug }: { slug: SeasonSlug }) {
  const season = getSeason(slug);
  if (!season) notFound();
  const { year, events } = await getSeasonalEvents(slug);
  const groups = groupEventsByCity(events);
  const name = season.name(year);
  const otherSeasons = listSeasons().filter((item) => item.slug !== slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name,
      description: season.description(year),
      url: `${SITE_URL}/${slug}`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: events.length,
        itemListElement: events.slice(0, 50).map((event, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SITE_URL}${eventPath(event)}`,
          name: event.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "MapaImprez.pl", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name, item: `${SITE_URL}/${slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: season.tips.map((tip) => ({
        "@type": "Question",
        name: tip.question,
        acceptedAnswer: { "@type": "Answer", text: tip.answer },
      })),
    },
  ];

  return (
    <main className="homePage seasonalPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <nav className="seasonalBreadcrumbs" aria-label="Okruszki">
        <Link href="/">MapaImprez.pl</Link> <span aria-hidden="true">›</span> <span>{name}</span>
      </nav>

      <header className="seasonalHero">
        <p className="seasonalEyebrow">Kalendarz sezonowy</p>
        <h1>{name}</h1>
        {season.intro(year).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {groups.length > 0 ? (
          <p className="seasonalSummary">
            <strong>{events.length}</strong> {eventNoun(events.length)} w{" "}
            <strong>{groups.length}</strong> {groups.length === 1 ? "miejscowości" : "miejscowościach"}
          </p>
        ) : null}
      </header>

      {groups.length > 0 ? (
        <nav className="seasonalCities" aria-label="Miasta">
          {groups.map((group) => (
            <a key={group.citySlug} href={`#${cityAnchor(group.citySlug)}`} className="seasonalCityChip">
              {group.city} <span>{group.events.length}</span>
            </a>
          ))}
        </nav>
      ) : (
        <p className="seasonalEmpty">{season.emptyText} <Link href="/">Zobacz wszystkie nadchodzące wydarzenia</Link>.</p>
      )}

      {groups.map((group) => (
        <section key={group.citySlug} id={cityAnchor(group.citySlug)} className="seasonalCitySection" aria-labelledby={`${cityAnchor(group.citySlug)}-title`}>
          <div className="seasonalCityHeader">
            <h2 id={`${cityAnchor(group.citySlug)}-title`}>{season.cityHeading(formatInCity(group.city))}</h2>
            {group.citySlug ? <Link href={`/${group.citySlug}`}>Wszystkie imprezy {formatInCity(group.city)} →</Link> : null}
          </div>
          <div className="seasonalEventList">
            {group.events.map((event) => <EventCard key={event.id} event={event} distanceKm={Number.NaN} />)}
          </div>
        </section>
      ))}

      <section className="seasonalTips" aria-labelledby="seasonal-tips-title">
        <h2 id="seasonal-tips-title">Najczęstsze pytania</h2>
        {season.tips.map((tip) => (
          <details key={tip.question}>
            <summary>{tip.question}</summary>
            <p>{tip.answer}</p>
          </details>
        ))}
      </section>

      <section className="seasonalRelated" aria-labelledby="seasonal-related-title">
        <h2 id="seasonal-related-title">Zobacz też</h2>
        <ul>
          {otherSeasons.map((item) => <li key={item.slug}><Link href={`/${item.slug}`}>{item.linkLabel}</Link></li>)}
          <li><Link href="/dla-organizatorow">Organizujesz wydarzenie? Dodaj je bezpłatnie</Link></li>
        </ul>
      </section>
    </main>
  );
}
