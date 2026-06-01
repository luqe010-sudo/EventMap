import type { Database } from "@/database.types";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import {
  createSlug,
  formBoolean,
  formNumber,
  formString,
  normalizeDateTimeLocal
} from "@/lib/event-editor";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];

type EventWriteOptions = {
  organizerId: string;
  status: string;
  createdBy?: string | null;
};

export async function buildEventWritePayload(
  formData: FormData,
  options: EventWriteOptions
): Promise<EventInsert | EventUpdate> {
  const title = formString(formData, "title");
  const startAt = normalizeDateTimeLocal(formString(formData, "start_at"));
  const categoryId = formString(formData, "category_id");

  if (!title || !startAt) throw new Error("Tytul i data rozpoczecia sa wymagane.");
  if (!categoryId) throw new Error("Kategoria wydarzenia jest wymagana.");
  if (!options.organizerId) throw new Error("Organizator wydarzenia jest wymagany.");

  return {
    title,
    slug: formString(formData, "slug") ?? createSlug(title),
    description: formString(formData, "description"),
    short_description: formString(formData, "short_description"),
    start_at: startAt,
    end_at: normalizeDateTimeLocal(formString(formData, "end_at")),
    is_all_day: formBoolean(formData, "is_all_day"),
    category_id: categoryId,
    location_id: await resolveEventLocationId(formData),
    organizer_id: options.organizerId,
    submitted_by_organizer_id: options.organizerId,
    price_type: formString(formData, "price_type"),
    price_min: formNumber(formData, "price_min"),
    price_max: formNumber(formData, "price_max"),
    currency: formString(formData, "currency") ?? "PLN",
    main_image_url: formString(formData, "main_image_url"),
    status: options.status,
    visibility: "public",
    published_at: options.status === "published" ? new Date().toISOString() : null,
    created_by: options.createdBy ?? undefined
  };
}

export async function saveEventSource(
  eventId: string,
  formData: FormData,
  defaultSourceType: string
) {
  const sourceUrl = formString(formData, "source_url");
  const sourceName = formString(formData, "source_name");
  if (!sourceUrl && !sourceName) return;

  const supabase = await createSupabaseUserClient();
  const { data: existing, error: existingError } = await supabase
    .from("event_sources")
    .select("id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`Nie udalo sie sprawdzic zrodla: ${existingError.message}`);

  const payload = {
    source_url: sourceUrl,
    source_name: sourceName,
    source_type: formString(formData, "source_type") ?? defaultSourceType,
    last_seen_at: new Date().toISOString(),
    is_active: true
  };

  const response = existing?.id
    ? await supabase.from("event_sources").update(payload).eq("id", existing.id)
    : await supabase.from("event_sources").insert({ ...payload, event_id: eventId });

  if (response.error) throw new Error(`Nie udalo sie zapisac zrodla: ${response.error.message}`);
}

export async function deleteEventRelations(eventId: string) {
  const supabase = await createSupabaseUserClient();
  const deletions = [
    await supabase.from("event_sources").delete().eq("event_id", eventId),
    await supabase.from("event_tags").delete().eq("event_id", eventId),
    await supabase.from("saved_events").delete().eq("event_id", eventId)
  ];

  const failed = deletions.find((response) => response.error);
  if (failed?.error) {
    throw new Error(`Nie udalo sie usunac powiazanych danych wydarzenia: ${failed.error.message}`);
  }
}

async function resolveEventLocationId(formData: FormData) {
  const existingLocationId = formString(formData, "location_id");
  if (existingLocationId) return existingLocationId;

  const name = formString(formData, "location_name");
  const city = formString(formData, "location_city");
  const address = formString(formData, "location_address");
  if (!name && !city && !address) return null;

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({
      name,
      city,
      address,
      latitude: formNumber(formData, "location_latitude"),
      longitude: formNumber(formData, "location_longitude")
    })
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc lokalizacji: ${error.message}`);
  return data.id;
}
