"use client";
import { serializeJsonLd } from "@/lib/json-ld";

import Link from "next/link";
import type { CSSProperties } from "react";
import EventCarousel from "./EventCarousel";
import EventVisual from "./EventVisual";
import CategoryIcon from "./CategoryIcon";
import { CalendarDays, ChevronRight, DollarSign, HeartHandshake, MapPin, Tag, X } from "lucide-react";
import EventHeroCta, { EventSaveButton } from "@/components/EventDetailActions";
import EventAnalyticsTracker, { TrackedEventLink } from "@/components/EventAnalyticsTracker";
import EventDetailMap from "@/components/EventDetailMap";
import ExpandableDescription from "@/components/ExpandableDescription";
import { type EventItem, isFreeEvent } from "@/lib/events";
import { formatPolishDate, getDateKeyInAppTimeZone } from "@/lib/date-format";
import { formatEventCardPrice } from "@/lib/event-presentation";
import { hasLocationCoordinates } from "@/lib/event-search";
import { getEventDirectionsUrl } from "@/lib/event-directions";
import { categoryPath, eventPath, toSlug, toPluralCategoryName, toPluralCategorySlug, formatInCity } from "@/lib/slugs";

type EventDetailViewProps = {
  event: EventItem;
  relatedEvents?: EventItem[];
  saveState?: { isLoggedIn: boolean; isSaved: boolean };
  embedded?: boolean;
  onClose?: () => void;
  onOpenEvent?: (eventId: string) => void;
  /** Embedded in the home workspace: switches to its map tab instead of loading the home page. */
  onShowOnMap?: (eventId: string) => void;
};

export default function EventDetailView({
  event,
  relatedEvents = [],
  saveState,
  embedded = false,
  onClose,
  onOpenEvent,
  onShowOnMap,
}: EventDetailViewProps) {
  const categoryPlural = toPluralCategoryName(event.category);
  const categorySlug = toPluralCategorySlug(event.categorySlug || toSlug(event.category || "inne"));
  const citySlug = event.citySlug || toSlug(event.city || "polska");
  const Wrapper = embedded ? "div" : "main";
  const wrapperClassName = embedded ? "edShellEmbedded" : "appShell eventDetailPage";
  const eventUrl = `https://mapaimprez.pl${eventPath(event)}`;
  const mapTargetId = "event-detail-map";
  const eventLocation = hasLocationCoordinates(event) ? {
    label: event.city || event.location?.name || event.title,
    aliases: event.city ? [toSlug(event.city)] : [],
    latitude: event.latitude,
    longitude: event.longitude,
  } : null;

  const dateFormatted = formatPolishDate(event.start_at, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dayOfWeek = formatPolishDate(event.start_at, { weekday: "short" });
  const timeFormatted = event.is_all_day ? "Cały dzień" : formatPolishDate(event.start_at, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fullDate = formatDateRange(event.start_at, event.end_at, event.is_all_day);
  const isFree = isFreeEvent(event);
  const isPast = isPastEvent(event);
  const similarEventsHref = relatedEvents.length
    ? "#podobne-wydarzenia"
    : categoryPath(event.category);
  const googleMapsUrl = getEventDirectionsUrl(event);

  return (
    <Wrapper className={wrapperClassName}>
      <EventAnalyticsTracker eventId={event.id} />

      {/* Breadcrumbs — skip in embedded mode */}
      {!embedded ? (
        <nav
          className="breadcrumbs edBreadcrumbs"
          aria-label="Ścieżka powrotu"
        >
          <Link href="/" aria-label="Strona główna">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </Link>
          <span className="separator">›</span>
          <Link href={`/${categorySlug}`}>{categoryPlural}</Link>
          {event.city ? (
            <>
              <span className="separator">›</span>
              <Link href={`/${categorySlug}/${citySlug}`}>{event.city}</Link>
            </>
          ) : null}
          <span className="separator">›</span>
          <span className="current" aria-current="page">{event.title}</span>
        </nav>
      ) : null}

      {/* JSON-LD structured data — skip in embedded mode */}
      {!embedded ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd({
                "@context": "https://schema.org",
                "@type": "Event",
                name: event.title,
                description: event.description ?? event.short_description,
                image: event.imageUrl || undefined,
                startDate: event.start_at,
                endDate: event.end_at ?? undefined,
                eventStatus: event.is_cancelled
                  ? "https://schema.org/EventCancelled"
                  : "https://schema.org/EventScheduled",
                eventAttendanceMode:
                  "https://schema.org/OfflineEventAttendanceMode",
                location: {
                  "@type": "Place",
                  name: event.location?.name ?? event.address,
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: event.location?.address,
                    addressLocality: event.city,
                    addressRegion: event.location?.voivodeship,
                    addressCountry: "PL",
                  },
                  geo:
                    hasLocationCoordinates(event)
                      ? {
                          "@type": "GeoCoordinates",
                          latitude: event.latitude,
                          longitude: event.longitude,
                        }
                      : undefined,
                },
                offers: isFree || event.price_min != null || event.price_max != null ? {
                  "@type": "Offer",
                  price: isFree ? 0 : event.price_min ?? event.price_max,
                  priceCurrency: event.currency ?? "PLN",
                  url: event.sources[0]?.source_url ?? eventUrl,
                } : undefined,
                organizer: event.organizerRelation
                  ? {
                      "@type": "Organization",
                      name: event.organizerRelation.name,
                      url:
                        event.organizerRelation.website ||
                        event.organizerRelation.facebook_url ||
                        "https://mapaimprez.pl",
                    }
                  : undefined,
              }),
            }}
          />

          {/* JSON-LD BreadcrumbList */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Strona główna",
                    item: "https://mapaimprez.pl",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: categoryPlural,
                    item: `https://mapaimprez.pl/${categorySlug}`,
                  },
                  ...(event.city
                    ? [
                        {
                          "@type": "ListItem",
                          position: 3,
                          name: event.city,
                          item: `https://mapaimprez.pl/${categorySlug}/${citySlug}`,
                        },
                        {
                          "@type": "ListItem",
                          position: 4,
                          name: event.title,
                          item: eventUrl,
                        },
                      ]
                    : [
                        {
                          "@type": "ListItem",
                          position: 3,
                          name: event.title,
                          item: eventUrl,
                        },
                      ]),
                ],
              }),
            }}
          />
        </>
      ) : null}

      <article className="edShell">
        {/* ====== HERO: Image | Event | Details ====== */}
        <section className="edHero">
          <div className="edHeroImageCol">
            <div className={`edHeroImageWrap ${isPast ? "edHeroImagePast" : ""}`}>
              <span
                className="edCategoryBadge"
                data-category={categorySlug}
                style={{ "--ed-category-color": event.categoryColor } as CSSProperties}
              >
                <span aria-hidden="true">
                  {categorySlug === "charytatywne"
                    ? <HeartHandshake size={16} />
                    : <CategoryIcon iconName={event.categoryRelation?.icon} size={16} />}
                </span>
                {event.category}
              </span>
              <EventVisual event={event} variant="detail" decorative={false} loading="eager" imageClassName="edHeroImage" />
              {isPast ? (
                <div className="edPastEventOverlay">
                  <p>
                    {event.end_at ? "Wydarzenie zakończone." : "Termin rozpoczęcia minął; godzina zakończenia nie jest podana."} Data: <strong>{dateFormatted}</strong>. Sprawdź kolejne wydarzenia.
                  </p>
                  <Link href={similarEventsHref}>
                    {relatedEvents.length ? "Zobacz podobne niżej" : "Zobacz kolejne wydarzenia"}
                  </Link>
                </div>
              ) : null}
              <div className="edImageActions">
                <EventSaveButton
                  eventId={event.id}
                  initialSaved={saveState?.isSaved}
                  isLoggedIn={saveState?.isLoggedIn}
                  returnTo={eventPath(event)}
                />
                {embedded && onClose ? (
                  <button
                    type="button"
                    className="edEmbeddedClose"
                    onClick={onClose}
                    aria-label="Zamknij widok wydarzenia"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="edHeroInfo">
            <h1 id="event-detail-title" tabIndex={embedded ? -1 : undefined}>{event.title}</h1>

            <div className="edHeroMeta">
              <span className="edMetaChip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {event.city || "Polska"}
              </span>
              <span className="edMetaChip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {dateFormatted} ({dayOfWeek})
              </span>
              <span className="edMetaChip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {timeFormatted}
              </span>
            </div>

            {event.short_description ? (
              <p className="edHeroDesc">{event.short_description}</p>
            ) : null}

            <EventHeroCta
              eventId={event.id}
              title={event.title}
              url={eventUrl}
              ticketUrl={event.ticketUrl}
              hideTicketLink={isPast}
            />
          </div>

          <section className="edInfoBar" aria-label="Szczegóły wydarzenia">
            <div className="edInfoBarHeader">
              <h2>Szczegóły wydarzenia</h2>
            </div>

            <div className="edInfoItem">
              <div className="edInfoIcon">
                <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="edInfoText">
                <span className="edInfoLabel">Kiedy</span>
                <strong>{fullDate}</strong>
              </div>
            </div>

            <div className="edInfoItem">
              <div className="edInfoIcon">
                <MapPin size={18} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="edInfoText">
                <span className="edInfoLabel">Gdzie</span>
                <strong>{event.address || "Lokalizacja nieznana"}</strong>
              </div>
            </div>

            <div className="edInfoItem">
              <div className="edInfoIcon">
                <DollarSign size={18} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="edInfoText">
                <span className="edInfoLabel">Cena</span>
                <strong>{formatEventCardPrice(event)}</strong>
              </div>
            </div>

            <div className="edInfoItem">
              <div className="edInfoIcon">
                <Tag size={18} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="edInfoText">
                <span className="edInfoLabel">Kategoria</span>
                <strong>{event.category}</strong>
              </div>
            </div>
          </section>
        </section>

        {/* ====== CONTENT GRID: Description | Map | Organizer and Sources ====== */}
        <div className="edContentGrid" id="opis">
          <section className="edDescSection">
            <h2>Opis wydarzenia</h2>
            <ExpandableDescription text={event.description ?? event.short_description} />
          </section>

          <section className="edMapSection" id={mapTargetId}>
            <h2>Lokalizacja</h2>
            {!embedded && eventLocation ? (
              <div className="edMapContainer">
                <EventDetailMap event={event} location={eventLocation} />
              </div>
            ) : null}
            <p className="edMapAddress">{event.address || "Lokalizacja nieznana"}</p>
            {!eventLocation ? <p className="edMapAddress">Punkt na mapie nie jest dostępny. Sprawdź adres i źródło wydarzenia.</p> : null}
            {eventLocation || googleMapsUrl ? (
              <div className="edMapActions">
                {eventLocation ? (
                  onShowOnMap ? (
                    <button type="button" className="edGoogleMapsLink edShowOnMapLink" onClick={() => onShowOnMap(event.id)}>
                      <MapPin size={15} aria-hidden="true" />
                      Pokaż na naszej mapie
                    </button>
                  ) : (
                    <Link href={`/#mapa=${encodeURIComponent(event.id)}`} className="edGoogleMapsLink edShowOnMapLink">
                      <MapPin size={15} aria-hidden="true" />
                      Pokaż na naszej mapie
                    </Link>
                  )
                ) : null}
                {googleMapsUrl ? (
                  <TrackedEventLink
                    eventId={event.id}
                    eventType="map_click"
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="edGoogleMapsLink"
                  >
                    {eventLocation || event.location?.google_maps_url?.trim() ? "Otwórz w Google Maps" : "Wyszukaj miejsce w Google Maps"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                  </TrackedEventLink>
                ) : null}
              </div>
            ) : null}
          </section>
          <div className="edOrganizerColumn">
            {/* Organizer */}
            <section className="edOrgSection" id="organizator">
              <h2>Organizator</h2>
              <div className="edOrgRow">
                <div className="edOrgAvatar" aria-hidden="true">
                  {event.organizerRelation?.logo_url ? (
                    <img src={event.organizerRelation.logo_url} alt={event.organizerName} />
                  ) : (
                    event.organizerName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="edOrgInfo">
                  <strong>{event.organizerName}</strong>
                  <span title={event.organizerRelation?.is_verified ? "Oznaczenie dotyczy profilu organizatora, a nie weryfikacji wszystkich danych wydarzenia." : undefined}>
                    {event.organizerRelation?.is_verified
                      ? "✓ Zweryfikowany organizator"
                      : "Organizator wydarzenia"}
                  </span>
                </div>
                {event.organizerUrl ? (
                  <TrackedEventLink
                    eventId={event.id}
                    eventType="website_click"
                    href={event.organizerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="edOrgLink"
                  >
                    Zobacz profil
                  </TrackedEventLink>
                ) : null}
                {event.organizerRelation?.phone ? (
                  <TrackedEventLink
                    eventId={event.id}
                    eventType="phone_click"
                    href={`tel:${event.organizerRelation.phone}`}
                    className="edOrgLink"
                  >
                    Zadzwoń
                  </TrackedEventLink>
                ) : null}
              </div>
            </section>

            {/* Sources */}
            {event.sources.length ? (
              <section className="edSourcesSection" id="zrodla">
                <h2>Źródła wydarzenia</h2>
                <div className="edSourceList">
                  {event.sources.map((source) =>
                    source.source_url ? (
                      <TrackedEventLink
                        eventId={event.id}
                        eventType="website_click"
                        key={`${source.source_type}-${source.source_url}`}
                        href={source.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="edSourceItem"
                      >
                        <span className="edSourceIcon" aria-hidden="true">
                          {getSourceInitial(source.source_type)}
                        </span>
                        <span className="edSourceText">
                          <strong>{source.source_name ?? source.source_type ?? "Źródło wydarzenia"}</strong>
                          <small>{formatSourceUrl(source.source_url)}</small>
                        </span>
                        <span className="edSourceArrow" aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </span>
                      </TrackedEventLink>
                    ) : (
                      <div
                        key={`${source.source_type}-${source.source_name}`}
                        className="edSourceItem"
                      >
                        <span className="edSourceIcon" aria-hidden="true">
                          {getSourceInitial(source.source_type)}
                        </span>
                        <span className="edSourceText">
                          <strong>{source.source_name ?? source.source_type ?? "Źródło wydarzenia"}</strong>
                        </span>
                      </div>
                    )
                  )}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        {/* ====== BOTTOM GRID: Related Events | More Links ====== */}
        <div className="edBottomGrid">
          {relatedEvents.length ? (
            <section className="edRelatedSection" id="podobne-wydarzenia">
              <EventCarousel
                title="Polecane wydarzenia w okolicy"
                events={relatedEvents.map((event) => ({ event, distanceKm: Number.POSITIVE_INFINITY }))}
                onOpenEvent={onOpenEvent}
                seeAllHref={categoryPath(event.category)}
                photoCards
              />
            </section>
          ) : null}
          <section className="edMoreLinksSection">
            <h2>Więcej ciekawych wydarzeń</h2>
            <div className="edMoreLinksGrid">
              <Link href={`/${categorySlug}/${citySlug}`} className="edMoreLinkCard">
                <span className="edMoreLinkIcon"><Tag size={18} aria-hidden="true" /></span>
                <span>Więcej z kategorii <strong>{categoryPlural}</strong> {formatInCity(event.city || "Polska")}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
              <Link href={`/${citySlug}`} className="edMoreLinkCard">
                <span className="edMoreLinkIcon"><MapPin size={18} aria-hidden="true" /></span>
                <span>Więcej wydarzeń <strong>{formatInCity(event.city || "Polska")}</strong></span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </article>
    </Wrapper>
  );
}

/* ---- Helpers ---- */

function formatDateRange(start: string, end: string | null, isAllDay: boolean | null) {
  const startLabel = formatPolishDate(start, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const startTime = isAllDay ? "Cały dzień" : formatPolishDate(start, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!end) return `${startLabel}, ${startTime}`;

  const startDay = getDateKeyInAppTimeZone(start);
  const endDay = getDateKeyInAppTimeZone(end);
  const endTime = formatPolishDate(end, { hour: "2-digit", minute: "2-digit" });

  if (startDay === endDay) {
    if (isAllDay) return `${startLabel}, ${startTime}`;
    return `${startLabel}, ${startTime} \u2013 ${endTime}`;
  }

  const endLabel = formatPolishDate(end, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return isAllDay
    ? `${startLabel} \u2013 ${endLabel}, ${startTime}`
    : `${startLabel}, ${startTime} \u2013 ${endLabel}, ${endTime}`;
}

function isPastEvent(event: Pick<EventItem, "start_at" | "end_at">) {
  const startTime = new Date(event.start_at).getTime();
  const endTime = event.end_at
    ? new Date(event.end_at).getTime()
    : startTime;

  return Number.isFinite(endTime) && endTime <= Date.now();
}

function formatSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function getSourceInitial(sourceType?: string | null) {
  const type = sourceType?.toLowerCase() ?? "";
  if (type.includes("facebook")) return "f";
  if (type.includes("instagram")) return "📷";
  if (type.includes("twitter") || type.includes("x.com")) return "𝕏";
  return (sourceType?.charAt(0) ?? "Z").toUpperCase();
}
