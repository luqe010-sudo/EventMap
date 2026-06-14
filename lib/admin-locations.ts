"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { formNumber, formString } from "@/lib/event-editor";
import { resolveCityIdFromForm, type CitySummary } from "@/lib/cities";
import { normalizeSearchText } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];
type LocationRow = Tables["locations"]["Row"];
type LocationInsert = Tables["locations"]["Insert"];
type LocationUpdate = Tables["locations"]["Update"];

export type AdminLocation = LocationRow & {
  city: CitySummary | null;
  eventCount: number;
  duplicateGroupSize: number;
};

export type AdminLocationFilters = {
  q?: string;
  city?: string;
  voivodeship?: string;
  events?: string;
  duplicates?: string;
  sort?: string;
  dir?: string;
};

export async function listAdminLocations(filters: AdminLocationFilters = {}): Promise<AdminLocation[]> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const [locationsResponse, eventsResponse] = await Promise.all([
    supabase
      .from("locations")
      .select("*, city:cities(id, name, slug, county, voivodeship, latitude, longitude, is_active)")
      .order("name", { ascending: true, nullsFirst: false })
      .limit(750)
      .returns<AdminLocation[]>(),
    supabase
      .from("events")
      .select("location_id")
      .not("location_id", "is", null)
      .limit(10000)
  ]);

  if (locationsResponse.error) {
    throw new Error(`Nie udalo sie pobrac lokalizacji: ${locationsResponse.error.message}`);
  }
  if (eventsResponse.error) {
    throw new Error(`Nie udalo sie policzyc wydarzen lokalizacji: ${eventsResponse.error.message}`);
  }

  const eventCounts = new Map<string, number>();
  for (const event of eventsResponse.data ?? []) {
    if (!event.location_id) continue;
    eventCounts.set(event.location_id, (eventCounts.get(event.location_id) ?? 0) + 1);
  }

  const rows = locationsResponse.data ?? [];
  const duplicateCounts = buildDuplicateCounts(rows);

  const enriched = rows.map((location) => ({
    ...location,
    eventCount: eventCounts.get(location.id) ?? 0,
    duplicateGroupSize: duplicateCounts.get(buildDuplicateKey(location)) ?? 0
  }));

  return sortAdminLocations(filterAdminLocations(enriched, filters), filters);
}

export async function getAdminLocationForEdit(id: string): Promise<AdminLocation | null> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("locations")
      .select("*, city:cities(id, name, slug, county, voivodeship, latitude, longitude, is_active)")
      .eq("id", id)
      .maybeSingle()
      .returns<AdminLocation | null>(),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("location_id", id)
  ]);

  if (error) throw new Error(`Nie udalo sie pobrac lokalizacji: ${error.message}`);
  if (countError) throw new Error(`Nie udalo sie policzyc wydarzen lokalizacji: ${countError.message}`);
  if (!data) return null;

  return {
    ...data,
    eventCount: count ?? 0,
    duplicateGroupSize: 0
  };
}

export async function adminCreateLocationAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const payload = await buildLocationPayload(formData);

  const { data, error } = await supabase
    .from("locations")
    .insert(payload as LocationInsert)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc lokalizacji: ${error.message}`);

  revalidateLocationPaths();
  redirect(`/admin/locations/${data.id}/edit`);
}

export async function adminUpdateLocationAction(locationId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const payload = {
    ...(await buildLocationPayload(formData)),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("locations")
    .update(payload as LocationUpdate)
    .eq("id", locationId);

  if (error) throw new Error(`Nie udalo sie zapisac lokalizacji: ${error.message}`);

  revalidateLocationPaths();
  redirect("/admin/locations");
}

export async function adminDeleteLocationAction(locationId: string) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { count, error: countError } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId);

  if (countError) throw new Error(`Nie udalo sie sprawdzic wydarzen lokalizacji: ${countError.message}`);
  if (count && count > 0) {
    throw new Error(`Nie mozna usunac lokalizacji, bo jest przypisana do ${count} wydarzen.`);
  }

  const { error } = await supabase.from("locations").delete().eq("id", locationId);
  if (error) throw new Error(`Nie udalo sie usunac lokalizacji: ${error.message}`);

  revalidateLocationPaths();
}

async function buildLocationPayload(formData: FormData): Promise<LocationInsert | LocationUpdate> {
  const supabase = await createSupabaseUserClient();
  const cityId = await resolveCityIdFromForm(supabase, formData, {
    nameKey: "location_city",
    countyKey: "location_county",
    voivodeshipKey: "location_voivodeship",
    latitudeKey: "location_latitude",
    longitudeKey: "location_longitude",
    defaultActive: true,
    updateExisting: true
  });

  return {
    name: formString(formData, "location_name"),
    address: formString(formData, "location_address"),
    city_id: cityId,
    postal_code: formString(formData, "location_postal_code"),
    municipality: formString(formData, "location_municipality"),
    county: formString(formData, "location_county"),
    voivodeship: formString(formData, "location_voivodeship"),
    latitude: formNumber(formData, "location_latitude"),
    longitude: formNumber(formData, "location_longitude"),
    google_maps_url: formString(formData, "google_maps_url"),
    place_id: formString(formData, "place_id")
  };
}

function buildDuplicateCounts(locations: AdminLocation[]) {
  const counts = new Map<string, number>();
  for (const location of locations) {
    const key = buildDuplicateKey(location);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildDuplicateKey(location: Pick<LocationRow, "name" | "address"> & { city: CitySummary | null }) {
  const tokens = [location.city?.name, location.name, location.address]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !DUPLICATE_STOP_WORDS.has(token));

  return Array.from(new Set(tokens)).sort().join("-");
}

const DUPLICATE_STOP_WORDS = new Set([
  "aleja",
  "al",
  "plac",
  "pl",
  "ulica",
  "ul",
  "im"
]);

function filterAdminLocations(locations: AdminLocation[], filters: AdminLocationFilters) {
  const q = normalizeSearch(filters.q);
  const city = normalizeSearch(filters.city);
  const voivodeship = normalizeSearch(filters.voivodeship);

  return locations.filter((location) => {
    if (q && ![
      location.name,
      location.address,
      location.city?.name,
      location.city?.slug,
      location.postal_code,
      location.municipality,
      location.county,
      location.voivodeship,
      location.place_id
    ].some((value) => normalizeSearch(value).includes(q))) {
      return false;
    }
    if (city && !normalizeSearch(location.city?.name).includes(city)) return false;
    if (voivodeship && !normalizeSearch(location.voivodeship ?? location.city?.voivodeship).includes(voivodeship)) return false;
    if (filters.events === "with" && location.eventCount === 0) return false;
    if (filters.events === "without" && location.eventCount > 0) return false;
    if (filters.duplicates === "yes" && location.duplicateGroupSize <= 1) return false;
    return true;
  });
}

function sortAdminLocations(locations: AdminLocation[], filters: AdminLocationFilters) {
  const sort = filters.sort ?? "city";
  const direction = filters.dir === "desc" ? -1 : 1;
  return [...locations].sort((first, second) => compareLocationValue(first, second, sort) * direction);
}

function compareLocationValue(first: AdminLocation, second: AdminLocation, sort: string) {
  if (sort === "name") return (first.name ?? "").localeCompare(second.name ?? "", "pl");
  if (sort === "address") return (first.address ?? "").localeCompare(second.address ?? "", "pl");
  if (sort === "events") return first.eventCount - second.eventCount;
  if (sort === "duplicates") return first.duplicateGroupSize - second.duplicateGroupSize;
  if (sort === "created_at") return dateValue(first.created_at) - dateValue(second.created_at);
  if (sort === "updated_at") return dateValue(first.updated_at) - dateValue(second.updated_at);
  const firstCity = first.city?.name ?? "";
  const secondCity = second.city?.name ?? "";
  return firstCity.localeCompare(secondCity, "pl") || (first.name ?? "").localeCompare(second.name ?? "", "pl");
}

function normalizeSearch(value: string | null | undefined) {
  return normalizeSearchText(value).trim();
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function revalidateLocationPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/locations");
  revalidatePath("/admin/cities");
  revalidatePath("/admin/events");
  revalidatePath("/admin/events/new");
  revalidatePath("/organizer/events/new");
  revalidatePath("/");
}
