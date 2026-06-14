"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { createSlug, formBoolean, formSlug, formString } from "@/lib/event-editor";
import { normalizeSearchText } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];
type OrganizerInsert = Tables["organizers"]["Insert"];
type OrganizerUpdate = Tables["organizers"]["Update"];

export type AdminOrganizer = Tables["organizers"]["Row"] & {
  organizer_users: Array<Pick<Tables["organizer_users"]["Row"], "id" | "user_id" | "role">>;
};

export type AdminOrganizerFilters = {
  q?: string;
  type?: string;
  verified?: string;
  sort?: string;
  dir?: string;
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

export async function listAdminOrganizers(filters: AdminOrganizerFilters = {}) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizers")
    .select(ORGANIZER_SELECT)
    .limit(1000)
    .returns<AdminOrganizer[]>();

  if (error) throw new Error(`Nie udalo sie pobrac organizatorow: ${error.message}`);
  return sortAdminOrganizers(filterAdminOrganizers(data ?? [], filters), filters);
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
    slug: formSlug(formData, "slug") ?? createSlug(name),
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

function filterAdminOrganizers(organizers: AdminOrganizer[], filters: AdminOrganizerFilters) {
  const q = normalizeSearch(filters.q);
  const type = normalizeSearch(filters.type);

  return organizers.filter((organizer) => {
    if (q && ![
      organizer.name,
      organizer.slug,
      organizer.type,
      organizer.email,
      organizer.phone,
      organizer.website,
      organizer.facebook_url,
      ...organizer.organizer_users.map((item) => item.user_id)
    ].some((value) => normalizeSearch(value).includes(q))) {
      return false;
    }
    if (type && !normalizeSearch(organizer.type).includes(type)) return false;
    if (filters.verified === "yes" && !organizer.is_verified) return false;
    if (filters.verified === "no" && organizer.is_verified) return false;
    return true;
  });
}

function sortAdminOrganizers(organizers: AdminOrganizer[], filters: AdminOrganizerFilters) {
  const sort = filters.sort ?? "name";
  const direction = filters.dir === "desc" ? -1 : 1;
  return [...organizers].sort((first, second) => compareOrganizerValue(first, second, sort) * direction);
}

function compareOrganizerValue(first: AdminOrganizer, second: AdminOrganizer, sort: string) {
  if (sort === "created_at") return dateValue(first.created_at) - dateValue(second.created_at);
  if (sort === "updated_at") return dateValue(first.updated_at) - dateValue(second.updated_at);
  if (sort === "type") return (first.type ?? "").localeCompare(second.type ?? "", "pl");
  if (sort === "verified") return Number(Boolean(first.is_verified)) - Number(Boolean(second.is_verified));
  return first.name.localeCompare(second.name, "pl");
}

function normalizeSearch(value: string | null | undefined) {
  return normalizeSearchText(value).trim();
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function revalidateOrganizerPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/organizers");
  revalidatePath("/admin/events/new");
  revalidatePath("/admin/events");
  revalidatePath("/organizer");
}
