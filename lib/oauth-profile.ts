import type { User } from "@supabase/supabase-js";
import { createSlug } from "@/lib/event-editor";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { GoogleOAuthRegistration } from "@/lib/oauth-state";

type SupabaseUserClient = Awaited<ReturnType<typeof createSupabaseUserClient>>;

export async function ensureGoogleOAuthAccount(
  supabase: SupabaseUserClient,
  user: User,
  registration: GoogleOAuthRegistration
) {
  const displayName = getGoogleDisplayName(user);
  const desiredRole = registration.intent === "register" ? registration.role : "user";

  const { data: profile, error: profileSelectError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileSelectError) throw profileSelectError;

  if (!profile) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      display_name: displayName,
      role: desiredRole
    });
    if (error) throw error;
  } else {
    const updates: { display_name?: string; role?: string } = {};
    if (!profile.display_name) updates.display_name = displayName;
    if (!profile.role) updates.role = desiredRole;

    // Registration may promote a regular account to organizer, but never changes an admin role.
    if (registration.intent === "register" && registration.role === "organizer" && profile.role !== "admin") {
      updates.role = "organizer";
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;
    }
  }

  if (registration.intent === "register" && registration.role === "organizer") {
    await ensureOrganizerMembership(supabase, user, registration.organizerName ?? displayName);
  }
}

async function ensureOrganizerMembership(supabase: SupabaseUserClient, user: User, organizerName: string) {
  const { data: memberships, error: membershipSelectError } = await supabase
    .from("organizer_users")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipSelectError) throw membershipSelectError;
  if (memberships && memberships.length > 0) return;

  const baseSlug = createSlug(organizerName) || `organizator-${user.id.slice(0, 8)}`;
  let organizer = await supabase
    .from("organizers")
    .insert({
      name: organizerName,
      slug: baseSlug,
      email: user.email ?? null,
      is_verified: false
    })
    .select("id")
    .single();

  if (organizer.error?.code === "23505") {
    organizer = await supabase
      .from("organizers")
      .insert({
        name: organizerName,
        slug: `${baseSlug}-${user.id.slice(0, 8)}`,
        email: user.email ?? null,
        is_verified: false
      })
      .select("id")
      .single();
  }

  if (organizer.error || !organizer.data) throw organizer.error ?? new Error("Nie utworzono organizatora.");

  const { error: membershipError } = await supabase.from("organizer_users").insert({
    organizer_id: organizer.data.id,
    user_id: user.id,
    role: "owner"
  });
  if (membershipError) throw membershipError;
}

function getGoogleDisplayName(user: User) {
  const metadataName = user.user_metadata.full_name ?? user.user_metadata.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim().slice(0, 160);
  return user.email?.split("@")[0] ?? "Użytkownik";
}
