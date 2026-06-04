"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";
import { createSlug, formString, formNumber } from "@/lib/event-editor";

type Tables = Database["public"]["Tables"];
type CategoryRow = Tables["categories"]["Row"];
type CategoryInsert = Tables["categories"]["Insert"];
type CategoryUpdate = Tables["categories"]["Update"];

export type AdminCategory = CategoryRow;

export async function listAdminCategories(): Promise<AdminCategory[]> {
  await requireAdmin();
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw new Error(`Nie udało się pobrać kategorii: ${error.message}`);
  return data ?? [];
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
  console.log("adminUpdateCategoryAction - categoryId:", categoryId);
  console.log("adminUpdateCategoryAction - payload:", payload);

  const { data, error } = await supabase
    .from("categories")
    .update(payload as CategoryUpdate)
    .eq("id", categoryId)
    .select();

  console.log("adminUpdateCategoryAction - db result data:", data);

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
    slug: formString(formData, "slug") ?? createSlug(name),
    color: formString(formData, "color"),
    icon: formString(formData, "icon"),
    sort_order: formNumber(formData, "sort_order"),
  };
}

function revalidateCategoryPaths() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/events/new");
  revalidatePath("/admin/events");
  revalidatePath("/admin");
  revalidatePath("/");
}
