"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrimaryOrganizerId, requireOrganizerAccess } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { editableEventSelect, formString, type EditableEvent } from "@/lib/event-editor";
import { buildEventWritePayload, saveEventSource } from "@/lib/event-editor-server";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];

const ORGANIZER_EVENT_LIST_SELECT = `
  id,
  title,
  start_at,
  status,
  visibility,
  category:categories(name),
  location:locations(city:cities(name)),
  organizer:organizers!events_organizer_id_fkey(name)
`;

export type OrganizerEventListItem = {
  id: string;
  title: string;
  start_at: string;
  status: string | null;
  visibility: string | null;
  category: { name: string } | null;
  location: { city: { name: string } | null } | null;
  organizer: { name: string } | null;
};

export async function getOrganizerDashboard() {
  const access = await requireOrganizerAccess();
  const organizerIds = access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[];
  if (!organizerIds.length) {
    return {
      memberships: access.memberships,
      events: [] as OrganizerEventListItem[],
      statusCounts: new Map<string, number>()
    };
  }

  const events = await listOrganizerEvents();
  const statusCounts = new Map<string, number>();
  events.forEach((event) => {
    const status = event.status ?? "draft";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  });

  return {
    memberships: access.memberships,
    events,
    statusCounts
  };
}

export async function listOrganizerEvents() {
  const access = await requireOrganizerAccess();
  const organizerIds = access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[];
  if (!organizerIds.length) return [];

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .select(ORGANIZER_EVENT_LIST_SELECT)
    .in("submitted_by_organizer_id", organizerIds)
    .order("start_at", { ascending: false })
    .limit(250)
    .returns<OrganizerEventListItem[]>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzen organizatora: ${error.message}`);
  return data ?? [];
}

export async function getOrganizerEventEditorOptions() {
  const access = await requireOrganizerAccess();
  const organizerIds = access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[];
  const supabase = await createSupabaseUserClient();
  const [categories, locations] = await Promise.all([
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
    supabase
      .from("locations")
      .select("id, name, address, city_id, city:cities(name)")
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
  const organizerIds = access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[];
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
  const organizerIds = access.memberships.map((item) => item.organizer_id).filter(Boolean) as string[];
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

function getAllowedOrganizerId(formData: FormData, allowedOrganizerIds: string[]) {
  if (!allowedOrganizerIds.length) throw new Error("Brakuje organizatora przypisanego do konta.");
  const requested = formString(formData, "organizer_id");
  if (requested && allowedOrganizerIds.includes(requested)) return requested;
  return allowedOrganizerIds[0];
}

function revalidateOrganizerPaths() {
  revalidatePath("/organizer");
  revalidatePath("/");
}
