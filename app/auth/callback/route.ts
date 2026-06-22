import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_ONBOARDING_COOKIE,
  type GoogleOAuthRegistration
} from "@/lib/oauth-state";
import { ensureGoogleOAuthAccount } from "@/lib/oauth-profile";
import { createSupabaseUserClient } from "@/lib/supabase-user";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  const cookieStore = await cookies();
  const registration = readRegistration(cookieStore.get(GOOGLE_OAUTH_COOKIE)?.value);
  cookieStore.set(GOOGLE_OAUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/auth/callback",
    maxAge: 0
  });

  if (providerError || !code) {
    return NextResponse.redirect(new URL("/login?oauth_error=cancelled", url.origin));
  }

  try {
    const supabase = await createSupabaseUserClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) throw userError ?? new Error("Brak użytkownika po logowaniu OAuth.");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    // Google creates the Auth user during the first sign-in. Do not create the
    // application profile until the user accepts the legal terms and selects a role.
    const onboardingCompleted = data.user.user_metadata.eventmap_onboarding_completed === true;
    if (
      registration.intent === "login" &&
      !onboardingCompleted &&
      (
        !profile ||
        isGoogleOnlyAccount(data.user.app_metadata) ||
        isFirstSignIn(data.user.created_at, data.user.last_sign_in_at)
      )
    ) {
      cookieStore.set(GOOGLE_ONBOARDING_COOKIE, data.user.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        path: "/auth/onboarding",
        maxAge: 30 * 60
      });
      return NextResponse.redirect(new URL("/auth/onboarding", url.origin));
    }

    await ensureGoogleOAuthAccount(supabase, data.user, registration);
    if (registration.intent === "register") {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { eventmap_onboarding_completed: true }
      });
      if (metadataError) throw metadataError;
    }
    return NextResponse.redirect(new URL(safeNextPath(registration.next), url.origin));
  } catch (error) {
    console.error("[auth] Google OAuth callback failed", error);
    return NextResponse.redirect(new URL("/login?oauth_error=callback", url.origin));
  }
}

function readRegistration(value: string | undefined): GoogleOAuthRegistration {
  if (!value) return defaultRegistration();

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<GoogleOAuthRegistration>;
    return {
      intent: parsed.intent === "register" ? "register" : "login",
      role: parsed.role === "organizer" ? "organizer" : "user",
      organizerName: typeof parsed.organizerName === "string" ? parsed.organizerName.slice(0, 160) : null,
      next: safeNextPath(parsed.next)
    };
  } catch {
    return defaultRegistration();
  }
}

function defaultRegistration(): GoogleOAuthRegistration {
  return { intent: "login", role: "user", organizerName: null, next: "/" };
}

function safeNextPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function isFirstSignIn(createdAt: string, lastSignInAt: string | undefined) {
  if (!lastSignInAt) return true;
  const difference = Math.abs(new Date(lastSignInAt).getTime() - new Date(createdAt).getTime());
  return Number.isFinite(difference) && difference < 60_000;
}

function isGoogleOnlyAccount(appMetadata: Record<string, unknown>) {
  if (appMetadata.provider !== "google") return false;
  const providers = appMetadata.providers;
  return !Array.isArray(providers) || providers.every((provider) => provider === "google");
}
