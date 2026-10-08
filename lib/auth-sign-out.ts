import { unstable_rethrow } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

/** Auth may return an error before it removes the persisted session. */
export async function confirmSignOut(
  supabase: Pick<SupabaseClient<Database>, "auth">,
  scope: "global" | "local" = "global"
) {
  try {
    const { error } = await supabase.auth.signOut({ scope });
    if (!error) return true;
    console.error("[auth] Sign-out was not confirmed", { code: error.code, status: error.status });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] Sign-out service unavailable");
  }
  return false;
}
