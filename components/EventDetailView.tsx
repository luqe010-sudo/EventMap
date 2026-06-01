import type { ReactNode } from "react";
import Link from "next/link";
import EventDetailMap from "@/components/EventDetailMap";
import type { EventItem } from "@/lib/events";
import { categoryPath, toSlug } from "@/lib/slugs";

export default function EventDetailView({ event }: { event: EventItem }) {
  const cityPath = event.city ? `/wydarzenia/${toSlug(event.city)}` : "/";
  const eventUrl = `https://eventmap.pl/wydarzenie/${event.slug}`;
  const eventLocation = {
    label: event.city || event.location?.name || event.title,
    aliases: event.city ? [toSlug(event.city)] : [],
    latitude: event.latitude ?? 52.2297,
    longitude: event.longitude ?? 21.0122
  };

  return (
    <main className="appShell">
      <nav className="breadcrumbs" aria-label="Sciezka powrotu">
        <Link href="/">Strona glowna</Link>
        <span className="separator">/</span>
        <Link href={categoryPath(event.category)}>{event.category}</Link>
        {event.city ? (
          <>
            <span className="separator">/</span>
            <Link href={cityPath}>{event.city}</Link>
          </>
        ) : null}
        <span className="separator">/</span>
        <span className="current">{event.title}</span>
      </nav>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: event.title,
            description: event.description ?? event.short_description,
            image: event.imageUrl,
            startDate: event.start_at,
            endDate: event.end_at,
            eventStatus: event.is_cancelled
              ? "https://schema.org/EventCancelled"
              : "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: {
              "@type": "Place",
              name: event.location?.name ?? event.address,
              address: {
                "@type": "PostalAddress",
                streetAddress: event.location?.address,
                addressLocality: event.city,
                addressRegion: event.location?.voivodeship,
                addressCountry: "PL"
              },
              geo: event.latitude != null && event.longitude != null
                ? {
                    "@type": "GeoCoordinates",
                    latitude: event.latitude,
                    longitude: event.longitude
                  }
                : undefined
            },
            offers: {
              "@type": "Offer",
              price: event.price_min ?? 0,
              priceCurrency: event.currency ?? "PLN",
              url: event.sources[0]?.source_url ?? eventUrl,
              availability: "https://schema.org/InStock"
            },
            organizer: event.organizerRelation
              ? {
                  "@type": "Organization",
                  name: event.organizerRelation.name,
                  url: event.organizerRelation.website ?? event.organizerRelation.facebook_url
                }
              : undefined
          })
        }}
      />

      <article className="eventDetailContainer">
        <header className="eventDetailHeader">
          <div className="eventDetailImageWrap">
            <img src={event.imageUrl} alt={event.title} className="eventDetailImage" />
            <span className="eventDetailCategory" style={{ backgroundColor: event.categoryColor }}>
              {event.category}
            </span>
          </div>
          <div className="eventDetailTitleSection">
            <h1>{event.title}</h1>
            <p className="eventDetailOrganizer">
              Organizator:{" "}
              {event.organizerUrl ? (
                <a href={event.organizerUrl} target="_blank" rel="noopener noreferrer">{event.organizerName}</a>
              ) : (
                event.organizerName
              )}
            </p>
          </div>
        </header>

        <div className="eventDetailContent">
          <section className="eventDetailInfo">
            <h2>Szczegoly wydarzenia</h2>
            <p className="eventDescription">{event.description ?? event.short_description}</p>

            <div className="eventDetailGrid">
              <DetailCard label="Kiedy" value={formatDateRange(event.start_at, event.end_at)} />
              <DetailCard
                label="Gdzie"
                value={event.address || "Lokalizacja nieznana"}
                extra={event.city ? <Link href={cityPath} className="inlineCityLink">Inne wydarzenia w {event.city}</Link> : null}
              />
              <DetailCard label="Kategoria" value={event.category} />
              <DetailCard label="Cena" value={event.price} />
            </div>

            {event.sources.length ? (
              <section className="eventSources" aria-label="Zrodla wydarzenia">
                <h2>Zrodla wydarzenia</h2>
                <div className="detailsActions">
                  {event.sources.map((source) => (
                    source.source_url ? (
                      <a key={`${source.source_type}-${source.source_url}`} href={source.source_url} target="_blank" rel="noopener noreferrer" className="secondaryButton">
                        {source.source_name ?? source.source_type}
                      </a>
                    ) : (
                      <span key={`${source.source_type}-${source.source_name}`} className="priceNotice">
                        {source.source_name ?? source.source_type}
                      </span>
                    )
                  ))}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="eventDetailMapWrap">
            <h2>Lokalizacja na mapie</h2>
            <div className="detailMapContainer">
              <EventDetailMap event={event} location={eventLocation} />
            </div>
            {event.location?.google_maps_url ? (
              <a href={event.location.google_maps_url} target="_blank" rel="noopener noreferrer" className="inlineCityLink">
                Otworz w Google Maps
              </a>
            ) : null}
          </aside>
        </div>
      </article>
    </main>
  );
}

function DetailCard({ label, value, extra }: { label: string; value: string; extra?: ReactNode }) {
  return (
    <div className="detailCard">
      <div className="detailText">
        <h3>{label}</h3>
        <p>{value}</p>
        {extra}
      </div>
    </div>
  );
}

function formatDateRange(start: string, end: string | null) {
  const formattedStart = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(start));

  if (!end) return formattedStart;

  const formattedEnd = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(end));

  return `${formattedStart} - ${formattedEnd}`;
}
