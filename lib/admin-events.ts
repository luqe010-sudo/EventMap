"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { assertEventStatus, editableEventSelect, formBoolean, formString, type EditableEvent, type EventStatus } from "@/lib/event-editor";
import { buildEventWritePayload, deleteEventRelations, saveEventSource } from "@/lib/event-editor-server";
import { normalizeSearchText } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];
type ModerationLogInsert = Tables["event_moderation_logs"]["Insert"];
type NotificationInsert = Tables["notifications"]["Insert"];

const ADMIN_EVENT_LIST_SELECT = `
  id,
  title,
  created_at,
  updated_at,
  start_at,
  published_at,
  status,
  visibility,
  review_note,
  is_featured,
  submitted_by_organizer_id,
  category:categories(name),
  location:locations(city:cities(name)),
  organizer:organizers!events_organizer_id_fkey(name)
`;

export type AdminEventListItem = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  start_at: string;
  published_at: string | null;
  status: string | null;
  visibility: string | null;
  review_note: string | null;
  is_featured: boolean | null;
  submitted_by_organizer_id: string | null;
  category: { name: string } | null;
  location: { city: { name: string } | null } | null;
  organizer: { name: string } | null;
};

export type AdminEventListFilters = {
  q?: string;
  status?: string;
  category?: string;
  city?: string;
  organizer?: string;
  featured?: string;
  eventFrom?: string;
  eventTo?: string;
  createdFrom?: string;
  createdTo?: string;
  publishedFrom?: string;
  publishedTo?: string;
  sort?: string;
  dir?: string;
};

export async function getAdminDashboard() {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();

  const [pending, published, rejected, recent] = await Promise.all([
    countEventsByStatus("pending_review"),
    countEventsByStatus("published"),
    countEventsByStatus("rejected"),
    supabase
      .from("events")
      .select(ADMIN_EVENT_LIST_SELECT)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<AdminEventListItem[]>()
  ]);

  if (recent.error) throw new Error(`Nie udalo sie pobrac ostatnich wydarzen: ${recent.error.message}`);

  return {
    pendingReview: pending,
    published,
    rejected,
    recentEvents: recent.data ?? []
  };
}

export async function listAdminEvents(filters: AdminEventListFilters = {}) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  let query = supabase
    .from("events")
    .select(ADMIN_EVENT_LIST_SELECT);

  query = applyAdminEventDateFilters(query, filters);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.featured === "yes") query = query.eq("is_featured", true);
  if (filters.featured === "no") query = query.or("is_featured.is.null,is_featured.eq.false");

  const { data, error } = await query
    .limit(1000)
    .returns<AdminEventListItem[]>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzen admina: ${error.message}`);
  return sortAdminEvents(filterAdminEvents(data ?? [], filters), filters);
}

export async function listAdminReviewEvents(filters: AdminEventListFilters = {}) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  let query = supabase
    .from("events")
    .select(ADMIN_EVENT_LIST_SELECT)
    .in("status", ["draft", "pending_review"]);

  query = applyAdminEventDateFilters(query, filters);

  const { data, error } = await query
    .limit(1000)
    .returns<AdminEventListItem[]>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzen do zatwierdzenia: ${error.message}`);
  return sortAdminEvents(filterAdminEvents(data ?? [], filters), {
    ...filters,
    sort: filters.sort ?? "created_at"
  });
}

export async function getAdminEventEditorOptions() {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const [categories, organizers, locations] = await Promise.all([
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
    supabase.from("organizers").select("id, name").order("name", { ascending: true }),
    supabase
      .from("locations")
      .select("id, name, address, city_id, latitude, longitude, postal_code, voivodeship, county, municipality, city:cities(name)")
      .order("name", { ascending: true })
      .limit(500)
  ]);

  if (categories.error) throw new Error(`Nie udalo sie pobrac kategorii: ${categories.error.message}`);
  if (organizers.error) throw new Error(`Nie udalo sie pobrac organizatorow: ${organizers.error.message}`);
  if (locations.error) throw new Error(`Nie udalo sie pobrac lokalizacji: ${locations.error.message}`);

  return {
    categories: categories.data ?? [],
    organizers: organizers.data ?? [],
    locations: locations.data ?? []
  };
}

export async function getAdminEventForEdit(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .select(editableEventSelect())
    .eq("id", id)
    .maybeSingle()
    .returns<EditableEvent | null>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzenia: ${error.message}`);
  return data;
}

export async function adminCreateEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const status = formString(formData, "status") ?? "published";
  assertEventStatus(status);
  const event = await buildEventWritePayload(formData, {
    organizerId: formString(formData, "organizer_id") ?? "",
    status,
    createdBy: admin.userId
  });
  event.review_note = status === "rejected" ? formString(formData, "review_note") : null;
  event.is_featured = formBoolean(formData, "is_featured");

  const { data, error } = await supabase
    .from("events")
    .insert(event as EventInsert)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc wydarzenia: ${error.message}`);

  await saveEventSource(data.id, formData, "manual");
  revalidateAdminPaths();
  redirect(`/admin/events/${data.id}/edit`);
}

export async function adminUpdateEventAction(eventId: string, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const existing = await getAdminEventStatusSnapshot(eventId);
  const status = formString(formData, "status") ?? "published";
  assertEventStatus(status);
  const reviewNote = formString(formData, "review_note");
  const event = await buildEventWritePayload(formData, {
    organizerId: formString(formData, "organizer_id") ?? "",
    status
  });
  event.review_note = status === "rejected" ? reviewNote : reviewNote ?? null;
  event.is_featured = formBoolean(formData, "is_featured");

  const { error } = await supabase
    .from("events")
    .update(event as EventUpdate)
    .eq("id", eventId);

  if (error) throw new Error(`Nie udalo sie zapisac wydarzenia: ${error.message}`);

  await saveEventSource(eventId, formData, "manual");
  if (existing?.status !== status || reviewNote) {
    await recordModerationDecision({
      eventId,
      reviewedBy: admin.userId,
      oldStatus: existing?.status ?? null,
      newStatus: status,
      note: reviewNote,
      title: existing?.title ?? event.title ?? "Wydarzenie",
      organizerId: existing?.submitted_by_organizer_id ?? null
    });
  }
  revalidateAdminPaths();
  redirect("/admin/events");
}

export async function adminSetEventStatusAction(eventId: string, status: EventStatus, formData?: FormData) {
  const admin = await requireAdmin();
  assertEventStatus(status);
  const supabase = await createSupabaseUserClient();
  const existing = await getAdminEventStatusSnapshot(eventId);
  const note = formData ? formString(formData, "review_note") : null;
  const { error } = await supabase
    .from("events")
    .update({
      status,
      review_note: status === "rejected" ? note : null,
      published_at: status === "published" ? new Date().toISOString() : null
    })
    .eq("id", eventId);

  if (error) throw new Error(`Nie udalo sie zmienic statusu: ${error.message}`);
  await recordModerationDecision({
    eventId,
    reviewedBy: admin.userId,
    oldStatus: existing?.status ?? null,
    newStatus: status,
    note,
    title: existing?.title ?? "Wydarzenie",
    organizerId: existing?.submitted_by_organizer_id ?? null
  });
  revalidateAdminPaths();
}

export async function adminDeleteEventAction(eventId: string) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();

  await deleteEventRelations(eventId);

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(`Nie udalo sie usunac wydarzenia: ${error.message}`);

  revalidateAdminPaths();
}

async function countEventsByStatus(status: EventStatus) {
  const supabase = await createSupabaseUserClient();
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) throw new Error(`Nie udalo sie policzyc wydarzen ${status}: ${error.message}`);
  return count ?? 0;
}

function revalidateAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/admin/review");
  revalidatePath("/organizer");
  revalidatePath("/organizer/events");
  revalidatePath("/organizer/stats");
  revalidatePath("/");
}

function applyAdminEventDateFilters<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(
  query: T,
  filters: AdminEventListFilters
) {
  let next = query;
  if (filters.eventFrom) next = next.gte("start_at", startOfDayIso(filters.eventFrom));
  if (filters.eventTo) next = next.lte("start_at", endOfDayIso(filters.eventTo));
  if (filters.createdFrom) next = next.gte("created_at", startOfDayIso(filters.createdFrom));
  if (filters.createdTo) next = next.lte("created_at", endOfDayIso(filters.createdTo));
  if (filters.publishedFrom) next = next.gte("published_at", startOfDayIso(filters.publishedFrom));
  if (filters.publishedTo) next = next.lte("published_at", endOfDayIso(filters.publishedTo));
  return next;
}

function filterAdminEvents(events: AdminEventListItem[], filters: AdminEventListFilters) {
  const q = normalizeSearch(filters.q);
  const category = normalizeSearch(filters.category);
  const city = normalizeSearch(filters.city);
  const organizer = normalizeSearch(filters.organizer);

  return events.filter((event) => {
    if (q && ![
      event.title,
      event.status,
      event.category?.name,
      event.location?.city?.name,
      event.organizer?.name,
      event.review_note
    ].some((value) => normalizeSearch(value).includes(q))) {
      return false;
    }
    if (category && !normalizeSearch(event.category?.name).includes(category)) return false;
    if (city && !normalizeSearch(event.location?.city?.name).includes(city)) return false;
    if (organizer && !normalizeSearch(event.organizer?.name).includes(organizer)) return false;
    return true;
  });
}

function sortAdminEvents(events: AdminEventListItem[], filters: AdminEventListFilters) {
  const sort = filters.sort ?? "created_at";
  const direction = filters.dir === "asc" ? 1 : -1;

  return [...events].sort((first, second) => {
    const result = compareAdminEventValue(first, second, sort);
    return result * direction;
  });
}

function compareAdminEventValue(first: AdminEventListItem, second: AdminEventListItem, sort: string) {
  if (sort === "title") return first.title.localeCompare(second.title, "pl");
  if (sort === "category") return (first.category?.name ?? "").localeCompare(second.category?.name ?? "", "pl");
  if (sort === "city") return (first.location?.city?.name ?? "").localeCompare(second.location?.city?.name ?? "", "pl");
  if (sort === "organizer") return (first.organizer?.name ?? "").localeCompare(second.organizer?.name ?? "", "pl");
  if (sort === "status") return (first.status ?? "").localeCompare(second.status ?? "", "pl");
  if (sort === "published_at") return dateValue(first.published_at) - dateValue(second.published_at);
  if (sort === "updated_at") return dateValue(first.updated_at) - dateValue(second.updated_at);
  if (sort === "start_at") return dateValue(first.start_at) - dateValue(second.start_at);
  return dateValue(first.created_at) - dateValue(second.created_at);
}

function normalizeSearch(value: string | null | undefined) {
  return normalizeSearchText(value).trim();
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function startOfDayIso(value: string) {
  return `${value}T00:00:00.000Z`;
}

function endOfDayIso(value: string) {
  return `${value}T23:59:59.999Z`;
}

async function getAdminEventStatusSnapshot(eventId: string) {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, status, submitted_by_organizer_id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie pobrac statusu wydarzenia: ${error.message}`);
  return data;
}

async function recordModerationDecision({
  eventId,
  reviewedBy,
  oldStatus,
  newStatus,
  note,
  title,
  organizerId
}: {
  eventId: string;
  reviewedBy: string;
  oldStatus: string | null;
  newStatus: EventStatus;
  note: string | null;
  title: string;
  organizerId: string | null;
}) {
  const supabase = await createSupabaseUserClient();
  const log: ModerationLogInsert = {
    event_id: eventId,
    reviewed_by: reviewedBy,
    old_status: oldStatus,
    new_status: newStatus,
    note
  };

  const { error } = await supabase.from("event_moderation_logs").insert(log);
  if (error) throw new Error(`Nie udalo sie zapisac historii moderacji: ${error.message}`);

  if (!organizerId) return;
  const recipients = await getOrganizerUserIds(organizerId);
  if (!recipients.length) return;

  const notification = buildModerationNotification({
    eventId,
    title,
    status: newStatus,
    note
  });
  const rows: NotificationInsert[] = recipients.map((userId) => ({
    user_id: userId,
    related_event_id: eventId,
    ...notification
  }));

  const { error: notificationError } = await supabase.from("notifications").insert(rows);
  if (notificationError) throw new Error(`Nie udalo sie zapisac powiadomienia: ${notificationError.message}`);
}

async function getOrganizerUserIds(organizerId: string) {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizer_users")
    .select("user_id")
    .eq("organizer_id", organizerId);

  if (error) throw new Error(`Nie udalo sie pobrac uzytkownikow organizatora: ${error.message}`);
  return (data ?? []).map((row) => row.user_id).filter(Boolean) as string[];
}

function buildModerationNotification({
  eventId,
  title,
  status,
  note
}: {
  eventId: string;
  title: string;
  status: EventStatus;
  note: string | null;
}) {
  if (status === "published") {
    return {
      title: "Wydarzenie zatwierdzone",
      message: `"${title}" jest juz widoczne publicznie.`,
      type: "event_published"
    };
  }

  if (status === "rejected") {
    return {
      title: "Wydarzenie odrzucone",
      message: note ? `"${title}": ${note}` : `"${title}" wymaga poprawek przed publikacja.`,
      type: "event_rejected"
    };
  }

  if (status === "pending_review") {
    return {
      title: "Wydarzenie wymaga sprawdzenia",
      message: `"${title}" czeka na ponowna weryfikacje.`,
      type: "event_pending_review"
    };
  }

  return {
    title: "Status wydarzenia zmieniony",
    message: `"${title}" ma teraz status ${status}.`,
    type: `event_${status}`
  };
}
