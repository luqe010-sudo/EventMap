import type { createSupabaseUserClient } from "@/lib/supabase-user";

type SupabaseUserClient = Awaited<ReturnType<typeof createSupabaseUserClient>>;

export async function upgradeOrganizerAccount(supabase: SupabaseUserClient, name: string) {
  const { data, error } = await supabase.rpc("upgrade_my_organizer_account", {
    p_organizer_name: name
  });

  if (error) throw error;
  if (typeof data !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(data)) {
    throw new Error("Nie udało się potwierdzić utworzenia organizatora.");
  }
}
