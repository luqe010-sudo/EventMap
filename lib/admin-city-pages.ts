"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { formString } from "@/lib/event-editor";
import { resolveCityIdFromForm, type CitySummary } from "@/lib/cities";
import { normalizeSearchText } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];
type CityPageRow = Tables["city_pages"]["Row"];
type CityPageInsert = Tables["city_pages"]["Insert"];
type CityPageUpdate = Tables["city_pages"]["Update"];

export type AdminCityPage = CityPageRow & {
  city: CitySummary | null;
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
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const [cityPagesResponse, eventsResponse] = await Promise.all([
    supabase
      .from("city_pages")
      .select("*, city:cities(id, name, slug, county, voivodeship, latitude, longitude, is_active)")
      .limit(1000),
    supabase
      .from("events")
      .select("location:locations(city_id)")
      .limit(10000)
  ]);

  if (cityPagesResponse.error) throw new Error(`Nie udalo sie pobrac stron miast: ${cityPagesResponse.error.message}`);
  if (eventsResponse.error) throw new Error(`Nie udalo sie policzyc wydarzen miast: ${eventsResponse.error.message}`);

  const eventCountsByCityId = new Map<string, number>();
  for (const event of eventsResponse.data ?? []) {
    const cityId = event.location?.city_id;
    if (!cityId) continue;
    eventCountsByCityId.set(cityId, (eventCountsByCityId.get(cityId) ?? 0) + 1);
  }

  const cityPages = (cityPagesResponse.data ?? []).map((cityPage) => ({
    ...cityPage,
    eventCount: cityPage.city_id ? eventCountsByCityId.get(cityPage.city_id) ?? 0 : 0
  }));

  return sortAdminCityPages(filterAdminCityPages(cityPages, filters), filters);
}

export async function getAdminCityPageForEdit(id: string): Promise<AdminCityPage | null> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("city_pages")
    .select("*, city:cities(id, name, slug, county, voivodeship, latitude, longitude, is_active)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie pobrac strony miasta: ${error.message}`);
  if (!data) return null;

  const eventCount = data.city_id ? await countCityEvents(data.city_id) : 0;
  return {
    ...data,
    eventCount
  };
}

export async function adminCreateCityPageAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const cityId = await resolveCityIdFromForm(supabase, formData, {
    nameKey: "city",
    slugKey: "slug",
    countyKey: "county",
    voivodeshipKey: "voivodeship",
    latitudeKey: "latitude",
    longitudeKey: "longitude",
    activeKey: "is_active",
    updateExisting: true
  });
  if (!cityId) throw new Error("Nazwa miasta jest wymagana.");
  const payload = buildCityPagePayload(formData, cityId);

  const { data, error } = await supabase
    .from("city_pages")
    .insert(payload as CityPageInsert)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc strony miasta: ${error.message}`);

  revalidateCityPagePaths();
  redirect(`/admin/cities/${data.id}/edit`);
}

export async function adminUpdateCityPageAction(cityPageId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const cityId = await resolveCityIdFromForm(supabase, formData, {
    nameKey: "city",
    slugKey: "slug",
    countyKey: "county",
    voivodeshipKey: "voivodeship",
    latitudeKey: "latitude",
    longitudeKey: "longitude",
    activeKey: "is_active",
    updateExisting: true
  });
  if (!cityId) throw new Error("Nazwa miasta jest wymagana.");
  const payload = {
    ...buildCityPagePayload(formData, cityId),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("city_pages")
    .update(payload as CityPageUpdate)
    .eq("id", cityPageId);

  if (error) throw new Error(`Nie udalo sie zapisac strony miasta: ${error.message}`);

  revalidateCityPagePaths();
  redirect("/admin/cities");
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

function buildCityPagePayload(formData: FormData, cityId: string): CityPageInsert | CityPageUpdate {
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
