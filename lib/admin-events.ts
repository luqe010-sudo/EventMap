"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { assertEventStatus, editableEventSelect, eventPublicationTimestamp, formBoolean, formString, type EditableEvent, type EventStatus } from "@/lib/event-editor";
import { EventValidationError, eventValidationState, eventTextLimits, type EventEditorState } from "@/lib/event-editor-validation";
import { buildEventWritePayload, deleteEventRelations, eventPreparationFailure, saveEventSource } from "@/lib/event-editor-server";
import { completeEventWrite, eventWriteFailure } from "@/lib/event-save-feedback";
import { revalidatePublicEventCache } from "@/lib/public-event-cache";
import {
  ADMIN_EVENT_POOL_LIMIT, adminEventDateBounds, adminEventPageInfo, filterAdminEventPool,
  needsAdminEventPool, normalizeAdminEventListFilters, sortAdminEventPool,
  type AdminEventListFilters, type AdminEventListItem, type AdminEventListPage
} from "@/lib/admin-event-list";

export type { AdminEventListFilters, AdminEventListItem, AdminEventListPage } from "@/lib/admin-event-list";

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
  return readAdminEventPage(filters, false);
}

export async function listAdminReviewEvents(filters: AdminEventListFilters = {}) {
  return readAdminEventPage(filters, true);
}

async function readAdminEventPage(input: AdminEventListFilters, review: boolean): Promise<AdminEventListPage> {
  await requireAdmin();
  const filters = normalizeAdminEventListFilters(input, review);
  const bounds = adminEventDateBounds(filters);
  const supabase = await createSupabaseUserClient();
  const countQuery = () => supabase.from("events").select(ADMIN_EVENT_LIST_SELECT, { count: "exact", head: true });
  const dataQuery = () => supabase.from("events").select(ADMIN_EVENT_LIST_SELECT, { count: "exact" });
  function applyFilters(query: ReturnType<typeof countQuery>) {
    for (const bound of bounds) {
      if (bound.from) query = query.gte(bound.column, bound.from);
      if (bound.until) query = query.lt(bound.column, bound.until);
    }
    if (review) query = query.in("status", ["draft", "pending_review"]);
    else if (filters.status) query = query.eq("status", filters.status);
    if (filters.featured === "yes") query = query.eq("is_featured", true);
    if (filters.featured === "no") query = query.or("is_featured.is.null,is_featured.eq.false");
    return query;
  }
  const countResult = await applyFilters(countQuery());
  if (countResult.error) throw new Error(`Nie udało się policzyć wydarzeń: ${countResult.error.message}`);
  const count = countResult.count;
  if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error("Nie udało się potwierdzić liczby wydarzeń.");

  const usePool = needsAdminEventPool(filters);
  if (usePool && count > ADMIN_EVENT_POOL_LIMIT) throw new Error("Zbyt wiele wydarzeń dla tego wyszukiwania. Zawęź status lub zakres dat.");
  const initialPage = adminEventPageInfo(count, filters.page);
  const start = usePool ? 0 : (initialPage.page - 1) * initialPage.pageSize;
  const end = usePool ? count : Math.min(count, start + initialPage.pageSize);
  const rows: AdminEventListItem[] = [];
  const seen = new Set<string>();
  // Relation text search and Polish name sorting need the complete projected
  // pool. Dates/status/featured and ordinary chronological pages stay in SQL.
  while (start + rows.length < end) {
    let query = applyFilters(dataQuery());
    query = usePool ? query.order("id", { ascending: true }) :
      query.order(filters.sort ?? "created_at", { ascending: filters.dir === "asc", nullsFirst: false }).order("id", { ascending: true });
    const from = start + rows.length;
    const result = await query.range(from, Math.min(from + 499, end - 1)).returns<AdminEventListItem[]>();
    if (result.error) throw new Error(`Nie udało się pobrać wydarzeń: ${result.error.message}`);
    if (result.count !== count) throw new Error("Lista wydarzeń zmieniła się podczas odczytu. Odśwież wyniki.");
    const batch = result.data ?? [];
    if (!batch.length || batch.length > end - from || batch.some(row => !row.id || seen.has(row.id))) {
      throw new Error("Nie udało się pobrać kompletnej listy wydarzeń. Odśwież wyniki.");
    }
    for (const row of batch) {
      if (seen.has(row.id)) throw new Error("Lista wydarzeń zmieniła się podczas odczytu. Odśwież wyniki.");
      seen.add(row.id);
      rows.push(row);
    }
  }
  if (!usePool) return { ...initialPage, events: rows };
  const filtered = sortAdminEventPool(filterAdminEventPool(rows, filters), filters);
  const page = adminEventPageInfo(filtered.length, filters.page);
  const offset = (page.page - 1) * page.pageSize;
  return { ...page, events: filtered.slice(offset, offset + page.pageSize) };
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
    .order("created_at", { ascending: true, referencedTable: "sources" })
    .order("id", { ascending: true, referencedTable: "sources" })
    .maybeSingle()
    .returns<EditableEvent | null>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzenia: ${error.message}`);
  return data;
}

export async function adminCreateEventAction(_previous: EventEditorState, formData: FormData): Promise<EventEditorState> {
  const admin = await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const status = formString(formData, "status") ?? "published";
  try { assertEventStatus(status); }
  catch { return eventValidationState(new EventValidationError({ status: "Wybierz poprawny status wydarzenia." })); }
  let event;
  try {
    event = await buildEventWritePayload(formData, {
      mode: "create", organizerId: formString(formData, "organizer_id") ?? "", status, createdBy: admin.userId
    });
  } catch (error) { return eventPreparationFailure(error); }
  event.review_note = status === "rejected" ? formString(formData, "review_note") : null;
  event.is_featured = formBoolean(formData, "is_featured");

  // Keep the attempted ID even if the connection is lost after COMMIT.
  const eventId = randomUUID();
  try {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...event as EventInsert, id: eventId })
      .select("id")
      .single();
    if (error) throw error;
    if (!data || data.id !== eventId) throw new Error("Event insert was not confirmed");
  } catch (error) { revalidateAdminPaths(); return eventWriteFailure(error, "admin", eventId); }
  revalidateAdminPaths();
  const incomplete = await completeEventWrite("admin", eventId, [
    { label: "źródła", run: () => saveEventSource(eventId, formData, "manual") }
  ]);
  if (incomplete) return incomplete;
  redirect(`/admin/events/${eventId}/edit`);
}

export async function adminUpdateEventAction(eventId: string, _previous: EventEditorState, formData: FormData): Promise<EventEditorState> {
  const admin = await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const existing = await getAdminEventStatusSnapshot(eventId);
  if (!existing) throw new Error("Wydarzenie nie istnieje lub nie masz do niego dostępu.");
  const status = formString(formData, "status") ?? existing.status ?? "draft";
  try { assertEventStatus(status); }
  catch { return eventValidationState(new EventValidationError({ status: "Wybierz poprawny status wydarzenia." })); }
  const reviewNote = formString(formData, "review_note");
  let event;
  try {
    event = await buildEventWritePayload(formData, {
      mode: "update", existing, organizerId: formString(formData, "organizer_id") ?? "", status
    });
  } catch (error) { return eventPreparationFailure(error); }
  event.review_note = status === "rejected" ? reviewNote : reviewNote ?? null;
  event.is_featured = formBoolean(formData, "is_featured");

  try {
    const { data: updated, error } = await supabase
      .from("events")
      .update(event as EventUpdate)
      .eq("id", eventId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Event update affected no visible rows");
  } catch (error) { revalidateAdminPaths(); return eventWriteFailure(error, "admin", eventId); }

  revalidateAdminPaths();
  const followups = [{ label: "źródła", run: () => saveEventSource(eventId, formData, "manual") }];
  if (existing?.status !== status || reviewNote) {
    followups.push({ label: "historii moderacji i powiadomień", run: () => recordModerationDecision({
      eventId,
      reviewedBy: admin.userId,
      oldStatus: existing?.status ?? null,
      newStatus: status,
      note: reviewNote,
      title: existing?.title ?? event.title ?? "Wydarzenie",
      organizerId: existing?.submitted_by_organizer_id ?? null
    }) });
  }
  const incomplete = await completeEventWrite("admin", eventId, followups);
  if (incomplete) return incomplete;
  redirect("/admin/events");
}

export async function adminSetEventStatusAction(eventId: string, status: EventStatus, formData?: FormData) {
  const admin = await requireAdmin();
  assertEventStatus(status);
  const supabase = await createSupabaseUserClient();
  const existing = await getAdminEventStatusSnapshot(eventId);
  if (!existing) throw new Error("Wydarzenie nie istnieje lub nie masz do niego dostępu.");
  const note = formData ? formString(formData, "review_note") : null;
  if (note && note.length > eventTextLimits.review_note) throw new EventValidationError({ review_note: `Maksymalna długość: ${eventTextLimits.review_note} znaków.` });
  try {
    const { data: updated, error } = await supabase
      .from("events")
      .update({
        status,
        review_note: status === "rejected" ? note : null,
        published_at: eventPublicationTimestamp(status, existing.published_at)
      })
      .eq("id", eventId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Event status update affected no visible rows");
  } catch (error) {
    revalidateAdminPaths();
    eventWriteFailure(error, "admin", eventId);
    redirect("/admin/events?save=unconfirmed");
  }
  revalidateAdminPaths();
  const incomplete = await completeEventWrite("admin", eventId, [{ label: "historii moderacji i powiadomień", run: () => recordModerationDecision({
    eventId,
    reviewedBy: admin.userId,
    oldStatus: existing?.status ?? null,
    newStatus: status,
    note,
    title: existing?.title ?? "Wydarzenie",
    organizerId: existing?.submitted_by_organizer_id ?? null
  }) }]);
  if (incomplete) redirect("/admin/events?save=moderation-unconfirmed");
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
  revalidatePublicEventCache();
}

async function getAdminEventStatusSnapshot(eventId: string) {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, status, visibility, submitted_by_organizer_id, published_at")
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
