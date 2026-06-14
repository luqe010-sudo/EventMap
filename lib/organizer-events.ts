"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext, getPrimaryOrganizerId, requireOrganizerAccess, type OrganizerMembership } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { createSlug, editableEventSelect, formSlug, formString, type EditableEvent } from "@/lib/event-editor";
import { buildEventWritePayload, saveEventSource } from "@/lib/event-editor-server";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];
type OrganizerInsert = Tables["organizers"]["Insert"];
type OrganizerUpdate = Tables["organizers"]["Update"];
type ProfileUpdate = Tables["profiles"]["Update"];
type EventAnalyticsRow = Pick<Tables["event_analytics"]["Row"], "event_id" | "event_type" | "created_at">;
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
    getOrganizerStatsSummary(events.map((event) => event.id), monthStart),
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
      saves: stats.totalSaves,
      monthStart: monthStart.toISOString()
    }
  };
}

export async function listOrganizerEvents(filters: OrganizerEventFilters = {}) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.length) return [];

  const supabase = await createSupabaseUserClient();
  let query = supabase
    .from("events")
    .select(ORGANIZER_EVENT_LIST_SELECT)
    .in("submitted_by_organizer_id", organizerIds);

  if (filters.status) query = query.eq("status", filters.status);
  const dateFrom = filters.dateFrom ? normalizeDateFilter(filters.dateFrom) : null;
  const dateTo = filters.dateTo ? normalizeDateFilter(filters.dateTo, true) : null;
  if (dateFrom) query = query.gte("start_at", dateFrom);
  if (dateTo) query = query.lte("start_at", dateTo);

  const { data, error } = await query
    .order("start_at", { ascending: false })
    .limit(250)
    .returns<OrganizerEventListItem[]>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzen organizatora: ${error.message}`);
  return data ?? [];
}

export async function getOrganizerStats() {
  const events = await listOrganizerEvents();
  const stats = await getOrganizerStatsSummary(events.map((event) => event.id));
  const countsByEvent = stats.countsByEvent;

  return events.map((event) => ({
    event,
    views: getAnalyticsCount(countsByEvent, event.id, "view"),
    phoneClicks: getAnalyticsCount(countsByEvent, event.id, "phone_click"),
    websiteClicks: getAnalyticsCount(countsByEvent, event.id, "website_click"),
    mapClicks: getAnalyticsCount(countsByEvent, event.id, "map_click"),
    ticketClicks: getAnalyticsCount(countsByEvent, event.id, "ticket_click"),
    saves: getAnalyticsCount(countsByEvent, event.id, "save_click") + (stats.savedEventsByEvent.get(event.id) ?? 0),
    shares: getAnalyticsCount(countsByEvent, event.id, "share_click")
  }));
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

export async function getOrganizerEventEditorOptions() {
  const access = await requireOrganizerAccess();
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

export async function organizerCreateEventAction(formData: FormData) {
  const access = await requireOrganizerAccess();
  const organizerId = getAllowedOrganizerId(formData, access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[]);
  const supabase = await createSupabaseUserClient();
  const event = await buildEventWritePayload(formData, {
    organizerId,
    status: "pending_review",
    createdBy: access.userId
  });

  const { data, error } = await supabase
    .from("events")
    .insert(event as EventInsert)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie dodac wydarzenia: ${error.message}`);

  await saveEventSource(data.id, formData, "organizer");
  revalidateOrganizerPaths();
  redirect(`/organizer/events/${data.id}/edit`);
}

export async function organizerUpdateEventAction(eventId: string, formData: FormData) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  const existing = await getOrganizerEventForEdit(eventId);
  if (!existing || !existing.submitted_by_organizer_id || !organizerIds.includes(existing.submitted_by_organizer_id)) {
    redirect("/organizer");
  }

  const nextStatus = existing.status === "published" ? "pending_review" : existing.status ?? "pending_review";
  const event = await buildEventWritePayload(formData, {
    organizerId: existing.submitted_by_organizer_id,
    status: nextStatus
  });
  const supabase = await createSupabaseUserClient();
  const { error } = await supabase
    .from("events")
    .update(event as EventUpdate)
    .eq("id", eventId)
    .eq("submitted_by_organizer_id", existing.submitted_by_organizer_id);

  if (error) throw new Error(`Nie udalo sie zapisac wydarzenia: ${error.message}`);

  await saveEventSource(eventId, formData, "organizer");
  revalidateOrganizerPaths();
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

  const { data, error } = await supabase
    .from("events")
    .insert(duplicated)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie zduplikowac wydarzenia: ${error.message}`);

  const source = existing.sources?.[0];
  if (source?.source_name || source?.source_url) {
    const { error: sourceError } = await supabase.from("event_sources").insert({
      event_id: data.id,
      source_name: source.source_name,
      source_url: source.source_url,
      source_type: source.source_type ?? "organizer",
      is_active: true,
      last_seen_at: new Date().toISOString()
    });
    if (sourceError) throw new Error(`Nie udalo sie skopiowac zrodla wydarzenia: ${sourceError.message}`);
  }

  revalidateOrganizerPaths();
  redirect(`/organizer/events/${data.id}/edit`);
}

export async function organizerHideEventAction(eventId: string) {
  await updateOrganizerOwnedEvent(eventId, {
    visibility: "private",
    updated_at: new Date().toISOString()
  });
  revalidateOrganizerPaths();
}

export async function organizerCancelEventAction(eventId: string) {
  await updateOrganizerOwnedEvent(eventId, {
    is_cancelled: true,
    status: "archived",
    updated_at: new Date().toISOString()
  });
  revalidateOrganizerPaths();
}

export async function organizerUpdateProfileAction(organizerId: string, formData: FormData) {
  const access = await requireOrganizerAccess();
  const organizerIds = getOrganizerIds(access.memberships);
  if (!organizerIds.includes(organizerId)) redirect("/organizer/profile");

  const name = formString(formData, "name");
  if (!name) throw new Error("Nazwa organizatora jest wymagana.");

  const payload: OrganizerUpdate = {
    name,
    slug: formSlug(formData, "slug") ?? createSlug(name),
    website: formString(formData, "website"),
    facebook_url: formString(formData, "facebook_url"),
    instagram_url: formString(formData, "instagram_url"),
    phone: formString(formData, "phone"),
    email: formString(formData, "email"),
    logo_url: formString(formData, "logo_url"),
    type: formString(formData, "type"),
    description: formString(formData, "description"),
    updated_at: new Date().toISOString()
  };

  const supabase = await createSupabaseUserClient();
  const { error } = await supabase
    .from("organizers")
    .update(payload)
    .eq("id", organizerId);

  if (error) throw new Error(`Nie udalo sie zapisac profilu organizatora: ${error.message}`);

  revalidatePath("/organizer");
  revalidatePath("/organizer/profile");
  redirect("/organizer/profile");
}

export async function organizerUpdateAccountAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  const displayName = formString(formData, "display_name");
  if (!displayName) throw new Error("Nazwa kontaktowa jest wymagana.");

  const supabase = await createSupabaseUserClient();
  const payload: ProfileUpdate = {
    display_name: displayName
  };
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", context.userId);

  if (error) throw new Error(`Nie udalo sie zapisac ustawien konta: ${error.message}`);
  revalidatePath("/organizer/settings");
}

export async function createOrganizerAccountAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  const name = formString(formData, "organizer_name") ?? context.profile?.display_name;
  if (!name) throw new Error("Nazwa organizatora jest wymagana.");

  const supabase = await createSupabaseUserClient();
  const { data: authData } = await supabase.auth.getUser();
  const slug = await createUniqueOrganizerSlug(createSlug(name));

  const organizer: OrganizerInsert = {
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

  const { error: memberError } = await supabase
    .from("organizer_users")
    .insert({
      organizer_id: data.id,
      user_id: context.userId,
      role: "owner"
    });

  if (memberError) throw new Error(`Nie udalo sie powiazac konta z organizatorem: ${memberError.message}`);

  if (context.profile) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "organizer" })
      .eq("id", context.userId);
    if (profileError) throw new Error(`Nie udalo sie zaktualizowac roli profilu: ${profileError.message}`);
  } else {
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: context.userId,
        display_name: name,
        role: "organizer"
      });
    if (profileError) throw new Error(`Nie udalo sie utworzyc profilu uzytkownika: ${profileError.message}`);
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
  revalidatePath("/");
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
  const { error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .eq("submitted_by_organizer_id", existing.submitted_by_organizer_id);

  if (error) throw new Error(`Nie udalo sie zaktualizowac wydarzenia: ${error.message}`);
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
      saves: 0,
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

async function getOrganizerStatsSummary(eventIds: string[], monthStart?: Date) {
  if (!eventIds.length) {
    return {
      monthViews: 0,
      monthContactClicks: 0,
      monthTicketClicks: 0,
      totalSaves: 0,
      countsByEvent: new Map<string, Map<string, number>>(),
      savedEventsByEvent: new Map<string, number>()
    };
  }

  const supabase = await createSupabaseUserClient();
  const [analytics, savedEvents] = await Promise.all([
    supabase
      .from("event_analytics")
      .select("event_id, event_type, created_at")
      .in("event_id", eventIds)
      .returns<EventAnalyticsRow[]>(),
    supabase
      .from("saved_events")
      .select("event_id")
      .in("event_id", eventIds)
  ]);

  if (analytics.error) {
    console.error("[organizer] Failed to load event_analytics stats", analytics.error);
  }
  if (savedEvents.error) {
    console.error("[organizer] Failed to load saved_events stats", savedEvents.error);
  }

  const countsByEvent = new Map<string, Map<string, number>>();
  const monthStartTime = monthStart?.getTime() ?? null;
  let monthViews = 0;
  let monthContactClicks = 0;
  let monthTicketClicks = 0;

  (analytics.data ?? []).forEach((row) => {
    const eventCounts = countsByEvent.get(row.event_id) ?? new Map<string, number>();
    eventCounts.set(row.event_type, (eventCounts.get(row.event_type) ?? 0) + 1);
    countsByEvent.set(row.event_id, eventCounts);

    const createdAt = new Date(row.created_at).getTime();
    const inMonth = monthStartTime == null || createdAt >= monthStartTime;
    if (!inMonth) return;
    if (row.event_type === "view") monthViews += 1;
    if (row.event_type === "phone_click" || row.event_type === "website_click") monthContactClicks += 1;
    if (row.event_type === "ticket_click") monthTicketClicks += 1;
  });

  const savedEventsByEvent = new Map<string, number>();
  (savedEvents.data ?? []).forEach((row) => {
    savedEventsByEvent.set(row.event_id, (savedEventsByEvent.get(row.event_id) ?? 0) + 1);
  });

  if (analytics.error && savedEvents.error) {
    return {
      monthViews: 0,
      monthContactClicks: 0,
      monthTicketClicks: 0,
      totalSaves: 0,
      countsByEvent: new Map<string, Map<string, number>>(),
      savedEventsByEvent: new Map<string, number>()
    };
  }

  return {
    monthViews,
    monthContactClicks,
    monthTicketClicks,
    totalSaves: Array.from(countsByEvent.values()).reduce((sum, item) => sum + (item.get("save_click") ?? 0), 0) +
      (savedEvents.data?.length ?? 0),
    countsByEvent,
    savedEventsByEvent
  };
}

function getAnalyticsCount(countsByEvent: Map<string, Map<string, number>>, eventId: string, eventType: string) {
  return countsByEvent.get(eventId)?.get(eventType) ?? 0;
}

function normalizeDateFilter(value: string, endOfDay = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.toISOString();
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
