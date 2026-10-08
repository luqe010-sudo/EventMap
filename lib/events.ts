import { resolveDateRange } from "./date-range";
import { publicDateLowerBoundExpression } from "./event-dates";
import type { Database } from "@/database.types";
import { createSupabaseServerClient } from "@/lib/supabase";
import { toPluralCategoryName, toPluralCategorySlug, toSlug } from "@/lib/slugs";
import { toAppDate } from "@/lib/date-format";
import { slugify } from "@/lib/slugify";
import type { DateFilter, PriceFilterMode } from "@/lib/filters";
import { comparePublicSearchItems, distanceBetweenCoordinates, hasLocationCoordinates, radiusBoundingBox, type Coordinates, type PublicEventSort } from "./event-search";
export { hasLocationCoordinates } from "./event-search";

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
    | "id"
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
  latitude: number | null;
  longitude: number | null;
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
  sortBy?: PublicEventSort;
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
    | "id"
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

type PublicSearchRecord = SupabaseEventMarkerRecord & {
  location: (NonNullable<SupabaseEventMarkerRecord["location"]> & Pick<LocationRow, "id">) | null;
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
// Above this volume, a database search/RPC is required. Never present a truncated pool as complete.
export const PUBLIC_EVENT_CANDIDATE_LIMIT = 50000;
const PUBLIC_EVENT_FETCH_BATCH_SIZE = 1000;

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
  location:locations(id, name, address, city_id, municipality, county, voivodeship, latitude, longitude, google_maps_url, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)),
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
  location:locations!inner(id, name, address, city_id, municipality, county, voivodeship, latitude, longitude, google_maps_url, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)),
  organizer:organizers!events_organizer_id_fkey(name, slug, website, facebook_url, phone, email, logo_url, type, is_verified),
  sources:event_sources(source_name, source_url, source_type, last_seen_at)
`;

const PUBLIC_SEARCH_SELECT = `
  id,
  title,
  slug,
  start_at,
  category:categories(name, slug, icon, color),
  location:locations(id, name, address, city_id, latitude, longitude, city:cities(name, slug))
`;

const PUBLIC_SEARCH_SELECT_WITH_INNER_LOCATION = `
  id,
  title,
  slug,
  start_at,
  category:categories(name, slug, icon, color),
  location:locations!inner(id, name, address, city_id, latitude, longitude, city:cities(name, slug))
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
  const page = clampPublicInteger(options.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const maxResults = clampPublicInteger(options.maxResults, PUBLIC_EVENTS_MAX_RESULTS, 1, 10000);
  const pageSize = clampPublicInteger(options.pageSize, PUBLIC_EVENTS_PAGE_SIZE, 1, maxResults);
  const offset = (page - 1) * pageSize;
  const context = await resolvePublicSearchContext(options);
  if (!context) return emptyPublicEventSearchResult(page, pageSize, maxResults);
  const records = await collectPublicSearchRecords(context);
  records.sort((first, second) => comparePublicSearchItems(
    { id: first.id, startDate: first.start_at, ...getSearchRecordCoordinates(first) },
    { id: second.id, startDate: second.start_at, ...getSearchRecordCoordinates(second) },
    options.sortBy,
    context.origin
  ));
  // The display cap is applied after filtering and sorting the whole candidate pool.
  const selectedRecords = records.slice(offset, Math.min(offset + pageSize, maxResults));
  const events = await readPublicSearchPage(context, selectedRecords);
  const totalCount = records.length;
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
  const context = await resolvePublicSearchContext(options);
  if (!context) return [];
  const records = await collectPublicSearchRecords(context);
  const markers = records.map(mapEventMarkerRecord).filter(hasMarkerCoordinates);
  const markerLimit = clampPublicInteger(options.maxResults, PUBLIC_EVENT_MARKER_LIMIT, 1, PUBLIC_EVENT_MARKER_LIMIT);
  if (markers.length > markerLimit) {
    throw new Error("Zbyt wiele wydarzeń na mapie. Zawęź termin, kategorię lub obszar wyszukiwania.");
  }
  return markers;
}

export async function searchPublicEventCategoryCounts(options: PublicEventSearchOptions = {}): Promise<PublicCategoryCount[]> {
  const context = await resolvePublicSearchContext(options);
  if (!context) return [];
  const records = await collectPublicSearchRecords(context);
  const counts = new Map<EventCategory, PublicCategoryCount>();
  for (const record of records) {
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
  const uniqueIds = [...new Set(eventIds)];
  const records: SupabaseEventRecord[] = [];
  // Keep URLs bounded and read every row even when Supabase's max_rows is low.
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const ids = uniqueIds.slice(offset, offset + 100);
    const batch = await readAllPublicRows((from, to) => supabase
      .from("events")
      .select(EVENT_SELECT, { count: "exact" })
      .in("id", ids)
      .eq("status", "published")
      .eq("visibility", "public")
      .or("is_cancelled.is.null,is_cancelled.eq.false")
      .order("id", { ascending: true })
      .range(from, to)
      .returns<SupabaseEventRecord[]>());
    records.push(...batch);
  }
  return records.map(mapEventRecord);
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

type PublicSearchContext = {
  options: PublicEventSearchOptions;
  dateRange: { dateFrom?: string; dateTo?: string };
  categoryId?: string;
  cityId?: string;
  origin?: Coordinates;
  radiusKm?: number;
};

async function resolveSearchCity(options: PublicEventSearchOptions) {
  if (!options.cityId && !options.citySlug) return null;
  const supabase = createSupabaseServerClient();
  let query = supabase.from("cities").select("id, latitude, longitude").eq("is_active", true);
  query = options.cityId ? query.eq("id", options.cityId) : query.eq("slug", options.citySlug!);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Nie udalo sie pobrac miasta: ${error.message}`);
  return data;
}

async function resolvePublicSearchContext(options: PublicEventSearchOptions): Promise<PublicSearchContext | null> {
  const [categoryId, city] = await Promise.all([
    resolveCategoryId(options.categoryId, options.categorySlug),
    resolveSearchCity(options)
  ]);
  if ((options.categoryId || options.categorySlug) && !categoryId) return null;
  if ((options.cityId || options.citySlug) && !city) return null;

  // A canonical city's centre is authoritative; an arbitrary point must not replace missing city data.
  const centre = city ?? options.location;
  const origin = hasLocationCoordinates(centre) ? { latitude: centre.latitude, longitude: centre.longitude } : undefined;
  const radiusRequested = options.radiusKm != null;
  if (radiusRequested && (!origin || !Number.isFinite(options.radiusKm))) {
    throw new Error("Nie można wyznaczyć promienia: brak poprawnych współrzędnych miejsca.");
  }
  if (options.sortBy === "nearest" && !origin) {
    throw new Error("Nie można sortować według odległości: brak współrzędnych miejsca.");
  }

  return {
    options,
    dateRange: getPublicSearchDateRange(options),
    categoryId,
    // Radius search intentionally includes locations in other cities.
    cityId: radiusRequested ? undefined : city?.id,
    origin,
    radiusKm: radiusRequested ? Math.min(Math.max(Math.round(options.radiusKm!), 1), 200) : undefined
  };
}

function buildPublicSearchQuery(context: PublicSearchContext, select: string) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from("events").select(select, { count: "exact" })
    .eq("status", "published").eq("visibility", "public")
    .order("start_at", { ascending: true }).order("id", { ascending: true });
  if (!context.options.includeCancelled) query = query.or("is_cancelled.is.null,is_cancelled.eq.false");
  if (context.dateRange.dateFrom) query = query.or(publicDateLowerBoundExpression(context.dateRange.dateFrom));
  if (context.dateRange.dateTo) query = query.lt("start_at", context.dateRange.dateTo);
  if (context.categoryId) query = query.eq("category_id", context.categoryId);
  if (context.cityId) query = query.eq("location.city_id", context.cityId);
  if (context.radiusKm != null && context.origin) {
    const bounds = radiusBoundingBox(context.origin, context.radiusKm);
    query = query.gte("location.latitude", bounds.minLatitude).lte("location.latitude", bounds.maxLatitude);
    if (bounds.minLongitude != null && bounds.maxLongitude != null) {
      query = query.gte("location.longitude", bounds.minLongitude).lte("location.longitude", bounds.maxLongitude);
    }
  }
  if (context.options.featuredOnly) query = query.eq("is_featured", true);
  return applyPublicPriceFilters(query, context.options);
}

type PublicRowsResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};

async function readAllPublicRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<PublicRowsResponse<T>>
): Promise<T[]> {
  const records: T[] = [];
  const seen = new Set<string>();
  let expectedCount: number | undefined;
  while (true) {
    const { data, error, count } = await fetchPage(records.length, records.length + PUBLIC_EVENT_FETCH_BATCH_SIZE - 1);
    if (error) throw new Error(`Nie udalo sie pobrac wydarzen: ${error.message}`);
    if (count == null || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("Nie udało się potwierdzić pełnej liczby wydarzeń.");
    }
    if (count > PUBLIC_EVENT_CANDIDATE_LIMIT) {
      throw new Error("Zbyt wiele wydarzeń. Zawęź termin, kategorię lub obszar wyszukiwania.");
    }
    if (expectedCount != null && count !== expectedCount) {
      throw new Error("Katalog wydarzeń zmienił się podczas wyszukiwania. Spróbuj ponownie.");
    }
    expectedCount = count;
    const rows = data ?? [];
    if (!rows.length && records.length < expectedCount) {
      throw new Error("Nie udało się pobrać wszystkich wydarzeń. Spróbuj ponownie.");
    }
    for (const record of rows) {
      if (seen.has(record.id)) throw new Error("Katalog wydarzeń zmienił się podczas wyszukiwania. Spróbuj ponownie.");
      seen.add(record.id);
      records.push(record);
    }
    if (records.length > expectedCount) throw new Error("Nie udało się potwierdzić pełnej liczby wydarzeń.");
    if (records.length === expectedCount) return records;
    // Supabase may enforce a lower max_rows than our requested page size.
    // Advance by actual rows, and use exact count rather than a short page as the end signal.
  }
}

function getSearchRecordCoordinates(record: PublicSearchRecord) {
  return { latitude: record.location?.latitude ?? null, longitude: record.location?.longitude ?? null };
}

async function collectPublicSearchRecords(context: PublicSearchContext) {
  const select = context.cityId || context.radiusKm != null ? PUBLIC_SEARCH_SELECT_WITH_INNER_LOCATION : PUBLIC_SEARCH_SELECT;
  const records = await readAllPublicRows((from, to) => buildPublicSearchQuery(context, select)
    .range(from, to).returns<PublicSearchRecord[]>());
  return context.radiusKm == null ? records : records.filter(record =>
    distanceBetweenCoordinates(context.origin, getSearchRecordCoordinates(record)) <= context.radiusKm!
  );
}

async function readPublicSearchPage(context: PublicSearchContext, selectedRecords: PublicSearchRecord[]) {
  const selectedIds = selectedRecords.map(record => record.id);
  if (!selectedIds.length) return [];
  const select = context.cityId || context.radiusKm != null ? EVENT_SELECT_WITH_INNER_LOCATION : EVENT_SELECT;
  const records: SupabaseEventRecord[] = [];
  // Keep IN filters short enough for the PostgREST URL even for an internal large page request.
  for (let offset = 0; offset < selectedIds.length; offset += 100) {
    const ids = selectedIds.slice(offset, offset + 100);
    const batch = await readAllPublicRows((from, to) => buildPublicSearchQuery(context, select)
      .in("id", ids).range(from, to).returns<SupabaseEventRecord[]>());
    if (batch.length !== ids.length || batch.some(record => !ids.includes(record.id))) {
      throw new Error("Katalog wydarzeń zmienił się podczas wyszukiwania. Spróbuj ponownie.");
    }
    records.push(...batch);
  }
  const candidates = new Map(selectedRecords.map(record => [record.id, record]));
  for (const record of records) {
    const candidate = candidates.get(record.id)!;
    if (record.start_at !== candidate.start_at ||
      record.location?.latitude !== candidate.location?.latitude ||
      record.location?.longitude !== candidate.location?.longitude ||
      record.location?.city_id !== candidate.location?.city_id) {
      throw new Error("Katalog wydarzeń zmienił się podczas wyszukiwania. Spróbuj ponownie.");
    }
  }
  const byId = new Map(records.map(record => [record.id, mapEventRecord(record)]));
  return selectedIds.map(id => byId.get(id)!);
}

function getPublicSearchDateRange(options: PublicEventSearchOptions) {
  const now = new Date();
  let dateFrom = options.includePast ? options.dateFrom : options.dateFrom ?? now.toISOString();
  let dateTo = options.dateTo;

  if (options.dateFilter) {
    const range = resolveDateRange(options.dateFilter, options.customDate ?? "", now);
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
    const maxPrice = clampPublicMaxPrice(options.maxPrice ?? 100);
    return query.or(`price_type.eq.free,price_type.eq.bezplatne,price_min.lte.${maxPrice},price_max.lte.${maxPrice}`);
  }

  return query;
}

function clampPublicMaxPrice(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(Math.round(value), 0), 500);
}

function clampPublicInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.floor(value!), minimum), maximum) : fallback;
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
  const publicQuery = () => supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .eq("visibility", "public")
    .or("is_cancelled.is.null,is_cancelled.eq.false");
  const { data, error } = await publicQuery()
    .eq("slug", slug)
    .maybeSingle()
    .returns<SupabaseEventRecord | null>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzenia: ${error.message}`);
  if (data) return mapEventRecord(data);

  // Imported slugs may retain capitals while public URLs use lowercase.
  // Escape LIKE metacharacters so the route segment remains a literal slug.
  const literalSlug = slug.replace(/[\\%_]/g, "\\$&");
  const { data: matches, error: lookupError } = await publicQuery()
    .ilike("slug", literalSlug)
    .limit(2)
    .returns<SupabaseEventRecord[]>();

  if (lookupError) throw new Error(`Nie udalo sie pobrac wydarzenia: ${lookupError.message}`);
  if (matches && matches.length > 1) throw new Error("Nie udalo sie pobrac wydarzenia: niejednoznaczny slug.");
  return matches?.[0] ? mapEventRecord(matches[0]) : null;
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
    const { data, error } = await supabase
      .from("cities")
      .select("slug")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    return (data ?? []).map(item => item.slug);
  } catch (err) {
    console.error("getActiveCitySlugs error:", err);
    return [];
  }
}

export async function getActiveCityLocations(): Promise<KnownLocation[]> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from("cities")
      .select("name, slug, latitude, longitude, voivodeship")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    return (data ?? []).map((city) => {
      const voivodeship = city.voivodeship?.replace(/^województwo\s+/i, "");
      const label = voivodeship ? `${city.name} (woj. ${voivodeship})` : city.name;

      return {
        label,
        aliases: Array.from(new Set([city.slug, createSlug(city.name)].filter(Boolean))),
        slug: city.slug,
        ...getCityCoordinates(city)
      };
    });
  } catch (err) {
    console.error("getActiveCityLocations error:", err);
    return [];
  }
}

export async function getHomeData(searchOptions: PublicEventSearchOptions = {}) {
  const [eventSearch, categoryRows, activeCityLocations, featuredSearch] = await Promise.all([
    getHomeEvents(searchOptions),
    getHomeCategories(),
    getActiveCityLocations(),
    getHomeEvents({ ...searchOptions, featuredOnly: true, page: 1, pageSize: 8 })
  ]);

  return {
    events: eventSearch.events,
    featuredEvents: featuredSearch.events,
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

export function getDefaultLocation(): KnownLocation & Coordinates {
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
    ...getCityCoordinates(city)
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
  return hasLocationCoordinates(marker);
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

  const supabase = createSupabaseServerClient();

  // Canonical data takes precedence, including its explicit lack of coordinates.
  try {
    const { data: city, error } = await supabase
      .from("cities")
      .select("id, name, slug, latitude, longitude, county, voivodeship, is_active")
      .eq("slug", normSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (city) {
      return {
        label: city.name,
        aliases: [city.slug],
        slug: city.slug,
        ...getCityCoordinates(city)
      };
    }
  } catch (err) {
    console.error("resolveCityLocation cities error:", err);
  }

  return knownLocations.find(loc => loc.aliases.includes(normSlug)) ?? null;
}

function getCityCoordinates(city: Pick<CityRow, "latitude" | "longitude"> | null | undefined) {
  return hasLocationCoordinates(city)
    ? { latitude: city.latitude, longitude: city.longitude }
    : { latitude: null, longitude: null };
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
