"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { createSlug, formBoolean, formString } from "@/lib/event-editor";

type Tables = Database["public"]["Tables"];
type OrganizerInsert = Tables["organizers"]["Insert"];
type OrganizerUpdate = Tables["organizers"]["Update"];

export type AdminOrganizer = Tables["organizers"]["Row"] & {
  organizer_users: Array<Pick<Tables["organizer_users"]["Row"], "id" | "user_id" | "role">>;
};

const ORGANIZER_SELECT = `
  id,
  name,
  slug,
  website,
  facebook_url,
  phone,
  email,
  logo_url,
  type,
  description,
  is_verified,
  created_at,
  updated_at,
  organizer_users(id, user_id, role)
`;

export async function listAdminOrganizers() {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizers")
    .select(ORGANIZER_SELECT)
    .order("name", { ascending: true })
    .returns<AdminOrganizer[]>();

  if (error) throw new Error(`Nie udalo sie pobrac organizatorow: ${error.message}`);
  return data ?? [];
}

export async function getAdminOrganizerForEdit(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizers")
    .select(ORGANIZER_SELECT)
    .eq("id", id)
    .maybeSingle()
    .returns<AdminOrganizer | null>();

  if (error) throw new Error(`Nie udalo sie pobrac organizatora: ${error.message}`);
  return data;
}

export async function adminCreateOrganizerAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const organizer = buildOrganizerPayload(formData);

  const { data, error } = await supabase
    .from("organizers")
    .insert(organizer as OrganizerInsert)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udalo sie utworzyc organizatora: ${error.message}`);

  await saveOrganizerOwner(data.id, formData);
  revalidateOrganizerPaths();
  redirect(`/admin/organizers/${data.id}/edit`);
}

export async function adminUpdateOrganizerAction(organizerId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const organizer = buildOrganizerPayload(formData);

  const { error } = await supabase
    .from("organizers")
    .update(organizer as OrganizerUpdate)
    .eq("id", organizerId);

  if (error) throw new Error(`Nie udalo sie zapisac organizatora: ${error.message}`);

  await saveOrganizerOwner(organizerId, formData);
  revalidateOrganizerPaths();
  redirect("/admin/organizers");
}

function buildOrganizerPayload(formData: FormData): OrganizerInsert | OrganizerUpdate {
  const name = formString(formData, "name");
  if (!name) throw new Error("Nazwa organizatora jest wymagana.");

  return {
    name,
    slug: formString(formData, "slug") ?? createSlug(name),
    website: formString(formData, "website"),
    facebook_url: formString(formData, "facebook_url"),
    phone: formString(formData, "phone"),
    email: formString(formData, "email"),
    logo_url: formString(formData, "logo_url"),
    type: formString(formData, "type"),
    description: formString(formData, "description"),
    is_verified: formBoolean(formData, "is_verified"),
    updated_at: new Date().toISOString()
  };
}

async function saveOrganizerOwner(organizerId: string, formData: FormData) {
  const userId = formString(formData, "owner_user_id");
  if (!userId) return;

  const supabase = await createSupabaseUserClient();
  const { data: existing, error: existingError } = await supabase
    .from("organizer_users")
    .select("id")
    .eq("organizer_id", organizerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw new Error(`Nie udalo sie sprawdzic powiazania organizatora: ${existingError.message}`);
  if (existing) return;

  const { error } = await supabase
    .from("organizer_users")
    .insert({
      organizer_id: organizerId,
      user_id: userId,
      role: "owner"
    });

  if (error) throw new Error(`Nie udalo sie przypisac ownera organizatora: ${error.message}`);
}

function revalidateOrganizerPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/organizers");
  revalidatePath("/admin/events/new");
  revalidatePath("/admin/events");
  revalidatePath("/organizer");
}
