import type { Database } from "@/database.types";
import { createSupabaseServerClient } from "@/lib/supabase";
import { toPluralCategoryName, toPluralCategorySlug, toSlug } from "@/lib/slugs";
import { toAppDate } from "@/lib/date-format";
import { slugify } from "@/lib/slugify";
import type { DateFilter, PriceFilterMode } from "@/lib/filters";

type Tables = Database["public"]["Tables"];
type EventRow = Tables["events"]["Row"];
type CategoryRow = Tables["categories"]["Row"];
type CityRow = Tables["cities"]["Row"];
type LocationRow = Tables["locations"]["Row"];
type OrganizerRow = Tables["organizers"]["Row"];
type EventSourceRow = Tables["event_sources"]["Row"];
type CityPageRow = Tables["city_pages"]["Row"];

export type EventCategory = string;

export type EventSourceSummary = Pick<
  EventSourceRow,
  "source_name" | "source_url" | "source_type" | "last_seen_at"
>;

export type EventWithRelations = Pick<
  EventRow,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "short_description"
  | "start_at"
  | "end_at"
  | "is_all_day"
  | "main_image_url"
  | "price_type"
  | "price_min"
  | "price_max"
  | "currency"
  | "status"
  | "visibility"
  | "is_featured"
  | "is_verified"
  | "is_cancelled"
  | "updated_at"
> & {
  category: Pick<CategoryRow, "id" | "name" | "slug" | "icon" | "color"> | null;
  location: Pick<
    LocationRow,
    | "name"
    | "address"
    | "city_id"
    | "municipality"
    | "county"
    | "voivodeship"
    | "latitude"
    | "longitude"
    | "google_maps_url"
  > & {
    city: Pick<CityRow, "id" | "name" | "slug" | "latitude" | "longitude" | "county" | "voivodeship" | "is_active"> | null;
  } | null;
  organizer: Pick<
    OrganizerRow,
    "name" | "slug" | "website" | "facebook_url" | "phone" | "email" | "logo_url" | "type" | "is_verified"
  > | null;
  sources: EventSourceSummary[];
};

export type EventItem = Omit<EventWithRelations, "category" | "organizer"> & {
  imageUrl: string;
  startDate: string;
  endDate?: string;
  address: string;
  city: string;
  citySlug: string;
  latitude: number | null;
  longitude: number | null;
  categoryName: EventCategory;
  categorySlug: string;
  categoryRelation: EventWithRelations["category"];
  category: EventCategory;
  categoryColor: string;
  organizerName: string;
  organizer: string;
  organizerRelation: EventWithRelations["organizer"];
  organizerUrl: string;
  ticketUrl?: string;
  price: string;
  tags: string[];
  sourceType: "supabase";
  isFeatured: boolean;
};

export type KnownLocation = {
  label: string;
  aliases: string[];
  slug?: string;
  latitude: number;
  longitude: number;
};

export type CategoryOption = Pick<CategoryRow, "id" | "name" | "slug" | "icon" | "color">;
export type CityPage = CityPageRow & {
  city: Pick<CityRow, "id" | "name" | "slug" | "latitude" | "longitude" | "county" | "voivodeship" | "is_active"> | null;
};
export type CategoryCityRoute = {
  categorySlug: string;
  citySlug: string;
  cityLabel: string;
  latitude: number;
  longitude: number;
  lastmod: string;
};

export type PublicEventSitemapEntry = {
  path: string;
  lastmod: string;
};

export type PublicEventSearchOptions = {
  page?: number;
  pageSize?: number;
  maxResults?: number;
  dateFilter?: DateFilter;
  customDate?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  categorySlug?: string;
  cityId?: string;
  citySlug?: string;
  location?: Pick<KnownLocation, "latitude" | "longitude">;
  radiusKm?: number | null;
  priceMode?: PriceFilterMode;
  maxPrice?: number | null;
  featuredOnly?: boolean;
  includeCancelled?: boolean;
  includePast?: boolean;
};

export type PublicEventSearchResult = {
  events: EventItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  maxResults: number;
  shownCount: number;
  hasMore: boolean;
};

export type EventMapMarker = {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  address: string;
  city: string;
  citySlug: string;
  latitude: number | null;
  longitude: number | null;
  category: EventCategory;
  categorySlug: string;
  categoryColor: string;
  categoryIcon: string | null;
};

export type PublicCategoryCount = {
  category: EventCategory;
  count: number;
  color?: string | null;
};

type SupabaseEventRecord = EventRow & {
  category: Pick<CategoryRow, "id" | "name" | "slug" | "icon" | "color"> | null;
  location: Pick<
    LocationRow,
    | "name"
    | "address"
    | "city_id"
    | "municipality"
    | "county"
    | "voivodeship"
    | "latitude"
    | "longitude"
    | "google_maps_url"
  > & {
    city: Pick<CityRow, "id" | "name" | "slug" | "latitude" | "longitude" | "county" | "voivodeship" | "is_active"> | null;
  } | null;
  organizer: Pick<
    OrganizerRow,
    "name" | "slug" | "website" | "facebook_url" | "phone" | "email" | "logo_url" | "type" | "is_verified"
  > | null;
  sources: EventSourceSummary[] | null;
};

type CategoryCityEventRecord = Pick<EventRow, "published_at" | "start_at" | "updated_at"> & {
  category: Pick<CategoryRow, "slug"> | null;
  location: (Pick<LocationRow, "latitude" | "longitude"> & {
    city: Pick<CityRow, "name" | "slug" | "latitude" | "longitude" | "is_active"> | null;
  }) | null;
};

type SupabaseEventMarkerRecord = Pick<EventRow, "id" | "title" | "slug" | "start_at"> & {
  category: Pick<CategoryRow, "name" | "slug" | "icon" | "color"> | null;
  location: (Pick<LocationRow, "name" | "address" | "city_id" | "latitude" | "longitude"> & {
    city: Pick<CityRow, "name" | "slug"> | null;
  }) | null;
};

type SupabaseEventCategoryRecord = {
  category: Pick<CategoryRow, "name" | "color"> | null;
};

type SupabaseEventSitemapRecord = Pick<EventRow, "slug" | "start_at" | "updated_at"> & {
  category: Pick<CategoryRow, "slug"> | null;
  location: {
    city: Pick<CityRow, "slug"> | null;
  } | null;
};

const FALLBACK_IMAGE = "/background.png";
const DEFAULT_CATEGORY_COLOR = "#64748b";
export const PUBLIC_EVENTS_PAGE_SIZE = 20;
export const PUBLIC_EVENTS_MAX_RESULTS = 300;
export const PUBLIC_EVENT_MARKER_LIMIT = 10000;

const EVENT_SELECT = `
  id,
  title,
  slug,
  description,
  short_description,
  start_at,
  end_at,
  is_all_day,
  main_image_url,
  price_type,
  price_min,
  price_max,
  currency,
  status,
  visibility,
  is_featured,
  is_verified,
  is_cancelled,
  updated_at,
  category:categories(id, name, slug, icon, color),
  location:locations(name, address, city_id, municipality, county, voivodeship, latitude, longitude, google_maps_url, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)),
  organizer:organizers!events_organizer_id_fkey(name, slug, website, facebook_url, phone, email, logo_url, type, is_verified),
  sources:event_sources(source_name, source_url, source_type, last_seen_at)
`;

const EVENT_SELECT_WITH_INNER_LOCATION = `
  id,
  title,
  slug,
  description,
  short_description,
  start_at,
  end_at,
  is_all_day,
  main_image_url,
  price_type,
  price_min,
  price_max,
  currency,
  status,
  visibility,
  is_featured,
  is_verified,
  is_cancelled,
  updated_at,
  category:categories(id, name, slug, icon, color),
  location:locations!inner(name, address, city_id, municipality, county, voivodeship, latitude, longitude, google_maps_url, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)),
  organizer:organizers!events_organizer_id_fkey(name, slug, website, facebook_url, phone, email, logo_url, type, is_verified),
  sources:event_sources(source_name, source_url, source_type, last_seen_at)
`;

const EVENT_MARKER_SELECT = `
  id,
  title,
  slug,
  start_at,
  category:categories(name, slug, icon, color),
  location:locations(name, address, city_id, latitude, longitude, city:cities(name, slug))
`;

const EVENT_MARKER_SELECT_WITH_INNER_LOCATION = `
  id,
  title,
  slug,
  start_at,
  category:categories(name, slug, icon, color),
  location:locations!inner(name, address, city_id, latitude, longitude, city:cities(name, slug))
`;

const EVENT_CATEGORY_COUNT_SELECT = `
  category:categories(name, color)
`;

const EVENT_CATEGORY_COUNT_SELECT_WITH_INNER_LOCATION = `
  category:categories(name, color),
  location:locations!inner(city_id)
`;

export const categories: EventCategory[] = [
  "Koncert",
  "Festyn",
  "Dozynki",
  "Sport",
  "Rodzina",
  "Targi",
  "Motoryzacja",
  "Kultura",
  "Inne"
];

export const categoryColors: Record<EventCategory, string> = {
  Koncert: "#8b5cf6",
  Festyn: "#f59e0b",
  Dozynki: "#22c55e",
  Sport: "#3b82f6",
  Rodzina: "#ec4899",
  Targi: "#f97316",
  Motoryzacja: "#6366f1",
  Kultura: "#14b8a6",
  Inne: DEFAULT_CATEGORY_COLOR
};

export const categoryEmojis: Record<EventCategory, string> = {
  Koncert: "Muzyka",
  Festyn: "Festyn",
  Dozynki: "Dozynki",
  Sport: "Sport",
  Rodzina: "Rodzina",
  Targi: "Targi",
  Motoryzacja: "Moto",
  Kultura: "Kultura",
  Inne: "Inne"
};

export const knownLocations: KnownLocation[] = [
  { label: "Warszawa", aliases: ["warszawa"], slug: "warszawa", latitude: 52.2297, longitude: 21.0122 },
  { label: "Kraków", aliases: ["krakow"], slug: "krakow", latitude: 50.0647, longitude: 19.945 },
  { label: "Wrocław", aliases: ["wroclaw"], slug: "wroclaw", latitude: 51.1079, longitude: 17.0385 },
  { label: "Poznań", aliases: ["poznan"], slug: "poznan", latitude: 52.4064, longitude: 16.9252 },
  { label: "Gdańsk", aliases: ["gdansk"], slug: "gdansk", latitude: 54.352, longitude: 18.6466 },
  { label: "Łódź", aliases: ["lodz"], slug: "lodz", latitude: 51.7592, longitude: 19.456 },
  { label: "Katowice", aliases: ["katowice"], slug: "katowice", latitude: 50.2649, longitude: 19.0238 }
];

export type ListEventsOptions = {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  featuredOnly?: boolean;
  includeCancelled?: boolean;
};

export async function listEvents(options: ListEventsOptions = {}): Promise<EventItem[]> {
  const result = await searchPublicEvents({
    ...options,
    page: 1,
    pageSize: options.limit ?? 300,
    maxResults: options.limit ?? 300,
    includePast: options.dateFrom == null
  });
  return result.events;
}

export async function searchPublicEvents(options: PublicEventSearchOptions = {}): Promise<PublicEventSearchResult> {
  const supabase = createSupabaseServerClient();
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const maxResults = Math.min(Math.max(Math.floor(options.maxResults ?? PUBLIC_EVENTS_MAX_RESULTS), 1), 10000);
  const pageSize = Math.min(Math.max(Math.floor(options.pageSize ?? PUBLIC_EVENTS_PAGE_SIZE), 1), maxResults);
  const offset = (page - 1) * pageSize;

  if (offset >= maxResults) {
    return emptyPublicEventSearchResult(page, pageSize, maxResults);
  }

  const [categoryId, cityId, locationIds] = await Promise.all([
    resolveCategoryId(options.categoryId, options.categorySlug),
    resolveCityId(options.cityId, options.citySlug),
    resolveLocationIdsForRadius(options)
  ]);

  if ((options.categoryId || options.categorySlug) && !categoryId) {
    return emptyPublicEventSearchResult(page, pageSize, maxResults);
  }

  if ((options.cityId || options.citySlug) && !cityId) {
    return emptyPublicEventSearchResult(page, pageSize, maxResults);
  }

  if (locationIds && locationIds.length === 0) {
    return emptyPublicEventSearchResult(page, pageSize, maxResults);
  }

  const dateRange = getPublicSearchDateRange(options);
  const pageEnd = Math.min(offset + pageSize - 1, maxResults - 1);

  let query = supabase
    .from("events")
    .select(cityId ? EVENT_SELECT_WITH_INNER_LOCATION : EVENT_SELECT, { count: "exact" })
    .eq("status", "published")
    .eq("visibility", "public")
    .order("start_at", { ascending: true });

  if (!options.includeCancelled) {
    query = query.or("is_cancelled.is.null,is_cancelled.eq.false");
  }

  if (dateRange.dateFrom) {
    query = query.gte("start_at", dateRange.dateFrom);
  }

  if (dateRange.dateTo) {
    query = query.lt("start_at", dateRange.dateTo);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (cityId) {
    query = query.eq("location.city_id", cityId);
  }

  if (locationIds) {
    query = query.in("location_id", locationIds);
  }

  if (options.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  query = applyPublicPriceFilters(query, options);
  query = query.range(offset, pageEnd);

  const { data, error, count } = await query.returns<SupabaseEventRecord[]>();
  if (error) throw new Error(`Nie udalo sie pobrac wydarzen: ${error.message}`);

  const events = (data ?? []).map(mapEventRecord);
  const totalCount = count ?? events.length;
  const cappedTotal = Math.min(totalCount, maxResults);
  const shownCount = Math.min(offset + events.length, cappedTotal);

  return {
    events,
    totalCount,
    page,
    pageSize,
    maxResults,
    shownCount,
    hasMore: shownCount < cappedTotal
  };
}

export async function searchPublicEventMarkers(options: PublicEventSearchOptions = {}): Promise<EventMapMarker[]> {
  const supabase = createSupabaseServerClient();
  const markerLimit = Math.min(Math.max(Math.floor(options.maxResults ?? PUBLIC_EVENT_MARKER_LIMIT), 1), PUBLIC_EVENT_MARKER_LIMIT);
  const [categoryId, cityId, locationIds] = await Promise.all([
    resolveCategoryId(options.categoryId, options.categorySlug),
    resolveCityId(options.cityId, options.citySlug),
    resolveLocationIdsForRadius(options)
  ]);

  if ((options.categoryId || options.categorySlug) && !categoryId) return [];
  if ((options.cityId || options.citySlug) && !cityId) return [];
  if (locationIds && locationIds.length === 0) return [];

  const dateRange = getPublicSearchDateRange(options);
  let query = supabase
    .from("events")
    .select(cityId ? EVENT_MARKER_SELECT_WITH_INNER_LOCATION : EVENT_MARKER_SELECT)
    .eq("status", "published")
    .eq("visibility", "public")
    .not("location_id", "is", null)
    .order("start_at", { ascending: true })
    .limit(markerLimit);

  if (!options.includeCancelled) {
    query = query.or("is_cancelled.is.null,is_cancelled.eq.false");
  }

  if (dateRange.dateFrom) {
    query = query.gte("start_at", dateRange.dateFrom);
  }

  if (dateRange.dateTo) {
    query = query.lt("start_at", dateRange.dateTo);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (cityId) {
    query = query.eq("location.city_id", cityId);
  }

  if (locationIds) {
    query = query.in("location_id", locationIds);
  }

  if (options.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  query = applyPublicPriceFilters(query, options);

  const { data, error } = await query.returns<SupabaseEventMarkerRecord[]>();
  if (error) throw new Error(`Nie udalo sie pobrac pinezek wydarzen: ${error.message}`);

  return (data ?? []).map(mapEventMarkerRecord).filter(hasMarkerCoordinates);
}

export async function searchPublicEventCategoryCounts(options: PublicEventSearchOptions = {}): Promise<PublicCategoryCount[]> {
  const supabase = createSupabaseServerClient();
  const [categoryId, cityId, locationIds] = await Promise.all([
    resolveCategoryId(options.categoryId, options.categorySlug),
    resolveCityId(options.cityId, options.citySlug),
    resolveLocationIdsForRadius(options)
  ]);

  if ((options.categoryId || options.categorySlug) && !categoryId) return [];
  if ((options.cityId || options.citySlug) && !cityId) return [];
  if (locationIds && locationIds.length === 0) return [];

  const dateRange = getPublicSearchDateRange(options);
  let query = supabase
    .from("events")
    .select(cityId ? EVENT_CATEGORY_COUNT_SELECT_WITH_INNER_LOCATION : EVENT_CATEGORY_COUNT_SELECT)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("start_at", { ascending: true })
    .limit(PUBLIC_EVENT_MARKER_LIMIT);

  if (!options.includeCancelled) {
    query = query.or("is_cancelled.is.null,is_cancelled.eq.false");
  }

  if (dateRange.dateFrom) {
    query = query.gte("start_at", dateRange.dateFrom);
  }

  if (dateRange.dateTo) {
    query = query.lt("start_at", dateRange.dateTo);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (cityId) {
    query = query.eq("location.city_id", cityId);
  }

  if (locationIds) {
    query = query.in("location_id", locationIds);
  }

  query = applyPublicPriceFilters(query, options);

  const { data, error } = await query.returns<SupabaseEventCategoryRecord[]>();
  if (error) throw new Error(`Nie udalo sie policzyc kategorii wydarzen: ${error.message}`);

  const counts = new Map<EventCategory, PublicCategoryCount>();
  for (const record of data ?? []) {
    const category = toPluralCategoryName(record.category?.name ?? "Inne");
    const existing = counts.get(category);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(category, {
        category,
        count: 1,
        color: record.category?.color ?? categoryColors[category] ?? DEFAULT_CATEGORY_COLOR
      });
    }
  }

  return Array.from(counts.values()).sort((first, second) => second.count - first.count);
}

export async function listPublicEventsByIds(eventIds: string[]): Promise<EventItem[]> {
  if (!eventIds.length) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .in("id", eventIds)
    .eq("status", "published")
    .eq("visibility", "public")
    .or("is_cancelled.is.null,is_cancelled.eq.false")
    .returns<SupabaseEventRecord[]>();

  if (error) throw new Error(`Nie udalo sie pobrac zapisanych wydarzen: ${error.message}`);
  return (data ?? []).map(mapEventRecord);
}

export async function listPublicEventSitemapEntries(limit = 10000): Promise<PublicEventSitemapEntry[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(`
      slug,
      start_at,
      updated_at,
      category:categories(slug),
      location:locations(city:cities(slug))
    `)
    .eq("status", "published")
    .eq("visibility", "public")
    .or("is_cancelled.is.null,is_cancelled.eq.false")
    .order("start_at", { ascending: true })
    .limit(Math.min(Math.max(Math.floor(limit), 1), 10000))
    .returns<SupabaseEventSitemapRecord[]>();

  if (error) throw new Error(`Nie udalo sie pobrac mapy wydarzen: ${error.message}`);

  return (data ?? []).flatMap((event) => {
    if (!event.slug) return [];

    const categorySlug = toPluralCategorySlug(event.category?.slug ?? "inne");
    const citySlug = (event.location?.city?.slug ?? "polska").toLowerCase();
    const eventSlug = event.slug.toLowerCase();

    return [{
      path: `/${categorySlug}/${citySlug}/${eventSlug}`,
      lastmod: event.updated_at ?? event.start_at
    }];
  });
}

async function resolveCategoryId(categoryId?: string, categorySlug?: string) {
  if (categoryId) return categoryId;
  if (!categorySlug) return undefined;
  const category = await getCategoryBySlugFromDb(categorySlug);
  return category?.id;
}

async function resolveCityId(cityId?: string, citySlug?: string) {
  if (cityId) return cityId;
  if (!citySlug) return undefined;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", citySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie pobrac miasta: ${error.message}`);
  return data?.id;
}

async function resolveLocationIdsForRadius(options: PublicEventSearchOptions) {
  if (!options.location || options.radiusKm == null || !Number.isFinite(options.radiusKm)) return undefined;

  const radiusKm = Math.min(Math.max(Math.round(options.radiusKm), 1), 200);
  const latitude = options.location.latitude;
  const longitude = options.location.longitude;
  const latitudeDelta = radiusKm / 111;
  const longitudeDelta = radiusKm / Math.max(111 * Math.cos((latitude * Math.PI) / 180), 1);
  const supabase = createSupabaseServerClient();
  const ids: string[] = [];
  const chunkSize = 1000;

  for (let from = 0; from < 10000; from += chunkSize) {
    const { data, error } = await supabase
      .from("locations")
      .select("id, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", latitude - latitudeDelta)
      .lte("latitude", latitude + latitudeDelta)
      .gte("longitude", longitude - longitudeDelta)
      .lte("longitude", longitude + longitudeDelta)
      .range(from, from + chunkSize - 1);

    if (error) throw new Error(`Nie udalo sie pobrac lokalizacji w promieniu: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const distance = distanceInKmFromCoordinates(
        { latitude, longitude },
        { latitude: row.latitude, longitude: row.longitude }
      );
      if (distance <= radiusKm) ids.push(row.id);
    }
    if (rows.length < chunkSize) break;
  }

  return ids;
}

function getPublicSearchDateRange(options: PublicEventSearchOptions) {
  const now = new Date();
  let dateFrom = options.includePast ? options.dateFrom : options.dateFrom ?? now.toISOString();
  let dateTo = options.dateTo;

  if (options.dateFilter) {
    const range = resolvePublicDateRange(options.dateFilter, options.customDate ?? "", now);
    dateFrom = new Date(Math.max(range.start.getTime(), now.getTime())).toISOString();
    dateTo = range.end?.toISOString();
  }

  return { dateFrom, dateTo };
}

function applyPublicPriceFilters<T extends { or: (filters: string) => T }>(
  query: T,
  options: Pick<PublicEventSearchOptions, "priceMode" | "maxPrice">
) {
  if (options.priceMode === "free") {
    return query.or("price_type.eq.free,price_type.eq.bezplatne");
  }

  if (options.priceMode === "max") {
    const maxPrice = clampPublicMaxPrice(options.maxPrice ?? 0);
    return query.or(`price_type.eq.free,price_type.eq.bezplatne,price_min.lte.${maxPrice},price_max.lte.${maxPrice}`);
  }

  return query;
}

function resolvePublicDateRange(dateFilter: DateFilter, customDate: string, now = new Date()): { start: Date; end: Date | null } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  if (dateFilter === "all") return { start, end: null };
  if (dateFilter === "today") {
    end.setDate(start.getDate() + 1);
    return { start, end };
  }
  if (dateFilter === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end.setDate(start.getDate() + 1);
    return { start, end };
  }
  if (dateFilter === "weekend") {
    const day = start.getDay();
    if (day === 0) {
      end.setDate(start.getDate() + 1);
    } else if (day === 6) {
      end.setDate(start.getDate() + 2);
    } else {
      start.setDate(start.getDate() + (6 - day));
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 2);
    }
    return { start, end };
  }
  if (dateFilter === "week") {
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  const customRange = parsePublicCustomDateRange(customDate);
  if (customRange) {
    const selectedStart = new Date(`${customRange.from}T00:00:00`);
    const selectedEnd = new Date(`${customRange.to}T00:00:00`);
    selectedEnd.setDate(selectedEnd.getDate() + 1);
    return { start: selectedStart, end: selectedEnd };
  }

  return { start, end: null };
}

function parsePublicCustomDateRange(customDate: string) {
  const [rawFrom, rawTo] = customDate.split("/");
  const from = normalizePublicDateInput(rawFrom);
  const to = normalizePublicDateInput(rawTo);
  if (!from && !to) return null;
  const rangeFrom = from ?? to;
  const rangeTo = to ?? from;
  if (!rangeFrom || !rangeTo) return null;
  return rangeFrom <= rangeTo
    ? { from: rangeFrom, to: rangeTo }
    : { from: rangeTo, to: rangeFrom };
}

function normalizePublicDateInput(value?: string) {
  const trimmed = value?.trim();
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function distanceInKmFromCoordinates(
  origin: Pick<KnownLocation, "latitude" | "longitude">,
  event: Pick<EventItem, "latitude" | "longitude">
) {
  if (event.latitude == null || event.longitude == null) return Number.POSITIVE_INFINITY;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(event.latitude - origin.latitude);
  const longitudeDelta = toRadians(event.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const eventLatitude = toRadians(event.latitude);
  const angle =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) *
      Math.cos(eventLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}

function clampPublicMaxPrice(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(Math.round(value), 0), 500);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function emptyPublicEventSearchResult(page: number, pageSize: number, maxResults: number): PublicEventSearchResult {
  return {
    events: [],
    totalCount: 0,
    page,
    pageSize,
    maxResults,
    shownCount: 0,
    hasMore: false
  };
}

export async function listPublicCategoryCityRoutes(
  options: Pick<ListEventsOptions, "dateFrom" | "dateTo" | "limit"> = {}
): Promise<CategoryCityRoute[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("events")
    .select(`
      start_at,
      published_at,
      updated_at,
      category:categories!inner(slug),
      location:locations!inner(
        latitude,
        longitude,
        city:cities!inner(name, slug, latitude, longitude, is_active)
      )
    `)
    .eq("status", "published")
    .eq("visibility", "public")
    .or("is_cancelled.is.null,is_cancelled.eq.false")
    .order("start_at", { ascending: true });

  if (options.dateFrom) {
    query = query.gte("start_at", options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lt("start_at", options.dateTo);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.returns<CategoryCityEventRecord[]>();
  if (error) throw new Error(`Nie udalo sie pobrac tras kategorii i miast: ${error.message}`);

  const routes = new Map<string, CategoryCityRoute>();
  for (const record of data ?? []) {
    const categorySlug = record.category?.slug ? toPluralCategorySlug(record.category.slug) : null;
    const city = record.location?.city;
    if (!categorySlug || !city?.slug || city.is_active !== true) continue;

    const latitude = city.latitude ?? record.location?.latitude;
    const longitude = city.longitude ?? record.location?.longitude;
    if (latitude == null || longitude == null) continue;

    const key = `${categorySlug}/${city.slug}`;
    const lastmod = record.updated_at ?? record.published_at ?? record.start_at;
    const existing = routes.get(key);
    if (!existing) {
      routes.set(key, {
        categorySlug,
        citySlug: city.slug,
        cityLabel: city.name,
        latitude,
        longitude,
        lastmod
      });
    } else if (new Date(lastmod).getTime() > new Date(existing.lastmod).getTime()) {
      existing.lastmod = lastmod;
    }
  }

  return Array.from(routes.values()).sort((first, second) => {
    const byCategory = first.categorySlug.localeCompare(second.categorySlug, "pl");
    return byCategory || first.citySlug.localeCompare(second.citySlug, "pl");
  });
}

export async function getEventBySlug(slug: string): Promise<EventItem | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .or("is_cancelled.is.null,is_cancelled.eq.false")
    .maybeSingle()
    .returns<SupabaseEventRecord | null>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzenia: ${error.message}`);
  return data ? mapEventRecord(data) : null;
}

export async function listCategories(): Promise<CategoryOption[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, icon, color")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Nie udalo sie pobrac kategorii: ${error.message}`);
  return (data ?? []).map(item => ({
    ...item,
    name: toPluralCategoryName(item.name),
    slug: toPluralCategorySlug(item.slug)
  }));
}

export async function getCategoryBySlugFromDb(slug: string): Promise<CategoryOption | null> {
  const cats = await listCategories();
  const found = cats.find(c => toPluralCategorySlug(c.slug) === toPluralCategorySlug(slug));
  return found ?? null;
}

export async function getCityPageBySlug(slug: string): Promise<CityPage | null> {
  const supabase = createSupabaseServerClient();
  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id, name, slug, latitude, longitude, county, voivodeship, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (cityError) throw new Error(`Nie udalo sie pobrac miasta: ${cityError.message}`);
  if (!city) return null;

  const { data, error } = await supabase
    .from("city_pages")
    .select("*, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)")
    .eq("city_id", city.id)
    .maybeSingle()
    .returns<CityPage | null>();

  if (error) throw new Error(`Nie udalo sie pobrac strony miasta: ${error.message}`);
  return data;
}

export async function getActiveCitySlugs(): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  try {
    const { data } = await supabase
      .from("cities")
      .select("slug")
      .eq("is_active", true);
    return (data ?? []).map(item => item.slug);
  } catch (err) {
    console.error("getActiveCitySlugs error:", err);
    return [];
  }
}

export async function getActiveCityLocations(): Promise<KnownLocation[]> {
  const supabase = createSupabaseServerClient();
  try {
    const { data } = await supabase
      .from("cities")
      .select("name, slug, latitude, longitude, voivodeship")
      .eq("is_active", true)
      .order("name", { ascending: true });

    return (data ?? []).map((city) => {
      const voivodeship = city.voivodeship?.replace(/^województwo\s+/i, "");
      const label = voivodeship ? `${city.name} (woj. ${voivodeship})` : city.name;

      return {
        label,
        aliases: Array.from(new Set([city.slug, createSlug(city.name)].filter(Boolean))),
        slug: city.slug,
        latitude: city.latitude ?? getDefaultLocation().latitude,
        longitude: city.longitude ?? getDefaultLocation().longitude
      };
    });
  } catch (err) {
    console.error("getActiveCityLocations error:", err);
    return [];
  }
}

export async function getHomeData(searchOptions: PublicEventSearchOptions = {}) {
  const [eventSearch, categoryRows, activeCityLocations] = await Promise.all([
    getHomeEvents(searchOptions),
    getHomeCategories(),
    getActiveCityLocations()
  ]);

  return {
    events: eventSearch.events,
    eventSearch,
    categories: categoryRows.length ? categoryRows : getFallbackCategoryOptions(),
    activeCityLocations
  };
}

async function getHomeEvents(searchOptions: PublicEventSearchOptions = {}) {
  try {
    return await searchPublicEvents({
      ...searchOptions,
      page: searchOptions.page ?? 1,
      pageSize: searchOptions.pageSize ?? PUBLIC_EVENTS_PAGE_SIZE,
      maxResults: PUBLIC_EVENTS_MAX_RESULTS
    });
  } catch (error) {
    logPublicDataError("home events", error);
    return emptyPublicEventSearchResult(
      searchOptions.page ?? 1,
      searchOptions.pageSize ?? PUBLIC_EVENTS_PAGE_SIZE,
      PUBLIC_EVENTS_MAX_RESULTS
    );
  }
}

function mergeEventsById(...eventGroups: EventItem[][]) {
  const byId = new Map<string, EventItem>();
  for (const events of eventGroups) {
    for (const event of events) {
      byId.set(event.id, event);
    }
  }
  return Array.from(byId.values()).sort((first, second) => {
    return toAppDate(first.startDate).getTime() - toAppDate(second.startDate).getTime();
  });
}

async function getHomeCategories() {
  try {
    return await listCategories();
  } catch (error) {
    logPublicDataError("home categories", error);
    return getFallbackCategoryOptions();
  }
}

function getFallbackCategoryOptions(): CategoryOption[] {
  return categories.map((name) => ({
    id: name,
    name,
    slug: createSlug(name),
    icon: null,
    color: categoryColors[name] ?? DEFAULT_CATEGORY_COLOR
  }));
}

function logPublicDataError(context: string, error: unknown) {
  console.error(`[events] Failed to load ${context}`, error);
}

export function getDefaultLocation(): KnownLocation {
  return {
    label: "Polska",
    aliases: ["polska", "poland"],
    slug: "polska",
    latitude: 51.9194,
    longitude: 19.1451
  };
}

export function isFreeEvent(event: Pick<EventItem, "price_type" | "price">) {
  const priceType = event.price_type?.toLowerCase() ?? "";
  const price = event.price.toLowerCase();
  return priceType === "free" || priceType === "bezplatne" || price.includes("bezplat");
}

export function getCategoryColor(category: EventCategory, fallback?: string | null) {
  return fallback ?? categoryColors[category] ?? DEFAULT_CATEGORY_COLOR;
}

export function mapCityPageToLocation(cityPage: CityPage): KnownLocation {
  const city = cityPage.city;
  return {
    label: city?.name ?? "Polska",
    aliases: city ? [city.slug, createSlug(city.name)] : [],
    slug: city?.slug,
    latitude: city?.latitude ?? getDefaultLocation().latitude,
    longitude: city?.longitude ?? getDefaultLocation().longitude
  };
}

function mapEventRecord(record: SupabaseEventRecord): EventItem {
  const categoryName = toPluralCategoryName(record.category?.name ?? "Inne");
  const categorySlug = toPluralCategorySlug(record.category?.slug ?? createSlug(categoryName));
  const locationName = record.location?.name ?? "";
  const city = record.location?.city?.name ?? "";
  const citySlug = record.location?.city?.slug ?? createSlug(city || "polska");
  const address = [locationName, record.location?.address, city].filter(Boolean).join(", ");
  const organizerName = record.organizer?.name ?? "Organizator nieznany";
  const organizerUrl = record.organizer?.website ?? record.organizer?.facebook_url ?? "";

  const base: EventWithRelations = {
    id: record.id,
    title: record.title,
    slug: record.slug,
    description: record.description,
    short_description: record.short_description,
    start_at: record.start_at,
    end_at: record.end_at,
    is_all_day: record.is_all_day,
    main_image_url: record.main_image_url,
    price_type: record.price_type,
    price_min: record.price_min,
    price_max: record.price_max,
    currency: record.currency,
    status: record.status,
    visibility: record.visibility,
    is_featured: record.is_featured,
    is_verified: record.is_verified,
    is_cancelled: record.is_cancelled,
    updated_at: record.updated_at,
    category: record.category,
    location: record.location,
    organizer: record.organizer,
    sources: record.sources ?? []
  };

  return {
    ...base,
    imageUrl: record.main_image_url ?? FALLBACK_IMAGE,
    startDate: record.start_at,
    endDate: record.end_at ?? undefined,
    address,
    city,
    citySlug,
    latitude: record.location?.latitude ?? null,
    longitude: record.location?.longitude ?? null,
    categoryName,
    categorySlug,
    categoryRelation: record.category,
    category: categoryName,
    categoryColor: getCategoryColor(categoryName, record.category?.color),
    organizerName,
    organizer: organizerName,
    organizerRelation: record.organizer,
    organizerUrl,
    ticketUrl: record.sources?.find((source) => source.source_url)?.source_url ?? undefined,
    price: formatPrice(record),
    tags: [],
    sourceType: "supabase",
    isFeatured: Boolean(record.is_featured)
  };
}

function mapEventMarkerRecord(record: SupabaseEventMarkerRecord): EventMapMarker {
  const categoryName = toPluralCategoryName(record.category?.name ?? "Inne");
  const categorySlug = toPluralCategorySlug(record.category?.slug ?? createSlug(categoryName));
  const locationName = record.location?.name ?? "";
  const city = record.location?.city?.name ?? "";
  const citySlug = record.location?.city?.slug ?? createSlug(city || "polska");
  const address = [locationName, record.location?.address, city].filter(Boolean).join(", ");

  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    startDate: record.start_at,
    address,
    city,
    citySlug,
    latitude: record.location?.latitude ?? null,
    longitude: record.location?.longitude ?? null,
    category: categoryName,
    categorySlug,
    categoryColor: getCategoryColor(categoryName, record.category?.color),
    categoryIcon: record.category?.icon ?? null
  };
}

function hasMarkerCoordinates(marker: EventMapMarker): marker is EventMapMarker & { latitude: number; longitude: number } {
  return marker.latitude != null && marker.longitude != null;
}

function formatPrice(event: Pick<EventRow, "price_type" | "price_min" | "price_max" | "currency">) {
  const currency = event.currency ?? "PLN";
  const priceType = event.price_type?.toLowerCase() ?? "";

  if (priceType === "free" || priceType === "bezplatne") return "Bezpłatne";
  if (priceType === "unknown") return "Cena nieznana";
  if (event.price_min != null && event.price_max != null && event.price_min !== event.price_max) {
    return `${event.price_min}-${event.price_max} ${currency}`;
  }
  if (event.price_min != null) return `${event.price_min} ${currency}`;
  if (event.price_max != null) return `do ${event.price_max} ${currency}`;
  return priceType || "Cena nieznana";
}

export async function resolveCityLocation(citySlug: string): Promise<KnownLocation | null> {
  const normSlug = citySlug.trim().toLowerCase();

  // 1. Check knownLocations first
  const known = knownLocations.find(loc => loc.aliases.includes(normSlug));
  if (known) return known;

  const supabase = createSupabaseServerClient();

  // 2. Query canonical cities
  try {
    const { data: city } = await supabase
      .from("cities")
      .select("id, name, slug, latitude, longitude, county, voivodeship, is_active")
      .eq("slug", normSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (city) {
      return {
        label: city.name,
        aliases: [city.slug],
        slug: city.slug,
        latitude: city.latitude ?? getDefaultLocation().latitude,
        longitude: city.longitude ?? getDefaultLocation().longitude
      };
    }
  } catch (err) {
    console.error("resolveCityLocation cities error:", err);
  }

  return null;
}

function createSlug(text: string) {
  return slugify(text);
  /*
  return text
    .trim()
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  */
}
