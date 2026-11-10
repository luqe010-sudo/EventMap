import { cache } from "react";
import { searchPublicEvents, type EventItem } from "./events";
import { getSeason, listSeasons, resolveSeasonEdition, type SeasonSlug } from "./seasons";

const SEASON_CANDIDATE_LIMIT = 1000;

export type SeasonalEvents = {
  slug: SeasonSlug;
  year: number;
  events: EventItem[];
};

/**
 * Public, published, non-cancelled events of the current season edition that have not ended yet.
 * Cached per request so metadata, page and sitemap share one read.
 */
export const getSeasonalEvents = cache(async (slug: SeasonSlug): Promise<SeasonalEvents> => {
  const season = getSeason(slug);
  if (!season) throw new Error(`Nieznany sezon: ${slug}`);
  const now = new Date();
  const edition = resolveSeasonEdition(season, now);
  const result = await searchPublicEvents({
    dateFrom: new Date(Math.max(edition.start.getTime(), now.getTime())).toISOString(),
    dateTo: edition.end.toISOString(),
    maxResults: SEASON_CANDIDATE_LIMIT,
    pageSize: SEASON_CANDIDATE_LIMIT,
    sortBy: "date",
  });
  return {
    slug,
    year: edition.year,
    events: result.events.filter((event) => season.matches(event)),
  };
});

export async function listSeasonalEventCounts() {
  return Promise.all(listSeasons().map(async (season) => {
    const { year, events } = await getSeasonalEvents(season.slug);
    return { slug: season.slug, year, count: events.length };
  }));
}
