"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { formString } from "@/lib/event-editor";
import { buildCityPayloadFromForm, resolveCityIdFromForm, type CitySummary } from "@/lib/cities";
import { normalizeSearchText } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];
type UserClient = Awaited<ReturnType<typeof createSupabaseUserClient>>;
type CityPageRow = Tables["city_pages"]["Row"];
type CityPageInsert = Tables["city_pages"]["Insert"];
type CityPageUpdate = Tables["city_pages"]["Update"];
type CityRow = Tables["cities"]["Row"];
type CityUpdate = Tables["cities"]["Update"];

const CITY_FORM_SOURCE = {
  nameKey: "city",
  slugKey: "slug",
  countyKey: "county",
  voivodeshipKey: "voivodeship",
  latitudeKey: "latitude",
  longitudeKey: "longitude",
  activeKey: "is_active",
  updateExisting: true
};
const CITY_PAGE_SIZE = 1000;

/** `id` is the city id: a city needs no `city_pages` row to be managed. */
export type AdminCityPage = Pick<CityPageRow, "meta_title" | "meta_description" | "intro_text"> & {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  city: CitySummary;
  eventCount: number;
};

export type AdminCityPageFilters = {
  q?: string;
  status?: string;
  voivodeship?: string;
  events?: string;
  sort?: string;
  dir?: string;
};

export async function listAdminCityPages(filters: AdminCityPageFilters = {}): Promise<AdminCityPage[]> {
  await requireAdmin("/admin/cities");
  const supabase = await createSupabaseUserClient();
  const [cities, cityPagesResponse, eventsResponse] = await Promise.all([
    listAllCities(supabase),
    supabase.from("city_pages").select("*").limit(CITY_PAGE_SIZE),
    supabase
      .from("events")
      .select("location:locations(city_id)")
      .limit(10000)
  ]);

  if (cityPagesResponse.error) throw new Error(`Nie udało się pobrać stron miast: ${cityPagesResponse.error.message}`);
  if (eventsResponse.error) throw new Error(`Nie udało się policzyć wydarzeń miast: ${eventsResponse.error.message}`);

  const eventCountsByCityId = new Map<string, number>();
  for (const event of eventsResponse.data ?? []) {
    const cityId = event.location?.city_id;
    if (!cityId) continue;
    eventCountsByCityId.set(cityId, (eventCountsByCityId.get(cityId) ?? 0) + 1);
  }

  const pagesByCityId = new Map((cityPagesResponse.data ?? []).map((cityPage) => [cityPage.city_id, cityPage]));
  const cityPages = cities.map((city) =>
    toAdminCityPage(city, pagesByCityId.get(city.id) ?? null, eventCountsByCityId.get(city.id) ?? 0)
  );

  return sortAdminCityPages(filterAdminCityPages(cityPages, filters), filters);
}

export async function getAdminCityPageForEdit(id: string): Promise<AdminCityPage | null> {
  await requireAdmin("/admin/cities");
  const supabase = await createSupabaseUserClient();
  const { data: city, error } = await supabase.from("cities").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`Nie udało się pobrać miasta: ${error.message}`);
  if (!city) return null;

  const cityPage = await findCityPage(supabase, id);
  return toAdminCityPage(city, cityPage, await countCityEvents(id));
}

export async function adminCreateCityPageAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const cityId = await resolveCityIdFromForm(supabase, formData, CITY_FORM_SOURCE);
  if (!cityId) throw new Error("Nazwa miasta jest wymagana.");
  await saveCityPageContent(supabase, cityId, formData);

  revalidateCityPagePaths();
  redirect(`/admin/cities/${cityId}/edit`);
}

export async function adminUpdateCityPageAction(cityId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const city = buildCityPayloadFromForm(formData, CITY_FORM_SOURCE);
  if (!city) throw new Error("Nazwa miasta jest wymagana.");

  // Updating by id keeps a slug change on this city instead of creating another one.
  const { data, error } = await supabase
    .from("cities")
    .update({ ...city, updated_at: new Date().toISOString() } as CityUpdate)
    .eq("id", cityId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Nie udało się zapisać miasta: ${error.message}`);
  if (!data) throw new Error("Nie potwierdzono zapisu miasta.");
  await saveCityPageContent(supabase, cityId, formData);

  revalidateCityPagePaths();
  redirect("/admin/cities");
}

async function listAllCities(supabase: UserClient) {
  const cities: CityRow[] = [];
  for (let from = 0; ; from += CITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name")
      .order("id")
      .range(from, from + CITY_PAGE_SIZE - 1);
    if (error) throw new Error(`Nie udało się pobrać miast: ${error.message}`);
    cities.push(...(data ?? []));
    if ((data ?? []).length < CITY_PAGE_SIZE) return cities;
  }
}

async function findCityPage(supabase: UserClient, cityId: string) {
  const { data, error } = await supabase
    .from("city_pages")
    .select("*")
    .eq("city_id", cityId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Nie udało się pobrać strony miasta: ${error.message}`);
  return data;
}

async function saveCityPageContent(supabase: UserClient, cityId: string, formData: FormData) {
  const payload = buildCityPagePayload(formData, cityId);
  const existing = await findCityPage(supabase, cityId);

  if (existing) {
    const { error } = await supabase
      .from("city_pages")
      .update({ ...payload, updated_at: new Date().toISOString() } as CityPageUpdate)
      .eq("id", existing.id);
    if (error) throw new Error(`Nie udało się zapisać strony miasta: ${error.message}`);
    return;
  }

  if (!payload.meta_title && !payload.meta_description && !payload.intro_text) return;
  const { error } = await supabase.from("city_pages").insert(payload as CityPageInsert);
  if (error) throw new Error(`Nie udało się utworzyć strony miasta: ${error.message}`);
}

function toAdminCityPage(city: CityRow, cityPage: CityPageRow | null, eventCount: number): AdminCityPage {
  return {
    id: city.id,
    created_at: city.created_at,
    updated_at: cityPage?.updated_at ?? city.updated_at,
    meta_title: cityPage?.meta_title ?? null,
    meta_description: cityPage?.meta_description ?? null,
    intro_text: cityPage?.intro_text ?? null,
    city,
    eventCount
  };
}

async function countCityEvents(cityId: string) {
  const supabase = await createSupabaseUserClient();
  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id")
    .eq("city_id", cityId)
    .limit(1000);

  if (locationsError) throw new Error(`Nie udalo sie pobrac lokalizacji miasta: ${locationsError.message}`);
  const ids = (locations ?? []).map((location) => location.id);
  if (!ids.length) return 0;

  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("location_id", ids);

  if (error) throw new Error(`Nie udalo sie policzyc wydarzen miasta: ${error.message}`);
  return count ?? 0;
}

function buildCityPagePayload(formData: FormData, cityId: string) {
  return {
    city_id: cityId,
    meta_title: formString(formData, "meta_title"),
    meta_description: formString(formData, "meta_description"),
    intro_text: formString(formData, "intro_text")
  };
}

function filterAdminCityPages(cityPages: AdminCityPage[], filters: AdminCityPageFilters) {
  const q = normalizeSearch(filters.q);
  const voivodeship = normalizeSearch(filters.voivodeship);

  return cityPages.filter((cityPage) => {
    if (filters.status === "active" && cityPage.city?.is_active !== true) return false;
    if (filters.status === "inactive" && cityPage.city?.is_active === true) return false;
    if (filters.events === "with" && cityPage.eventCount === 0) return false;
    if (filters.events === "without" && cityPage.eventCount > 0) return false;
    if (voivodeship && !normalizeSearch(cityPage.city?.voivodeship).includes(voivodeship)) return false;
    if (q && ![
      cityPage.city?.name,
      cityPage.city?.slug,
      cityPage.city?.county,
      cityPage.city?.voivodeship,
      cityPage.meta_title,
      cityPage.meta_description,
      cityPage.intro_text
    ].some((value) => normalizeSearch(value).includes(q))) {
      return false;
    }
    return true;
  });
}

function sortAdminCityPages(cityPages: AdminCityPage[], filters: AdminCityPageFilters) {
  const sort = filters.sort ?? "name";
  const direction = filters.dir === "desc" ? -1 : 1;
  return [...cityPages].sort((first, second) => compareCityPageValue(first, second, sort) * direction);
}

function compareCityPageValue(first: AdminCityPage, second: AdminCityPage, sort: string) {
  if (sort === "slug") return (first.city?.slug ?? "").localeCompare(second.city?.slug ?? "", "pl");
  if (sort === "voivodeship") return (first.city?.voivodeship ?? "").localeCompare(second.city?.voivodeship ?? "", "pl");
  if (sort === "events") return first.eventCount - second.eventCount;
  if (sort === "created_at") return dateValue(first.created_at) - dateValue(second.created_at);
  if (sort === "updated_at") return dateValue(first.updated_at) - dateValue(second.updated_at);
  if (sort === "status") return Number(Boolean(first.city?.is_active)) - Number(Boolean(second.city?.is_active));
  return (first.city?.name ?? "").localeCompare(second.city?.name ?? "", "pl");
}

function normalizeSearch(value: string | null | undefined) {
  return normalizeSearchText(value).trim();
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function revalidateCityPagePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/cities");
  revalidatePath("/sitemap-cities.xml");
  revalidatePath("/");
}
