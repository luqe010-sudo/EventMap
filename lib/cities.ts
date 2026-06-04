import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import { createSlug, formBoolean, formNumber, formString } from "@/lib/event-editor";

type Tables = Database["public"]["Tables"];
type CityInsert = Tables["cities"]["Insert"];
type CityUpdate = Tables["cities"]["Update"];

export type CitySummary = Pick<
  Tables["cities"]["Row"],
  "id" | "name" | "slug" | "county" | "voivodeship" | "latitude" | "longitude" | "is_active"
>;

export type CityFormSource = {
  nameKey: string;
  slugKey?: string;
  countyKey?: string;
  voivodeshipKey?: string;
  latitudeKey?: string;
  longitudeKey?: string;
  activeKey?: string;
  defaultActive?: boolean;
  updateExisting?: boolean;
};

export async function resolveCityIdFromForm(
  supabase: SupabaseClient<Database>,
  formData: FormData,
  source: CityFormSource
) {
  const city = buildCityPayloadFromForm(formData, source);
  if (!city) return null;
  return findOrCreateCityId(supabase, city, {
    updateExisting: source.updateExisting ?? false
  });
}

export function buildCityPayloadFromForm(formData: FormData, source: CityFormSource): CityInsert | null {
  const name = formString(formData, source.nameKey);
  if (!name) return null;

  return {
    name,
    slug: formString(formData, source.slugKey ?? "city_slug") ?? createSlug(name),
    county: formString(formData, source.countyKey ?? "city_county"),
    voivodeship: formString(formData, source.voivodeshipKey ?? "city_voivodeship"),
    latitude: formNumber(formData, source.latitudeKey ?? "city_latitude"),
    longitude: formNumber(formData, source.longitudeKey ?? "city_longitude"),
    is_active: source.activeKey ? formBoolean(formData, source.activeKey) : source.defaultActive ?? true
  };
}

export async function findOrCreateCityId(
  supabase: SupabaseClient<Database>,
  city: CityInsert,
  options: { updateExisting?: boolean } = {}
) {
  const { data: existing, error: existingError } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", city.slug)
    .maybeSingle();

  if (existingError) throw new Error(`Nie udalo sie sprawdzic miasta: ${existingError.message}`);

  if (existing?.id) {
    if (options.updateExisting) {
      const { error: updateError } = await supabase
        .from("cities")
        .update({
          ...city,
          updated_at: new Date().toISOString()
        } as CityUpdate)
        .eq("id", existing.id);

      if (updateError) throw new Error(`Nie udalo sie zaktualizowac miasta: ${updateError.message}`);
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("cities")
    .insert(city)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc miasta: ${error.message}`);
  return data.id;
}
