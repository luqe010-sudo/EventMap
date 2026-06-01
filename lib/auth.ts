import { redirect } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type OrganizerMembership = Tables["organizer_users"]["Row"] & {
  organizer: Pick<Tables["organizers"]["Row"], "id" | "name" | "slug"> | null;
};

export type CurrentUserContext = {
  userId: string;
  profile: Profile | null;
};

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createSupabaseUserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Nie udalo sie pobrac profilu: ${profileError.message}`);

  return {
    userId: authData.user.id,
    profile
  };
}

export async function requireAdmin() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");
  if (context.profile?.role !== "admin") redirect("/");
  return context;
}

export async function requireOrganizerAccess() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  if (context.profile?.role === "admin") {
    return {
      ...context,
      memberships: [] as OrganizerMembership[],
      isAdmin: true
    };
  }

  if (context.profile?.role !== "organizer") redirect("/");

  const memberships = await listOrganizerMemberships(context.userId);
  if (!memberships.length) {
    return {
      ...context,
      memberships,
      isAdmin: false
    };
  }

  return {
    ...context,
    memberships,
    isAdmin: false
  };
}

export async function listOrganizerMemberships(userId: string): Promise<OrganizerMembership[]> {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase
    .from("organizer_users")
    .select("id, organizer_id, user_id, role, created_at, organizer:organizers(id, name, slug)")
    .eq("user_id", userId)
    .returns<OrganizerMembership[]>();

  if (error) throw new Error(`Nie udalo sie pobrac organizatorow uzytkownika: ${error.message}`);
  return data ?? [];
}

export function getPrimaryOrganizerId(memberships: OrganizerMembership[]) {
  return memberships.find((item) => item.organizer_id)?.organizer_id ?? null;
}
