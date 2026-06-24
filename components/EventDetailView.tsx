"use client";

import Link from "next/link";
import EventHeroCta, { EventSaveButton } from "@/components/EventDetailActions";
import EventAnalyticsTracker, { TrackedEventLink } from "@/components/EventAnalyticsTracker";
import EventDetailMap from "@/components/EventDetailMap";
import ExpandableDescription from "@/components/ExpandableDescription";
import { type EventItem, isFreeEvent } from "@/lib/events";
import { formatPolishDate, getDateKeyInAppTimeZone } from "@/lib/date-format";
import { categoryPath, eventPath, toSlug, toPluralCategoryName, toPluralCategorySlug, formatInCity } from "@/lib/slugs";

type EventDetailViewProps = {
  event: EventItem;
  relatedEvents?: EventItem[];
  saveState?: { isLoggedIn: boolean; isSaved: boolean };
  embedded?: boolean;
  onClose?: () => void;
  onOpenEvent?: (eventId: string) => void;
};

export default function EventDetailView({
  event,
  relatedEvents = [],
  saveState,
  embedded = false,
  onClose,
  onOpenEvent,
}: EventDetailViewProps) {
  const categoryPlural = toPluralCategoryName(event.category);
  const categorySlug = toPluralCategorySlug(event.categorySlug || toSlug(event.category || "inne"));
  const citySlug = event.citySlug || toSlug(event.city || "polska");
  const cityHref = event.city ? `/${citySlug}` : "/";
  const Wrapper = embedded ? "div" : "main";
  const wrapperClassName = embedded ? "edShellEmbedded" : "appShell eventDetailPage";
  const eventUrl = `https://mapaimprez.pl${eventPath(event)}`;
  const mapTargetId = "event-detail-map";
  const eventLocation = {
    label: event.city || event.location?.name || event.title,
    aliases: event.city ? [toSlug(event.city)] : [],
    latitude: event.latitude ?? 52.2297,
    longitude: event.longitude ?? 21.0122,
  };

  const dateFormatted = formatPolishDate(event.start_at, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dayOfWeek = formatPolishDate(event.start_at, { weekday: "short" });
  const timeFormatted = formatPolishDate(event.start_at, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fullDate = formatDateRange(event.start_at, event.end_at);
  const isFree = isFreeEvent(event);
  const isPast = isPastEvent(event);
  const similarEventsHref = relatedEvents.length
    ? "#podobne-wydarzenia"
    : categoryPath(event.category);
  const googleMapsUrl =
    event.location?.google_maps_url ||
    (event.latitude != null && event.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
      : null);

  return (
    <Wrapper className={wrapperClassName}>
      <EventAnalyticsTracker eventId={event.id} />

      {/* Close button for embedded mode */}
      {embedded && onClose ? (
        <button
          type="button"
          className="edEmbeddedClose"
          onClick={onClose}
          aria-label="Zamknij widok wydarzenia"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : null}

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
          <span className="current">{event.title}</span>
        </nav>
      ) : null}

      {/* JSON-LD structured data — skip in embedded mode */}
      {!embedded ? (
        <>
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
                endDate: event.end_at || new Date(new Date(event.start_at).getTime() + 2 * 60 * 60 * 1000).toISOString(),
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
                    event.latitude != null && event.longitude != null
                      ? {
                          "@type": "GeoCoordinates",
                          latitude: event.latitude,
                          longitude: event.longitude,
                        }
                      : undefined,
                },
                offers: {
                  "@type": "Offer",
                  price: event.price_min ?? 0,
                  priceCurrency: event.currency ?? "PLN",
                  url: event.sources[0]?.source_url ?? eventUrl,
                  availability: "https://schema.org/InStock",
                  validFrom: event.updated_at || new Date(new Date(event.start_at).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                },
                performer: {
                  "@type": "PerformingGroup",
                  name: event.organizerRelation?.name || event.organizerName || "Uczestnicy",
                },
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
              __html: JSON.stringify({
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
        {/* ====== HERO SECTION ====== */}
        <section className="edHero">
          <div className="edHeroImageCol">
            <div className={`edHeroImageWrap ${isPast ? "edHeroImagePast" : ""}`}>
              <span
                className="edCategoryBadge"
                style={{ backgroundColor: event.categoryColor }}
              >
                {event.category}
              </span>
              <img
                src={event.imageUrl}
                alt={event.title}
                className="edHeroImage"
              />
              {isPast ? (
                <div className="edPastEventOverlay">
                  <p>
                    Wydarzenie odbyło się <strong>{dateFormatted}</strong>, nie przegap kolejnych okazji.
                  </p>
                  <Link href={similarEventsHref}>
                    {relatedEvents.length ? "Zobacz podobne niżej" : "Zobacz kolejne wydarzenia"}
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="edImageActions">
              <EventSaveButton
                eventId={event.id}
                initialSaved={saveState?.isSaved}
                isLoggedIn={saveState?.isLoggedIn}
                returnTo={eventPath(event)}
              />
            </div>
          </div>

          <div className="edHeroInfo">
            <h1>{event.title}</h1>

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

            {/* ====== INFO BAR ====== */}
            <section className="edInfoBar" aria-label="Szczegóły wydarzenia">
              <div className="edInfoBarHeader">
                <h2>Szczegóły wydarzenia</h2>
              </div>

              <div className="edInfoItem">
                <div className="edInfoIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <div className="edInfoText">
                  <span className="edInfoLabel">Kiedy</span>
                  <strong>{fullDate}</strong>
                </div>
              </div>

              <div className="edInfoItem">
                <div className="edInfoIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
                <div className="edInfoText">
                  <span className="edInfoLabel">Gdzie</span>
                  <strong>{event.address || "Lokalizacja nieznana"}</strong>
                </div>
              </div>

              <div className="edInfoItem">
                <div className="edInfoIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                </div>
                <div className="edInfoText">
                  <span className="edInfoLabel">Cena</span>
                  <strong>{event.price}</strong>
                  <span className="edInfoSub">{isFree ? "Bezpłatne" : "Bilety płatne"}</span>
                </div>
              </div>

              <div className="edInfoItem">
                <div className="edInfoIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                </div>
                <div className="edInfoText">
                  <span className="edInfoLabel">Kategoria</span>
                  <strong>{event.category}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>


        {/* ====== CONTENT GRID: Description + Map ====== */}
        <div className={`edContentGrid ${embedded ? "edContentGridEmbedded" : ""}`} id="opis">
          <section className="edDescSection">
            <h2>Opis wydarzenia</h2>
            <ExpandableDescription text={event.description ?? event.short_description} />
          </section>

          {!embedded ? (
            <section className="edMapSection" id={mapTargetId}>
              <h2>Lokalizacja</h2>
              <div className="edMapContainer">
                <EventDetailMap event={event} location={eventLocation} />
              </div>
              <p className="edMapAddress">{event.address || "Lokalizacja nieznana"}</p>
              {googleMapsUrl ? (
                <TrackedEventLink
                  eventId={event.id}
                  eventType="map_click"
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="edGoogleMapsLink"
                >
                  Otwórz w Google Maps
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </TrackedEventLink>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* ====== BOTTOM GRID: Organizer + Sources | Related ====== */}
        <div className="edBottomGrid">
          <div className="edBottomLeft">
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
                  <span>
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
                    Zadzwon
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
          </div>          {/* Więcej wydarzeń links */}
          <section className="edMoreLinksSection">
            <h2>Więcej ciekawych wydarzeń</h2>
            <div className="edMoreLinksGrid">
              <Link href={`/${categorySlug}/${citySlug}`} className="edMoreLinkCard">
                <span>Więcej z kategorii <strong>{categoryPlural}</strong> {formatInCity(event.city || "Polska")}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
              <Link href={`/${citySlug}`} className="edMoreLinkCard">
                <span>Więcej wydarzeń <strong>{formatInCity(event.city || "Polska")}</strong></span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            </div>
          </section>

          {/* Related Events */}
          {relatedEvents.length ? (
            <section className="edRelatedSection" id="podobne-wydarzenia">
              <div className="edRelatedHeader">
                <h2>Podobne wydarzenia</h2>
                <Link href={categoryPath(event.category)} className="edRelatedLink">
                  Zobacz wszystkie
                </Link>
              </div>
              <div className="edRelatedGrid">
                {relatedEvents.map((re) => (
                  <Link
                    key={re.id}
                    href={eventPath(re)}
                    className="edRelatedCard"
                    onClick={(e) => {
                      if (onOpenEvent && window.matchMedia("(max-width: 760px)").matches) {
                        e.preventDefault();
                        onOpenEvent(re.id);
                      }
                    }}
                  >
                    <div className="edRelatedCardImageWrap">
                      <img src={re.imageUrl} alt={re.title} />
                      <span
                        className="edRelatedCardBadge"
                        style={{ backgroundColor: re.categoryColor }}
                      >
                        {re.category}
                      </span>
                    </div>
                    <div className="edRelatedCardBody">
                      <h3>{re.title}</h3>
                      <span className="edRelatedCardDate">
                        {formatCompactDate(re.start_at, re.end_at)}
                      </span>
                      <span className="edRelatedCardLocation">{re.city || re.address}</span>
                      <span className={`edRelatedCardPrice ${isFreeEvent(re) ? "edRelatedCardPriceFree" : ""}`}>
                        {isFreeEvent(re)
                          ? "Bezpłatne"
                          : re.price_min != null
                            ? `od ${re.price_min} ${re.currency ?? "PLN"}`
                            : re.price}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </Wrapper>
  );
}

/* ---- Helpers ---- */

function formatDateRange(start: string, end: string | null) {
  const startLabel = formatPolishDate(start, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const startTime = formatPolishDate(start, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!end) return `${startLabel}, ${startTime}`;

  const startDay = getDateKeyInAppTimeZone(start);
  const endDay = getDateKeyInAppTimeZone(end);
  const endTime = formatPolishDate(end, { hour: "2-digit", minute: "2-digit" });

  if (startDay === endDay) {
    return `${startLabel}, ${startTime} \u2013 ${endTime}`;
  }

  const endLabel = formatPolishDate(end, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `${startLabel}, ${startTime} \u2013 ${endLabel}, ${endTime}`;
}

function formatCompactDate(start: string, end?: string | null) {
  const startDate = formatPolishDate(start, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (!end) return startDate;

  const startDay = getDateKeyInAppTimeZone(start);
  const endDay = getDateKeyInAppTimeZone(end);
  if (startDay === endDay) return startDate;

  const endDate = formatPolishDate(end, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${startDate} \u2013 ${endDate}`;
}

function isPastEvent(event: Pick<EventItem, "start_at" | "end_at">) {
  const startTime = new Date(event.start_at).getTime();
  const endTime = event.end_at
    ? new Date(event.end_at).getTime()
    : startTime + 2 * 60 * 60 * 1000;

  return Number.isFinite(endTime) && endTime < Date.now();
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
