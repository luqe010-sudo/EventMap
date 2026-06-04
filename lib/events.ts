import type { Database } from "@/database.types";
import { createSupabaseServerClient } from "@/lib/supabase";
import { toPluralCategoryName, toPluralCategorySlug, toSlug } from "@/lib/slugs";

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

const FALLBACK_IMAGE = "/background.png";
const DEFAULT_CATEGORY_COLOR = "#64748b";

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
  category:categories(id, name, slug, icon, color),
  location:locations(name, address, city_id, municipality, county, voivodeship, latitude, longitude, google_maps_url, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)),
  organizer:organizers!events_organizer_id_fkey(name, slug, website, facebook_url, phone, email, logo_url, type, is_verified),
  sources:event_sources(source_name, source_url, source_type, last_seen_at)
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
  { label: "Warszawa", aliases: ["warszawa"], latitude: 52.2297, longitude: 21.0122 },
  { label: "Kraków", aliases: ["krakow"], latitude: 50.0647, longitude: 19.945 },
  { label: "Wrocław", aliases: ["wroclaw"], latitude: 51.1079, longitude: 17.0385 },
  { label: "Poznań", aliases: ["poznan"], latitude: 52.4064, longitude: 16.9252 },
  { label: "Gdańsk", aliases: ["gdansk"], latitude: 54.352, longitude: 18.6466 },
  { label: "Łódź", aliases: ["lodz"], latitude: 51.7592, longitude: 19.456 },
  { label: "Katowice", aliases: ["katowice"], latitude: 50.2649, longitude: 19.0238 }
];

export type ListEventsOptions = {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  includeCancelled?: boolean;
};

export async function listEvents(options: ListEventsOptions = {}): Promise<EventItem[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("start_at", { ascending: true });

  if (!options.includeCancelled) {
    query = query.or("is_cancelled.is.null,is_cancelled.eq.false");
  }

  if (options.dateFrom) {
    query = query.gte("start_at", options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lt("start_at", options.dateTo);
  }

  if (options.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.returns<SupabaseEventRecord[]>();
  if (error) throw new Error(`Nie udalo sie pobrac wydarzen: ${error.message}`);

  return (data ?? []).map(mapEventRecord);
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

export async function getHomeData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, categoryRows, activeCitySlugs] = await Promise.all([
    getHomeEvents(today.toISOString()),
    getHomeCategories(),
    getActiveCitySlugs()
  ]);

  return {
    events,
    categories: categoryRows.length ? categoryRows : getFallbackCategoryOptions(),
    activeCitySlugs
  };
}

async function getHomeEvents(dateFrom: string) {
  try {
    return await listEvents({ dateFrom, limit: 120 });
  } catch (error) {
    logPublicDataError("home events", error);
    return [];
  }
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
  return text
    .trim()
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
