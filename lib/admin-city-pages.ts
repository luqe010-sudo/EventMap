"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { formString } from "@/lib/event-editor";
import { resolveCityIdFromForm, type CitySummary } from "@/lib/cities";

type Tables = Database["public"]["Tables"];
type CityPageRow = Tables["city_pages"]["Row"];
type CityPageInsert = Tables["city_pages"]["Insert"];
type CityPageUpdate = Tables["city_pages"]["Update"];

export type AdminCityPage = CityPageRow & {
  city: CitySummary | null;
  eventCount: number;
};

export async function listAdminCityPages(): Promise<AdminCityPage[]> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const [cityPagesResponse, eventsResponse] = await Promise.all([
    supabase
      .from("city_pages")
      .select("*, city:cities(id, name, slug, county, voivodeship, latitude, longitude, is_active)")
      .limit(500),
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

  return (cityPagesResponse.data ?? []).map((cityPage) => ({
    ...cityPage,
    eventCount: cityPage.city_id ? eventCountsByCityId.get(cityPage.city_id) ?? 0 : 0
  })).sort((first, second) => (first.city?.name ?? "").localeCompare(second.city?.name ?? "", "pl"));
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

function revalidateCityPagePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/cities");
  revalidatePath("/sitemap-cities.xml");
  revalidatePath("/");
}
