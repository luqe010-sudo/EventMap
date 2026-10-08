import type { Database } from "@/database.types";
import { unstable_rethrow } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import {
  createSlug,
  formBoolean,
  formNumber,
  formSlug,
  formString,
  eventPublicationTimestamp
} from "@/lib/event-editor";
import { EventValidationError, eventValidationState, validateEventForm, type EventEditorState } from "@/lib/event-editor-validation";
import { uploadEventImageToCloudinary } from "@/lib/cloudinary";
import { resolveCityIdFromForm } from "@/lib/cities";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];

type EventWriteOptions = {
  organizerId: string;
  status: string;
} & ({ mode: "create"; createdBy: string | null } | {
  mode: "update";
  existing: Pick<Tables["events"]["Row"], "visibility" | "submitted_by_organizer_id" | "published_at">;
});

/** Only use before writing the event; a later source failure is a partial write. */
export function eventPreparationFailure(error: unknown): EventEditorState {
  unstable_rethrow(error);
  if (error instanceof EventValidationError) return eventValidationState(error);
  console.error("[event-editor] Failed to prepare event", error);
  return { fieldErrors: {}, error: "Nie udało się przygotować wydarzenia do zapisu. Spróbuj ponownie." };
}

export async function buildEventWritePayload(
  formData: FormData,
  options: EventWriteOptions
): Promise<EventInsert | EventUpdate> {
  const values = validateEventForm(formData, options.organizerId);
  const title = formString(formData, "title")!;
  const categoryId = formString(formData, "category_id")!;

  const uploadedImageUrl = await uploadEventImageToCloudinary(getEventImageFile(formData));

  return {
    title,
    slug: formSlug(formData, "slug") ?? createSlug(title),
    description: formString(formData, "description"),
    short_description: formString(formData, "short_description"),
    start_at: values.startAt,
    end_at: values.endAt,
    is_all_day: formBoolean(formData, "is_all_day"),
    category_id: categoryId,
    location_id: await resolveEventLocationId(formData),
    organizer_id: options.organizerId,
    submitted_by_organizer_id: options.mode === "update" ? options.existing.submitted_by_organizer_id : options.organizerId,
    price_type: values.priceType,
    price_min: values.priceMin,
    price_max: values.priceMax,
    currency: values.currency,
    main_image_url: uploadedImageUrl ?? formString(formData, "main_image_url"),
    status: options.status,
    visibility: options.mode === "update" ? options.existing.visibility : "public",
    published_at: eventPublicationTimestamp(options.status, options.mode === "update" ? options.existing.published_at : null),
    ...(options.mode === "create" ? { created_by: options.createdBy } : {})
  };
}

function getEventImageFile(formData: FormData) {
  const value = formData.get("main_image_file");
  return typeof value === "string" ? null : value;
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
    .order("id", { ascending: true })
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
    ? await supabase.from("event_sources").update(payload).eq("id", existing.id).eq("event_id", eventId).select("id").maybeSingle()
    : await supabase.from("event_sources").insert({ ...payload, event_id: eventId }).select("id").single();

  if (response.error) throw new Error(`Nie udalo sie zapisac zrodla: ${response.error.message}`);
  if (!response.data) throw new Error("Nie udało się potwierdzić zapisu źródła wydarzenia.");
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
  const latitude = formNumber(formData, "location_latitude");
  const longitude = formNumber(formData, "location_longitude");

  if (!name && !city && !address) return null;

  const supabase = await createSupabaseUserClient();
  const cityId = await resolveCityIdFromForm(supabase, formData, {
    nameKey: "location_city",
    countyKey: "location_county",
    voivodeshipKey: "location_voivodeship",
    latitudeKey: "location_latitude",
    longitudeKey: "location_longitude",
    defaultActive: true
  });

  // Try to find a matching existing location by coordinates first (very precise match)
  if (latitude !== null && longitude !== null) {
    const { data: matchedCoords, error: coordsError } = await supabase
      .from("locations")
      .select("id")
      .eq("latitude", latitude)
      .eq("longitude", longitude)
      .limit(1);

    if (!coordsError && matchedCoords && matchedCoords.length > 0) {
      return matchedCoords[0].id;
    }
  }

  // Or try by name, city id, and address
  if (cityId && address) {
    const { data: matchedFields, error: fieldsError } = await supabase
      .from("locations")
      .select("id")
      .eq("city_id", cityId)
      .eq("address", address)
      .eq("name", name ?? "")
      .limit(1);

    if (!fieldsError && matchedFields && matchedFields.length > 0) {
      return matchedFields[0].id;
    }
  }

  // Otherwise, create a new location record
  const { data, error } = await supabase
    .from("locations")
    .insert({
      name,
      city_id: cityId,
      address,
      latitude,
      longitude,
      postal_code: formString(formData, "location_postal_code"),
      voivodeship: formString(formData, "location_voivodeship"),
      county: formString(formData, "location_county"),
      municipality: formString(formData, "location_municipality")
    })
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc lokalizacji: ${error.message}`);
  return data.id;
}
