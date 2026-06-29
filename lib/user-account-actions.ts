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
  if (!eventId) return { saved: false, error: "Brakuje identyfikatora wydarzenia." };

  try {
    const supabase = await createSupabaseUserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { saved: false, requiresLogin: true };

    if (shouldSave) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .eq("status", "published")
        .eq("visibility", "public")
        .or("is_cancelled.is.null,is_cancelled.eq.false")
        .maybeSingle();
      if (eventError) throw eventError;
      if (!event) return { saved: false, error: "Tego wydarzenia nie można zapisać." };

      const { error } = await supabase.from("saved_events").insert({
        user_id: authData.user.id,
        event_id: eventId
      });
      if (error && error.code !== "23505") throw error;
    } else {
      const { error } = await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("event_id", eventId);
      if (error) throw error;
    }

    revalidatePath("/account");
    revalidatePath("/organizer/saved");
    return { saved: shouldSave };
  } catch (error) {
    console.error("[account] Failed to toggle saved event", error);
    return { saved: !shouldSave, error: "Nie udało się zmienić zapisu wydarzenia." };
  }
}

export async function removeSavedEventAction(eventId: string) {
  await toggleSavedEventAction(eventId, false);
  revalidatePath("/account");
  revalidatePath("/organizer/saved");
}
