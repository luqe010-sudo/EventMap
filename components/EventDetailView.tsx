import type { ReactNode } from "react";
import Link from "next/link";
import EventDetailActions from "@/components/EventDetailActions";
import EventDetailMap from "@/components/EventDetailMap";
import { type EventItem, isFreeEvent } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { categoryPath, eventPath, toSlug } from "@/lib/slugs";

type EventDetailViewProps = {
  event: EventItem;
  relatedEvents?: EventItem[];
};

export default function EventDetailView({ event, relatedEvents = [] }: EventDetailViewProps) {
  const cityPath = event.city ? `/wydarzenia/${toSlug(event.city)}` : "/";
  const eventUrl = `https://eventmap.pl/wydarzenie/${event.slug}`;
  const mapTargetId = "event-detail-map";
  const eventLocation = {
    label: event.city || event.location?.name || event.title,
    aliases: event.city ? [toSlug(event.city)] : [],
    latitude: event.latitude ?? 52.2297,
    longitude: event.longitude ?? 21.0122
  };

  return (
    <main className="appShell eventDetailPage">
      <nav className="breadcrumbs eventDetailBreadcrumbs" aria-label="Sciezka powrotu">
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

      <article className="eventDetailShell">
        <header className="eventDetailIntroCard">
          <div>
            <span className="eventDetailCategoryBadge" style={{ backgroundColor: event.categoryColor }}>
              {event.category}
            </span>
            <h1>{event.title}</h1>
            <div className="eventDetailMetaLine">
              <span>{event.city || "Polska"}</span>
              <span>{isFreeEvent(event) ? "Bezplatne" : event.price}</span>
            </div>
          </div>
          <EventDetailActions eventId={event.id} title={event.title} url={eventUrl} />
        </header>

        <div className="eventDetailMediaGrid">
          <div className="eventDetailLeadImageWrap">
            <img src={event.imageUrl} alt={event.title} className="eventDetailLeadImage" />
          </div>

          <aside className="eventDetailSummaryColumn">
            <section className="eventDetailSummaryCard" aria-label="Szczegoly wydarzenia">
              <h2>Szczegoly wydarzenia</h2>
              <SummaryItem label="Kiedy" value={formatDateRange(event.start_at, event.end_at)} />
              <SummaryItem
                label="Gdzie"
                value={event.address || "Lokalizacja nieznana"}
                extra={
                  <>
                    <a href={`#${mapTargetId}`}>Pokaz na mapie</a>
                    {event.city ? <Link href={cityPath}>Inne wydarzenia w {event.city}</Link> : null}
                  </>
                }
              />
              <SummaryItem label="Kategoria" value={event.category} />
              <SummaryItem label="Cena" value={event.price} />
            </section>
          </aside>
        </div>

        <div className="eventDetailBodyGrid">
          <section className="eventDetailSection eventDetailDescriptionBlock">
            <h2>Opis wydarzenia</h2>
            <div className="eventDescription">
              {splitDescription(event.description ?? event.short_description).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="eventDetailMapPlain" id={mapTargetId} aria-label="Mapa wydarzenia">
            <div className="detailMapContainer">
              <EventDetailMap event={event} location={eventLocation} />
            </div>
          </section>

          <div className="eventDetailMain">
            <section className="eventDetailSection eventOrganizerPanel">
              <h2>Organizator</h2>
              <div className="eventOrganizerRow">
                <div className="eventOrganizerAvatar" aria-hidden="true">
                  {event.organizerName.charAt(0).toUpperCase()}
                </div>
                <div className="eventOrganizerInfo">
                  <strong>{event.organizerName}</strong>
                  <span>{event.organizerRelation?.is_verified ? "Organizator zweryfikowany" : "Organizator wydarzenia"}</span>
                </div>
                {event.organizerUrl ? (
                  <a href={event.organizerUrl} target="_blank" rel="noopener noreferrer" className="secondaryButton eventOrganizerLink">
                    Zobacz profil
                  </a>
                ) : null}
              </div>
            </section>

          {event.sources.length ? (
            <section className="eventDetailSection">
              <h2>Zrodla wydarzenia</h2>
              <div className="eventSourceList">
                {event.sources.map((source) => (
                  source.source_url ? (
                    <a
                      key={`${source.source_type}-${source.source_url}`}
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="eventSourceItem"
                    >
                      <span className="eventSourceIcon" aria-hidden="true">{source.source_type?.charAt(0).toUpperCase() ?? "Z"}</span>
                      <span>
                        <strong>{source.source_name ?? source.source_type ?? "Zrodlo wydarzenia"}</strong>
                        <small>{formatSourceUrl(source.source_url)}</small>
                      </span>
                      <span className="eventSourceArrow" aria-hidden="true">Otworz</span>
                    </a>
                  ) : (
                    <div key={`${source.source_type}-${source.source_name}`} className="eventSourceItem">
                      <span className="eventSourceIcon" aria-hidden="true">{source.source_type?.charAt(0).toUpperCase() ?? "Z"}</span>
                      <span>
                        <strong>{source.source_name ?? source.source_type ?? "Zrodlo wydarzenia"}</strong>
                      </span>
                    </div>
                  )
                ))}
              </div>
            </section>
          ) : null}

          {relatedEvents.length ? (
            <section className="eventDetailSection">
              <div className="eventDetailSectionHeader">
                <h2>Podobne wydarzenia</h2>
                <Link href={categoryPath(event.category)}>Zobacz kategorie</Link>
              </div>
              <div className="relatedEventsGrid">
                {relatedEvents.map((relatedEvent) => (
                  <Link key={relatedEvent.id} href={eventPath(relatedEvent)} className="relatedEventCard">
                    <img src={relatedEvent.imageUrl} alt={relatedEvent.title} />
                    <div className="relatedEventBody">
                      <div className="relatedEventDate">
                        <strong>{formatPolishDate(relatedEvent.start_at, { day: "2-digit" })}</strong>
                        <span>{formatPolishDate(relatedEvent.start_at, { month: "short" })}</span>
                      </div>
                      <div>
                        <h3>{relatedEvent.title}</h3>
                        <p>{relatedEvent.city || relatedEvent.address}</p>
                        <span className={isFreeEvent(relatedEvent) ? "relatedEventFree" : ""}>
                          {isFreeEvent(relatedEvent) ? "Bezplatne" : relatedEvent.price}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          </div>
        </div>
      </article>
    </main>
  );
}

function SummaryItem({
  label,
  value,
  extra
}: {
  label: string;
  value: string;
  extra?: ReactNode;
}) {
  return (
    <div className="eventSummaryItem">
      <span>{label}</span>
      <strong>{value}</strong>
      {extra ? <small>{extra}</small> : null}
    </div>
  );
}

function formatDateRange(start: string, end: string | null) {
  const startLabel = formatPolishDate(start, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const startTime = formatPolishDate(start, { hour: "2-digit", minute: "2-digit" });

  if (!end) return `${startLabel}, ${startTime}`;

  const endTime = formatPolishDate(end, { hour: "2-digit", minute: "2-digit" });
  return `${startLabel}, ${startTime} - ${endTime}`;
}

function splitDescription(value?: string | null) {
  const paragraphs = value?.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean) ?? [];
  return paragraphs.length ? paragraphs : ["Brak szczegolowego opisu wydarzenia."];
}

function formatSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
