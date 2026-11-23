import type { User } from "@supabase/supabase-js";
import { upgradeOrganizerAccount } from "@/lib/organizer-account";
import type { createSupabaseUserClient } from "@/lib/supabase-user";
import type { GoogleOAuthRegistration } from "@/lib/oauth-state";

type SupabaseUserClient = Awaited<ReturnType<typeof createSupabaseUserClient>>;

export async function ensureGoogleOAuthAccount(
  supabase: SupabaseUserClient,
  user: User,
  registration: GoogleOAuthRegistration
) {
  const displayName = getGoogleDisplayName(user);
  const requestedOrganizer = registration.intent === "register" && registration.role === "organizer";

  const { data: profile, error: profileSelectError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileSelectError) throw profileSelectError;

  if (!profile) {
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName,
      role: "user"
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const updates: { display_name?: string; role?: string } = {};
    if (!profile.display_name) updates.display_name = displayName;
    if (!profile.role) updates.role = "user";

    if (Object.keys(updates).length > 0) {
      let query = supabase.from("profiles").update(updates).eq("id", user.id);
      if (profile.role === null) query = query.is("role", null);
      if (profile.role === "") query = query.eq("role", "");
      const { error } = await query;
      if (error) throw error;
    }
  }

  if (requestedOrganizer && profile?.role !== "admin") {
    await upgradeOrganizerAccount(supabase, registration.organizerName ?? displayName);
  }
}

function getGoogleDisplayName(user: User) {
  const metadataName = user.user_metadata.full_name ?? user.user_metadata.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim().slice(0, 160);
  return user.email?.split("@")[0] ?? "Użytkownik";
}
