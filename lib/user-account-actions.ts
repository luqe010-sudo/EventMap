"use server";

import { revalidatePath } from "next/cache";
import type { Database } from "@/database.types";
import { createSupabaseUserClient } from "@/lib/supabase-user";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export type UserProfileFormState = {
  error: string | null;
  success: string | null;
};

export type ToggleSavedEventResult = {
  saved: boolean;
  error?: string;
  requiresLogin?: boolean;
};

export async function updateUserProfileAction(
  _previousState: UserProfileFormState,
  formData: FormData
): Promise<UserProfileFormState> {
  const displayNameValue = formData.get("display_name");
  const displayName = typeof displayNameValue === "string" ? displayNameValue.trim() : "";
  if (displayName.length < 2) return { error: "Nazwa użytkownika musi mieć co najmniej 2 znaki.", success: null };
  if (displayName.length > 160) return { error: "Nazwa użytkownika może mieć maksymalnie 160 znaków.", success: null };

  try {
    const supabase = await createSupabaseUserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { error: "Sesja wygasła. Zaloguj się ponownie.", success: null };

    const { data: profile, error: profileSelectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileSelectError) throw profileSelectError;

    if (profile) {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", authData.user.id);
      if (error) throw error;
    } else {
      const metadataRole = authData.user.user_metadata.role;
      const payload: ProfileInsert = {
        id: authData.user.id,
        display_name: displayName,
        role: metadataRole === "organizer" ? "organizer" : "user"
      };
      const { error } = await supabase.from("profiles").insert(payload);
      if (error) throw error;
    }

    revalidatePath("/account");
    revalidatePath("/", "layout");
    return { error: null, success: "Nazwa użytkownika została zapisana." };
  } catch (error) {
    console.error("[account] Failed to update profile", error);
    return { error: "Nie udało się zapisać nazwy użytkownika.", success: null };
  }
}

export async function toggleSavedEventAction(
  eventId: string,
  shouldSave: boolean
): Promise<ToggleSavedEventResult> {
  if (typeof eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId) || typeof shouldSave !== "boolean") {
    return { saved: false, error: "Nieprawidłowe dane zapisu wydarzenia." };
  }

  try {
    const supabase = await createSupabaseUserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { saved: false, requiresLogin: true };

    const { data, error } = await supabase.rpc("set_my_saved_event", { p_event_id: eventId, p_saved: shouldSave });
    if (error) {
      if (shouldSave && error.code === "42501") return { saved: false, error: "Tego wydarzenia nie można już zapisać. Odśwież listę wydarzeń." };
      throw error;
    }
    if (data !== shouldSave) throw new Error("Unexpected saved event state");

    revalidatePath("/account");
    revalidatePath("/organizer/saved");
    return { saved: shouldSave };
  } catch (error) {
    console.error("[account] Failed to toggle saved event", error);
    return { saved: !shouldSave, error: "Nie udało się zmienić zapisu wydarzenia." };
  }
}

export async function removeSavedEventAction(eventId: string): Promise<ToggleSavedEventResult> {
  return toggleSavedEventAction(eventId, false);
}
