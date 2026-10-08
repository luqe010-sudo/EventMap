"use server";

import { randomUUID } from "node:crypto";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext, getPrimaryOrganizerId, requireOrganizerAccess, type OrganizerMembership } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { createSlug, editableEventSelect, formString, type EditableEvent } from "@/lib/event-editor";
import { buildEventWritePayload, eventPreparationFailure, saveEventSource } from "@/lib/event-editor-server";
import { EventValidationError, eventValidationState, type EventEditorState } from "@/lib/event-editor-validation";
import { completeEventWrite, eventWriteFailure } from "@/lib/event-save-feedback";
import { revalidatePublicEventCache } from "@/lib/public-event-cache";
import { readCompleteOrganizerDataset, readOrganizerStatistics } from "@/lib/organizer-statistics";
import type { OrganizerEventActionState } from "@/lib/organizer-event-action-state";
import { validateOrganizerAccountName, validateOrganizerDisplayName, validateOrganizerProfileForm } from "@/lib/organizer-form-validation";
import { organizerEventDateBounds } from "@/lib/organizer-event-filters";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];
type OrganizerInsert = Tables["organizers"]["Insert"];
type OrganizerUpdate = Tables["organizers"]["Update"];
type ProfileUpdate = Tables["profiles"]["Update"];
type NotificationRow = Tables["notifications"]["Row"];

const ORGANIZER_EVENT_LIST_SELECT = `
  id,
  title,
  slug,
  start_at,
  end_at,
  status,
  visibility,
  review_note,
  is_cancelled,
  main_image_url,
  description,
  short_description,
  price_type,
  price_min,
  price_max,
  currency,
  category:categories(id, name, slug),
  location:locations(id, name, address, latitude, longitude, google_maps_url, city:cities(name, slug)),
  organizer:organizers!events_organizer_id_fkey(name),
  sources:event_sources(source_url)
`;

export type OrganizerEventListItem = {
  id: string;
  title: string;
  slug: string;
  start_at: string;
  end_at: string | null;
  status: string | null;
  visibility: string | null;
  review_note: string | null;
  is_cancelled: boolean | null;
  main_image_url: string | null;
  description: string | null;
  short_description: string | null;
  price_type: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  category: { id: string; name: string; slug: string } | null;
  location: {
    id: string;
    name: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    google_maps_url: string | null;
    city: { name: string; slug: string } | null;
  } | null;
  organizer: { name: string } | null;
  sources: Array<{ source_url: string | null }> | null;
};

export type OrganizerProfile = Pick<
  Tables["organizers"]["Row"],
  | "id"
  | "name"
  | "slug"
  | "website"
  | "facebook_url"
  | "instagram_url"
  | "phone"
  | "email"
  | "logo_url"
  | "type"
  | "description"
  | "is_verified"
>;

export type OrganizerEventFilters = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type OrganizerModerationLog = Pick<
  Tables["event_moderation_logs"]["Row"],
  "id" | "old_status" | "new_status" | "note" | "created_at"
>;

export type OrganizerNotification = Pick<
  NotificationRow,
  "id" | "title" | "message" | "type" | "is_read" | "related_event_id" | "created_at"
>;

export async function getOrganizerEntryContext() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  if (context.profile?.role !== "organizer") {
    return {
      ...context,
      isOrganizer: false,
      memberships: [] as OrganizerMembership[]
    };
  }

  const memberships = await listOrganizerMembershipsForUser(context.userId);
  return {
    ...context,
    isOrganizer: true,
    memberships
  };
}

export async function getOrganizerDashboard() {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.length) return emptyOrganizerDashboard(access.memberships);

  const events = await listOrganizerEvents();
  const statusCounts = new Map<string, number>();
  events.forEach((event) => {
    const status = event.status ?? "draft";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  });

  const now = new Date();
  const activeEvents = events.filter((event) => isActiveEvent(event, now));
  const upcomingEvents = events
    .filter((event) => new Date(event.start_at) >= now && event.status !== "archived" && !event.is_cancelled)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 5);
  const rejectedEvents = events
    .filter((event) => event.status === "rejected")
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    .slice(0, 4);
  const locations = buildOrganizerLocations(events).slice(0, 8);
  const [stats, notifications] = await Promise.all([
    getOrganizerStatsSummary(events.map((event) => event.id), now),
    listOrganizerNotifications(access.userId)
  ]);

  return {
    memberships: access.memberships,
    events,
    statusCounts,
    activeEvents: activeEvents.length,
    pendingReview: statusCounts.get("pending_review") ?? 0,
    upcomingEvents,
    rejectedEvents,
    locations,
    notifications,
    stats: {
      monthViews: stats.monthViews,
      contactClicks: stats.monthContactClicks,
      ticketClicks: stats.monthTicketClicks,
      currentSaves: stats.currentSaves,
      saveClicks: stats.monthSaveClicks,
      shares: stats.monthShares,
      analyticsStatus: stats.analyticsStatus,
      savesStatus: stats.savesStatus,
      monthStart: stats.monthStart
    }
  };
}

export async function listOrganizerEvents(filters: OrganizerEventFilters = {}) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.length) return [];

  const supabase = await createSupabaseUserClient();
  const { from: dateFrom, until: dateUntil } = organizerEventDateBounds(filters);
  const result = await readCompleteOrganizerDataset((offset, size, head) => {
    let query = supabase.from("events").select(ORGANIZER_EVENT_LIST_SELECT, { count: "exact", head })
      .in("submitted_by_organizer_id", organizerIds);
    if (filters.status) query = query.eq("status", filters.status);
    if (dateFrom) query = query.gte("start_at", dateFrom);
    if (dateUntil) query = query.lt("start_at", dateUntil);
    return query.order("start_at", { ascending: false }).order("id", { ascending: true })
      .range(offset, offset + size - 1).returns<OrganizerEventListItem[]>();
  });
  if (result.status !== "complete") throw new Error("Nie udało się pobrać pełnej listy wydarzeń. Odśwież stronę i spróbuj ponownie.");
  return result.rows;
}

export async function getOrganizerStats() {
  const events = await listOrganizerEvents();
  const stats = await getOrganizerStatsSummary(events.map((event) => event.id));
  const countsByEvent = stats.countsByEvent;

  const rows = events.map((event) => ({
    event,
    views: getAnalyticsCount(countsByEvent, event.id, "view"),
    phoneClicks: getAnalyticsCount(countsByEvent, event.id, "phone_click"),
    websiteClicks: getAnalyticsCount(countsByEvent, event.id, "website_click"),
    mapClicks: getAnalyticsCount(countsByEvent, event.id, "map_click"),
    ticketClicks: getAnalyticsCount(countsByEvent, event.id, "ticket_click"),
    saveClicks: getAnalyticsCount(countsByEvent, event.id, "save_click"),
    currentSaves: stats.savedEventsByEvent ? stats.savedEventsByEvent.get(event.id) ?? 0 : null,
    shares: getAnalyticsCount(countsByEvent, event.id, "share_click")
  }));
  return { rows, analyticsStatus: stats.analyticsStatus, savesStatus: stats.savesStatus };
}

export async function organizerMarkNotificationReadAction(notificationId: string) {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  const supabase = await createSupabaseUserClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", context.userId);

  if (error) throw new Error(`Nie udalo sie oznaczyc powiadomienia jako przeczytane: ${error.message}`);
  revalidatePath("/organizer");
}

export async function getOrganizerProfileData() {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.length) {
    return {
      memberships: access.memberships,
      organizers: [] as OrganizerProfile[],
      primaryOrganizerId: null
    };
  }

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug, website, facebook_url, instagram_url, phone, email, logo_url, type, description, is_verified")
    .in("id", organizerIds)
    .order("name", { ascending: true })
    .returns<OrganizerProfile[]>();

  if (error) throw new Error(`Nie udalo sie pobrac profilu organizatora: ${error.message}`);

  return {
    memberships: access.memberships,
    organizers: data ?? [],
    primaryOrganizerId: getPrimaryOrganizerId(access.memberships)
  };
}

export async function getOrganizerSettingsData() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  const memberships = context.profile?.role === "organizer"
    ? await listOrganizerMembershipsForUser(context.userId)
    : [];

  return {
    ...context,
    memberships
  };
}

export async function getOrganizerEventEditorOptions(next = "/organizer") {
  const access = await requireOrganizerAccess(next);
  const organizerIds = getOrganizerIds(access.memberships);
  const supabase = await createSupabaseUserClient();
  const [categories, locations] = await Promise.all([
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
    supabase
      .from("locations")
      .select("id, name, address, city_id, latitude, longitude, postal_code, voivodeship, county, municipality, city:cities(name)")
      .order("name", { ascending: true })
      .limit(500)
  ]);

  if (categories.error) throw new Error(`Nie udalo sie pobrac kategorii: ${categories.error.message}`);
  if (locations.error) throw new Error(`Nie udalo sie pobrac lokalizacji: ${locations.error.message}`);

  return {
    categories: categories.data ?? [],
    locations: locations.data ?? [],
    organizers: access.memberships
      .filter((item) => item.organizer_id && item.organizer)
      .map((item) => ({ id: item.organizer_id!, name: item.organizer!.name })),
    primaryOrganizerId: getPrimaryOrganizerId(access.memberships),
    hasOrganizer: organizerIds.length > 0
  };
}

export async function getOrganizerEventForEdit(eventId: string) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.length) return null;

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .select(editableEventSelect())
    .eq("id", eventId)
    .in("submitted_by_organizer_id", organizerIds)
    .order("created_at", { ascending: true, referencedTable: "sources" })
    .order("id", { ascending: true, referencedTable: "sources" })
    .maybeSingle()
    .returns<EditableEvent | null>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzenia organizatora: ${error.message}`);
  return data;
}

export async function getOrganizerEventModerationLogs(eventId: string) {
  const event = await getOrganizerEventForEdit(eventId);
  if (!event) return [];

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("event_moderation_logs")
    .select("id, old_status, new_status, note, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<OrganizerModerationLog[]>();

  if (error) {
    console.error("[organizer] Failed to load moderation logs", error);
    return [];
  }
  return data ?? [];
}

export async function organizerCreateEventAction(_previous: EventEditorState, formData: FormData): Promise<EventEditorState> {
  const access = await requireOrganizerAccess();
  const organizerId = getAllowedOrganizerId(formData, access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[]);
  const supabase = await createSupabaseUserClient();
  let event;
  try {
    event = await buildEventWritePayload(formData, {
      mode: "create", organizerId, status: "pending_review", createdBy: access.userId
    });
  } catch (error) { return eventPreparationFailure(error); }

  const eventId = randomUUID();
  try {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...event as EventInsert, id: eventId })
      .select("id")
      .single();
    if (error) throw error;
    if (!data || data.id !== eventId) throw new Error("Event insert was not confirmed");
  } catch (error) { revalidateOrganizerPaths(); return eventWriteFailure(error, "organizer", eventId); }
  revalidateOrganizerPaths();
  const incomplete = await completeEventWrite("organizer", eventId, [
    { label: "źródła", run: () => saveEventSource(eventId, formData, "organizer") }
  ]);
  if (incomplete) return incomplete;
  redirect(`/organizer/events/${eventId}/edit`);
}

export async function organizerUpdateEventAction(eventId: string, _previous: EventEditorState, formData: FormData): Promise<EventEditorState> {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  const existing = await getOrganizerEventForEdit(eventId);
  if (!existing || !existing.submitted_by_organizer_id || !organizerIds.includes(existing.submitted_by_organizer_id)) {
    redirect("/organizer");
  }

  const resubmit = formString(formData, "intent") === "resubmit";
  if (resubmit && (existing.status !== "rejected" || existing.is_cancelled === true)) {
    return eventValidationState(new EventValidationError({ intent: "Ponownie możesz wysłać tylko odrzucone, nieanulowane wydarzenie." }));
  }
  const nextStatus = resubmit || existing.status === "published" ? "pending_review" : existing.status ?? "pending_review";
  let event;
  try {
    event = await buildEventWritePayload(formData, {
      mode: "update", existing, organizerId: existing.organizer_id ?? existing.submitted_by_organizer_id, status: nextStatus
    });
  } catch (error) { return eventPreparationFailure(error); }
  const supabase = await createSupabaseUserClient();
  try {
    const { data: updated, error } = await supabase
      .from("events")
      .update(event as EventUpdate)
      .eq("id", eventId)
      .eq("submitted_by_organizer_id", existing.submitted_by_organizer_id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Event update affected no visible rows");
  } catch (error) { revalidateOrganizerPaths(); return eventWriteFailure(error, "organizer", eventId); }
  revalidateOrganizerPaths();
  const incomplete = await completeEventWrite("organizer", eventId, [
    { label: "źródła", run: () => saveEventSource(eventId, formData, "organizer") }
  ]);
  if (incomplete) return incomplete;
  redirect("/organizer");
}

export async function organizerDuplicateEventAction(eventId: string) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  const existing = await getOrganizerEventForEdit(eventId);
  if (!existing || !existing.submitted_by_organizer_id || !organizerIds.includes(existing.submitted_by_organizer_id)) {
    redirect("/organizer/events");
  }

  const supabase = await createSupabaseUserClient();
  const duplicated: EventInsert = {
    title: `Kopia - ${existing.title}`,
    slug: `${existing.slug}-kopia-${Date.now().toString(36)}`,
    description: existing.description,
    short_description: existing.short_description,
    start_at: existing.start_at,
    end_at: existing.end_at,
    is_all_day: existing.is_all_day,
    category_id: existing.category_id,
    location_id: existing.location_id,
    organizer_id: existing.organizer_id ?? existing.submitted_by_organizer_id,
    submitted_by_organizer_id: existing.submitted_by_organizer_id,
    price_type: existing.price_type,
    price_min: existing.price_min,
    price_max: existing.price_max,
    currency: existing.currency,
    main_image_url: existing.main_image_url,
    status: "pending_review",
    visibility: "public",
    is_cancelled: false,
    published_at: null,
    created_by: access.userId
  };

  const duplicateId = randomUUID();
  try {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...duplicated, id: duplicateId })
      .select("id")
      .single();
    if (error) throw error;
    if (!data || data.id !== duplicateId) throw new Error("Event duplicate was not confirmed");
  } catch (error) {
    revalidateOrganizerPaths();
    eventWriteFailure(error, "organizer", duplicateId);
    redirect("/organizer/events?save=unconfirmed");
  }
  revalidateOrganizerPaths();
  const source = existing.sources?.[0];
  const sourceForm = new FormData();
  if (source?.source_name) sourceForm.set("source_name", source.source_name);
  if (source?.source_url) sourceForm.set("source_url", source.source_url);
  if (source?.source_type) sourceForm.set("source_type", source.source_type);
  const incomplete = await completeEventWrite("organizer", duplicateId, [
    { label: "źródła", run: () => saveEventSource(duplicateId, sourceForm, "organizer") }
  ]);
  redirect(`/organizer/events/${duplicateId}/edit${incomplete ? "?save=source-unconfirmed" : ""}`);
}

export async function organizerHideEventAction(eventId: string): Promise<OrganizerEventActionState> {
  try {
    await updateOrganizerOwnedEvent(eventId, {
      visibility: "private",
      updated_at: new Date().toISOString()
    });
    revalidateOrganizerPaths();
    return { error: null, success: "Wydarzenie zostało ukryte." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[organizer] Event hide was not confirmed", error);
    return { error: "Nie udało się potwierdzić ukrycia wydarzenia. Odśwież listę i sprawdź jego widoczność przed ponowną próbą.", success: null };
  }
}

export async function organizerCancelEventAction(eventId: string): Promise<OrganizerEventActionState> {
  try {
    await updateOrganizerOwnedEvent(eventId, {
      is_cancelled: true,
      status: "archived",
      updated_at: new Date().toISOString()
    });
    revalidateOrganizerPaths();
    return { error: null, success: "Wydarzenie zostało anulowane." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[organizer] Event cancellation was not confirmed", error);
    return { error: "Nie udało się potwierdzić anulowania wydarzenia. Odśwież listę i sprawdź jego status przed ponowną próbą.", success: null };
  }
}

export async function organizerUpdateProfileAction(organizerId: string, formData: FormData, stayOnForm = false) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.includes(organizerId)) redirect("/organizer/profile");

  const payload: OrganizerUpdate = {
    ...validateOrganizerProfileForm(formData),
    updated_at: new Date().toISOString()
  };

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizers")
    .update(payload)
    .eq("id", organizerId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie zapisac profilu organizatora: ${error.message}`);
  if (!data || data.id !== organizerId) throw new Error("Nie udało się zapisać profilu organizatora. Odśwież stronę i spróbuj ponownie.");

  revalidatePath("/organizer");
  revalidatePath("/organizer/profile");
  if (!stayOnForm) redirect("/organizer/profile");
}

export async function organizerUpdateAccountAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login?next=%2Forganizer%2Fsettings");

  const displayName = validateOrganizerDisplayName(formData);

  const supabase = await createSupabaseUserClient();
  const payload: ProfileUpdate = {
    display_name: displayName
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", context.userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie zapisac ustawien konta: ${error.message}`);
  if (!data || data.id !== context.userId) throw new Error("Nie udało się potwierdzić zapisu ustawień konta.");
  revalidatePath("/organizer/settings");
  revalidatePath("/", "layout");
}

export async function createOrganizerAccountAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login?next=%2Forganizer");
  // Existing organizer/admin accounts must not be demoted or given another
  // organization by the upgrade flow intended for regular users.
  if (context.profile?.role === "admin" || context.profile?.role === "organizer") redirect("/organizer");
  if (context.profile && context.profile.role !== "user") throw new Error("Nie można rozszerzyć tego konta.");

  const name = validateOrganizerAccountName(formData, context.profile?.display_name);

  const supabase = await createSupabaseUserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user || authData.user.id !== context.userId) redirect("/login?next=%2Forganizer");
  const slug = await createUniqueOrganizerSlug(createSlug(name));

  const organizerId = randomUUID();
  const organizer: OrganizerInsert = {
    id: organizerId,
    name,
    slug,
    email: authData.user?.email ?? null,
    is_verified: false
  };

  const { data, error } = await supabase
    .from("organizers")
    .insert(organizer)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc organizatora: ${error.message}`);
  if (!data || data.id !== organizerId) throw new Error("Nie udało się potwierdzić utworzenia organizatora.");

  const { data: membership, error: memberError } = await supabase
    .from("organizer_users")
    .insert({
      organizer_id: organizerId,
      user_id: context.userId,
      role: "owner"
    })
    .select("id, organizer_id, user_id")
    .single();

  if (memberError) throw new Error(`Nie udalo sie powiazac konta z organizatorem: ${memberError.message}`);
  if (!membership?.id || membership.organizer_id !== organizerId || membership.user_id !== context.userId) throw new Error("Nie udało się potwierdzić dostępu do organizatora.");

  if (context.profile) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({ role: "organizer" })
      .eq("id", context.userId)
      .select("id, role")
      .maybeSingle();
    if (profileError) throw new Error(`Nie udalo sie zaktualizowac roli profilu: ${profileError.message}`);
    if (!profile || profile.id !== context.userId || profile.role !== "organizer") throw new Error("Nie udało się potwierdzić zmiany roli konta.");
  } else {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: context.userId,
        display_name: name,
        role: "organizer"
      })
      .select("id, role")
      .single();
    if (profileError) throw new Error(`Nie udalo sie utworzyc profilu uzytkownika: ${profileError.message}`);
    if (!profile || profile.id !== context.userId || profile.role !== "organizer") throw new Error("Nie udało się potwierdzić utworzenia profilu konta.");
  }

  revalidatePath("/organizer");
  revalidatePath("/organizer/settings");
  redirect("/organizer");
}

function getAllowedOrganizerId(formData: FormData, allowedOrganizerIds: string[]) {
  if (!allowedOrganizerIds.length) throw new Error("Brakuje organizatora przypisanego do konta.");
  const requested = formString(formData, "organizer_id");
  if (requested && allowedOrganizerIds.includes(requested)) return requested;
  return allowedOrganizerIds[0];
}

function revalidateOrganizerPaths() {
  revalidatePath("/organizer");
  revalidatePath("/organizer/events");
  revalidatePath("/organizer/stats");
  revalidatePublicEventCache();
}

async function updateOrganizerOwnedEvent(eventId: string, payload: EventUpdate) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.length) redirect("/organizer");

  const existing = await getOrganizerEventForEdit(eventId);
  if (!existing?.submitted_by_organizer_id || !organizerIds.includes(existing.submitted_by_organizer_id)) {
    redirect("/organizer/events");
  }

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .eq("submitted_by_organizer_id", existing.submitted_by_organizer_id)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie zaktualizowac wydarzenia: ${error.message}`);
  if (data?.id !== eventId) throw new Error("Nie potwierdzono zmiany własnego wydarzenia.");
}

async function listOrganizerMembershipsForUser(userId: string) {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizer_users")
    .select("id, organizer_id, user_id, role, created_at, organizer:organizers(id, name, slug)")
    .eq("user_id", userId)
    .returns<OrganizerMembership[]>();

  if (error) throw new Error(`Nie udalo sie pobrac organizatorow uzytkownika: ${error.message}`);
  return data ?? [];
}

function getOrganizerIds(memberships: OrganizerMembership[]) {
  return memberships.map((item) => item.organizer_id).filter(Boolean) as string[];
}

function emptyOrganizerDashboard(memberships: OrganizerMembership[]) {
  return {
    memberships,
    events: [] as OrganizerEventListItem[],
    statusCounts: new Map<string, number>(),
    activeEvents: 0,
    pendingReview: 0,
    upcomingEvents: [] as OrganizerEventListItem[],
    rejectedEvents: [] as OrganizerEventListItem[],
    locations: [] as OrganizerLocationSummary[],
    notifications: [] as OrganizerNotification[],
    stats: {
      monthViews: 0,
      contactClicks: 0,
      ticketClicks: 0,
      currentSaves: 0,
      saveClicks: 0,
      shares: 0,
      analyticsStatus: "complete" as const,
      savesStatus: "complete" as const,
      monthStart: new Date().toISOString()
    }
  };
}

function isActiveEvent(event: OrganizerEventListItem, now: Date) {
  return event.status === "published" &&
    event.visibility === "public" &&
    event.is_cancelled !== true &&
    new Date(event.start_at) >= now;
}

type OrganizerLocationSummary = {
  id: string;
  name: string;
  address: string;
  city: string;
  eventsCount: number;
};

function buildOrganizerLocations(events: OrganizerEventListItem[]) {
  const locations = new Map<string, OrganizerLocationSummary>();
  events.forEach((event) => {
    const location = event.location;
    if (!location?.id) return;
    const existing = locations.get(location.id);
    if (existing) {
      existing.eventsCount += 1;
      return;
    }
    locations.set(location.id, {
      id: location.id,
      name: location.name ?? "Miejsce bez nazwy",
      address: location.address ?? "-",
      city: location.city?.name ?? "-",
      eventsCount: 1
    });
  });
  return Array.from(locations.values()).sort((a, b) => b.eventsCount - a.eventsCount);
}

async function listOrganizerNotifications(userId: string) {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, type, is_read, related_event_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<OrganizerNotification[]>();

  if (error) {
    console.error("[organizer] Failed to load notifications", error);
    return [];
  }
  return data ?? [];
}

async function getOrganizerStatsSummary(eventIds: string[], now = new Date()) {
  const supabase = await createSupabaseUserClient();
  return readOrganizerStatistics(supabase, eventIds, now);
}

function getAnalyticsCount(countsByEvent: Map<string, Map<string, number>> | null, eventId: string, eventType: string) {
  return countsByEvent ? countsByEvent.get(eventId)?.get(eventType) ?? 0 : null;
}

async function createUniqueOrganizerSlug(baseSlug: string) {
  const supabase = await createSupabaseUserClient();
  const fallback = baseSlug || "organizator";
  const { data, error } = await supabase
    .from("organizers")
    .select("slug")
    .eq("slug", fallback)
    .maybeSingle();

  if (error || data) return `${fallback}-${Date.now().toString(36)}`;
  return fallback;
}
