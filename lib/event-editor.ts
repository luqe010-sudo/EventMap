import type { Database } from "@/database.types";
import { APP_TIME_ZONE, dateTimeLocalToUtcIso, toAppDate } from "@/lib/date-format";
import { slugify } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];

export type EventStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";

export type EventEditorOptions = {
  categories: Array<Pick<Tables["categories"]["Row"], "id" | "name">>;
  organizers: Array<Pick<Tables["organizers"]["Row"], "id" | "name">>;
  locations: Array<Pick<
    Tables["locations"]["Row"],
    "id" | "name" | "address" | "city_id" | "latitude" | "longitude" | "postal_code" | "voivodeship" | "county" | "municipality"
  > & {
    city: Pick<Tables["cities"]["Row"], "name"> | null;
  }>;
};

export type EditableEvent = Tables["events"]["Row"] & {
  category: Pick<Tables["categories"]["Row"], "id" | "name"> | null;
  location: Pick<
    Tables["locations"]["Row"],
    | "id"
    | "name"
    | "address"
    | "city_id"
    | "latitude"
    | "longitude"
    | "postal_code"
    | "voivodeship"
    | "county"
    | "municipality"
  > & {
    city: Pick<Tables["cities"]["Row"], "id" | "name" | "slug" | "latitude" | "longitude" | "county" | "voivodeship" | "is_active"> | null;
  } | null;
  organizer: Pick<Tables["organizers"]["Row"], "id" | "name"> | null;
  sources: Array<Pick<Tables["event_sources"]["Row"], "id" | "source_name" | "source_url" | "source_type">>;
};

export const eventStatuses: EventStatus[] = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "archived"
];

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function formNumber(formData: FormData, key: string) {
  const value = formString(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export function createSlug(text: string) {
  return slugify(text);
}

export function formSlug(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value ? createSlug(value) : null;
}

export function normalizeDateTimeLocal(value: string | null) {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  return dateTimeLocalToUtcIso(text, APP_TIME_ZONE);
}

export function assertEventStatus(status: string): asserts status is EventStatus {
  if (!eventStatuses.includes(status as EventStatus)) {
    throw new Error(`Nieprawidlowy status wydarzenia: ${status}`);
  }
}

export function editableEventSelect() {
  return `
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
    review_note,
    is_featured,
    is_verified,
    is_cancelled,
    category_id,
    location_id,
    organizer_id,
    created_by,
    submitted_by_organizer_id,
    published_at,
    category:categories(id, name),
    location:locations(id, name, address, city_id, latitude, longitude, postal_code, voivodeship, county, municipality, city:cities(id, name, slug, latitude, longitude, county, voivodeship, is_active)),
    organizer:organizers!events_organizer_id_fkey(id, name),
    sources:event_sources(id, source_name, source_url, source_type)
  `;
}

export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = toAppDate(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
