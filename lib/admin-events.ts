"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { assertEventStatus, editableEventSelect, formString, type EditableEvent, type EventStatus } from "@/lib/event-editor";
import { buildEventWritePayload, deleteEventRelations, saveEventSource } from "@/lib/event-editor-server";

type Tables = Database["public"]["Tables"];
type EventInsert = Tables["events"]["Insert"];
type EventUpdate = Tables["events"]["Update"];

const ADMIN_EVENT_LIST_SELECT = `
  id,
  title,
  start_at,
  status,
  visibility,
  category:categories(name),
  location:locations(city),
  organizer:organizers!events_organizer_id_fkey(name)
`;

export type AdminEventListItem = {
  id: string;
  title: string;
  start_at: string;
  status: string | null;
  visibility: string | null;
  category: { name: string } | null;
  location: { city: string | null } | null;
  organizer: { name: string } | null;
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

export async function listAdminEvents() {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("events")
    .select(ADMIN_EVENT_LIST_SELECT)
    .order("start_at", { ascending: false })
    .limit(250)
    .returns<AdminEventListItem[]>();

  if (error) throw new Error(`Nie udalo sie pobrac wydarzen admina: ${error.message}`);
  return data ?? [];
}

export async function getAdminEventEditorOptions() {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const [categories, organizers, locations] = await Promise.all([
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
    supabase.from("organizers").select("id, name").order("name", { ascending: true }),
    supabase.from("locations").select("id, name, address, city").order("city", { ascending: true }).limit(500)
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
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const status = formString(formData, "status") ?? "published";
  assertEventStatus(status);
  const event = await buildEventWritePayload(formData, {
    organizerId: formString(formData, "organizer_id") ?? "",
    status
  });

  const { error } = await supabase
    .from("events")
    .update(event as EventUpdate)
    .eq("id", eventId);

  if (error) throw new Error(`Nie udalo sie zapisac wydarzenia: ${error.message}`);

  await saveEventSource(eventId, formData, "manual");
  revalidateAdminPaths();
  redirect("/admin/events");
}

export async function adminSetEventStatusAction(eventId: string, status: EventStatus) {
  await requireAdmin();
  assertEventStatus(status);
  const supabase = await createSupabaseUserClient();
  const { error } = await supabase
    .from("events")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null
    })
    .eq("id", eventId);

  if (error) throw new Error(`Nie udalo sie zmienic statusu: ${error.message}`);
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
  revalidatePath("/");
}
