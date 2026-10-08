import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { PASSWORD_RECOVERY_COOKIE, recoveryCookieOptions, recoveryCookieValue } from "@/lib/password-recovery";
import { confirmSignOut } from "@/lib/auth-sign-out";
import { unstable_rethrow } from "next/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const cookieStore = await cookies();
  const cookieOptions = recoveryCookieOptions(url.protocol === "https:");
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", { ...cookieOptions, maxAge: 0 });

  const failure = () => recoveryRedirect(`/forgot-password?error=expired&next=${encodeURIComponent(next)}`, url.origin);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (url.searchParams.has("error") || (!code && !tokenHash) || (code && tokenHash)) return failure();

  try {
    const supabase = await createSupabaseUserClient();
    if (tokenHash) {
      if (url.searchParams.get("type") !== "recovery") return failure();
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (error || !data.session || !data.user) return failure();
    } else {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code!);
      // Supabase stores the recovery intent with the PKCE verifier. Never accept an OAuth code here.
      if (error || !data.session) return failure();
      if (!("redirectType" in data) || data.redirectType !== "recovery") {
        if (!await confirmSignOut(supabase, "local")) {
          return recoveryRedirect("/auth/sign-out-failed", url.origin);
        }
        return failure();
      }
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure();
    cookieStore.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(data.user.id), cookieOptions);
    return recoveryRedirect(`/auth/reset-password?next=${encodeURIComponent(next)}`, url.origin);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] Password recovery link verification failed");
    return failure();
  }
}

function recoveryRedirect(path: string, origin: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
