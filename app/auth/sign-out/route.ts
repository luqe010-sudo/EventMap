import { redirect, unstable_rethrow } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { cookies } from "next/headers";
import { PASSWORD_RECOVERY_COOKIE, recoveryCookieOptions } from "@/lib/password-recovery";
import { confirmSignOut } from "@/lib/auth-sign-out";

export async function POST() {
  let signedOut = false;
  try {
    const cookieStore = await cookies();
    cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", { ...recoveryCookieOptions(process.env.NODE_ENV === "production"), maxAge: 0 });
    const supabase = await createSupabaseUserClient();
    signedOut = await confirmSignOut(supabase);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] Could not prepare sign-out");
  }
  redirect(signedOut ? "/" : "/auth/sign-out-failed");
}
