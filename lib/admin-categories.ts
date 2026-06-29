"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { createSlug, formSlug, formString, formNumber } from "@/lib/event-editor";
import { normalizeSearchText } from "@/lib/slugify";

type Tables = Database["public"]["Tables"];
type CategoryRow = Tables["categories"]["Row"];
type CategoryInsert = Tables["categories"]["Insert"];
type CategoryUpdate = Tables["categories"]["Update"];

export type AdminCategory = CategoryRow;

export type AdminCategoryFilters = {
  q?: string;
  icon?: string;
  sort?: string;
  dir?: string;
};

export async function listAdminCategories(filters: AdminCategoryFilters = {}): Promise<AdminCategory[]> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .limit(1000);

  if (error) throw new Error(`Nie udało się pobrać kategorii: ${error.message}`);
  return sortAdminCategories(filterAdminCategories(data ?? [], filters), filters);
}

export async function getAdminCategoryForEdit(id: string): Promise<AdminCategory | null> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Nie udało się pobrać kategorii: ${error.message}`);
  return data;
}

export async function adminCreateCategoryAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const payload = buildCategoryPayload(formData);

  const { data, error } = await supabase
    .from("categories")
    .insert(payload as CategoryInsert)
    .select("id")
    .single();

  if (error) throw new Error(`Nie udało się utworzyć kategorii: ${error.message}`);

  revalidateCategoryPaths();
  redirect(`/admin/categories/${data.id}/edit`);
}

export async function adminUpdateCategoryAction(categoryId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const payload = buildCategoryPayload(formData);

  const { data, error } = await supabase
    .from("categories")
    .update(payload as CategoryUpdate)
    .eq("id", categoryId)
    .select();

  if (error) {
    console.error("adminUpdateCategoryAction error:", error);
    throw new Error(`Nie udało się zapisać kategorii: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Nie udało się zapisać kategorii (zaktualizowano 0 wierszy). Może to oznaczać brak uprawnień w bazie danych (RLS policies) lub nieistniejący identyfikator kategorii."
    );
  }

  revalidateCategoryPaths();
  redirect("/admin/categories");

}

export async function adminDeleteCategoryAction(categoryId: string) {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();

  // Check if any events use this category
  const { count, error: countError } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (countError) throw new Error(`Nie udało się sprawdzić powiązanych wydarzeń: ${countError.message}`);
  if (count && count > 0) {
    throw new Error(`Nie można usunąć kategorii — jest przypisana do ${count} wydarzeń. Najpierw zmień kategorię tych wydarzeń.`);
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) throw new Error(`Nie udało się usunąć kategorii: ${error.message}`);

  revalidateCategoryPaths();
}

function buildCategoryPayload(formData: FormData): CategoryInsert | CategoryUpdate {
  const name = formString(formData, "name");
  if (!name) throw new Error("Nazwa kategorii jest wymagana.");

  return {
    name,
    slug: formSlug(formData, "slug") ?? createSlug(name),
    color: formString(formData, "color"),
    icon: formString(formData, "icon"),
    sort_order: formNumber(formData, "sort_order"),
  };
}

function filterAdminCategories(categories: AdminCategory[], filters: AdminCategoryFilters) {
  const q = normalizeSearch(filters.q);
  const icon = normalizeSearch(filters.icon);

  return categories.filter((category) => {
    if (q && ![category.name, category.slug, category.icon, category.color]
      .some((value) => normalizeSearch(value).includes(q))) {
      return false;
    }
    if (icon && !normalizeSearch(category.icon).includes(icon)) return false;
    return true;
  });
}

function sortAdminCategories(categories: AdminCategory[], filters: AdminCategoryFilters) {
  const sort = filters.sort ?? "sort_order";
  const direction = filters.dir === "desc" ? -1 : 1;
  return [...categories].sort((first, second) => compareCategoryValue(first, second, sort) * direction);
}

function compareCategoryValue(first: AdminCategory, second: AdminCategory, sort: string) {
  if (sort === "name") return first.name.localeCompare(second.name, "pl");
  if (sort === "slug") return first.slug.localeCompare(second.slug, "pl");
  if (sort === "icon") return (first.icon ?? "").localeCompare(second.icon ?? "", "pl");
  if (sort === "created_at") return dateValue(first.created_at) - dateValue(second.created_at);
  return (first.sort_order ?? Number.MAX_SAFE_INTEGER) - (second.sort_order ?? Number.MAX_SAFE_INTEGER)
    || first.name.localeCompare(second.name, "pl");
}

function normalizeSearch(value: string | null | undefined) {
  return normalizeSearchText(value).trim();
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function revalidateCategoryPaths() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/events/new");
  revalidatePath("/admin/events");
  revalidatePath("/admin");
  revalidatePath("/");
}
