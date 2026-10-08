"use server";

import { safeNextPath } from "@/lib/navigation";
import { redirect } from "next/navigation";
import { parseRegistrationRole } from "@/lib/auth-validation";
import { cookies } from "next/headers";
import { getRequestOrigin } from "@/lib/auth-origin";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { createSlug } from "@/lib/event-editor";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_ONBOARDING_COOKIE,
  type GoogleOAuthRegistration
} from "@/lib/oauth-state";
import { ensureGoogleOAuthAccount } from "@/lib/oauth-profile";
import { PASSWORD_RECOVERY_COOKIE, recoveryCookieOptions } from "@/lib/password-recovery";

export type SignInFormState = {
  error: string | null;
};

export type GoogleOnboardingFormState = {
  error: string | null;
};

export async function signInAction(formData: FormData): Promise<SignInFormState> {
  return signInWithFormData(formData);
}

export async function signInFormAction(
  _previousState: SignInFormState,
  formData: FormData
): Promise<SignInFormState> {
  return signInWithFormData(formData);
}

export async function signInWithGoogleAction(formData: FormData) {
  const intent = formData.get("intent") === "register" ? "register" : "login";
  const requestedNext = safeNextPath(formData.get("next"));
  const role = formData.get("role") === "organizer" ? "organizer" : "user";
  const organizerNameValue = formData.get("organizerName");
  const organizerName =
    typeof organizerNameValue === "string" && organizerNameValue.trim()
      ? organizerNameValue.trim().slice(0, 160)
      : null;

  if (intent === "register") {
    if (formData.get("termsAccepted") !== "on" || formData.get("privacyNoticeAccepted") !== "on") {
      redirect(`/register?oauth_error=consent&next=${encodeURIComponent(requestedNext)}`);
    }
  }

  let origin: string;
  try {
    origin = await getRequestOrigin();
  } catch {
    console.error("[auth] Could not resolve the Google OAuth callback origin");
    redirect(`/${intent === "register" ? "register" : "login"}?oauth_error=start&next=${encodeURIComponent(requestedNext)}`);
  }
  const callbackUrl = new URL("/auth/callback", origin);
  const registration: GoogleOAuthRegistration = {
    intent,
    role,
    organizerName,
    next: intent === "register" && requestedNext === "/"
      ? role === "organizer" ? "/organizer" : "/"
      : requestedNext
  };

  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", { ...recoveryCookieOptions(callbackUrl.protocol === "https:"), maxAge: 0 });
  cookieStore.set(GOOGLE_OAUTH_COOKIE, encodeURIComponent(JSON.stringify(registration)), {
    httpOnly: true,
    sameSite: "lax",
    secure: callbackUrl.protocol === "https:",
    path: "/auth/callback",
    maxAge: 10 * 60
  });

  let supabase: Awaited<ReturnType<typeof createSupabaseUserClient>>;
  try {
    supabase = await createSupabaseUserClient();
  } catch (error) {
    console.error("[auth] Failed to create Supabase client for Google OAuth", error);
    redirect(`/${intent === "register" ? "register" : "login"}?oauth_error=start&next=${encodeURIComponent(requestedNext)}`);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        prompt: "select_account"
      }
    }
  });

  if (error || !data.url) {
    console.error("[auth] Failed to start Google OAuth", error);
    redirect(`/${intent === "register" ? "register" : "login"}?oauth_error=start&next=${encodeURIComponent(requestedNext)}`);
  }

  redirect(data.url);
}

export async function completeGoogleOnboardingAction(
  _previousState: GoogleOnboardingFormState,
  formData: FormData
): Promise<GoogleOnboardingFormState> {
  const requestedNext = safeNextPath(formData.get("next"));
  const role = formData.get("role") === "organizer" ? "organizer" : "user";
  const organizerNameValue = formData.get("organizerName");
  const organizerName =
    typeof organizerNameValue === "string" && organizerNameValue.trim()
      ? organizerNameValue.trim().slice(0, 160)
      : null;

  if (formData.get("termsAccepted") !== "on") {
    return { error: "Akceptacja regulaminu jest wymagana." };
  }
  if (formData.get("privacyNoticeAccepted") !== "on") {
    return { error: "Potwierdzenie zapoznania się z polityką prywatności i cookies jest wymagane." };
  }

  try {
    const supabase = await createSupabaseUserClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return { error: "Sesja Google wygasła. Zaloguj się ponownie." };
    }

    const cookieStore = await cookies();
    if (cookieStore.get(GOOGLE_ONBOARDING_COOKIE)?.value !== data.user.id) {
      return { error: "Sesja rejestracji wygasła. Zaloguj się ponownie przez Google." };
    }

    await ensureGoogleOAuthAccount(supabase, data.user, {
      intent: "register",
      role,
      organizerName,
      next: role === "organizer" ? "/organizer" : "/"
    });

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { eventmap_onboarding_completed: true }
    });
    if (metadataError) throw metadataError;
    cookieStore.set(GOOGLE_ONBOARDING_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/auth/onboarding",
      maxAge: 0
    });
  } catch (error) {
    console.error("[auth] Failed to complete Google onboarding", error);
    return { error: "Nie udało się utworzyć profilu. Spróbuj ponownie." };
  }

  redirect(requestedNext !== "/" ? requestedNext : role === "organizer" ? "/organizer" : "/");
}

async function signInWithFormData(formData: FormData): Promise<SignInFormState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email i haslo sa wymagane." };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseUserClient>>;
  try {
    supabase = await createSupabaseUserClient();
  } catch (error) {
    console.error("[auth] Failed to create Supabase user client", error);
    return { error: "Nie udalo sie polaczyc z usluga logowania." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("[auth] Failed to sign in", error);
    return { error: mapSignInError(error.message) };
  }

  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", { ...recoveryCookieOptions(process.env.NODE_ENV === "production"), maxAge: 0 });
  redirect(safeNextPath(formData.get("next")));
}

function mapSignInError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Potwierdź adres e-mail przez link w wiadomości aktywacyjnej. Sprawdź też folder spam.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Nieprawidlowy email lub haslo.";
  }

  return `Nie udalo sie zalogowac: ${message}`;
}

export async function signUpAction(formData: FormData): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }> {
  try {
    const email = formData.get("email");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    const displayName = formData.get("displayName");
    const role = parseRegistrationRole(formData.get("role"));
    const organizerName = formData.get("organizerName");
    const termsAccepted = formData.get("termsAccepted");
    const privacyNoticeAccepted = formData.get("privacyNoticeAccepted");

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string" ||
      typeof displayName !== "string" ||
      role === null
    ) {
      return { success: false, error: "Wszystkie pola sa wymagane." };
    }

    if (termsAccepted !== "on") {
      return { success: false, error: "Akceptacja regulaminu jest wymagana." };
    }

    if (privacyNoticeAccepted !== "on") {
      return { success: false, error: "Potwierdzenie zapoznania sie z polityka prywatnosci i cookies jest wymagane." };
    }

    if (password !== confirmPassword) {
      return { success: false, error: "Hasla nie sa identyczne." };
    }

    if (password.length < 6) {
      return { success: false, error: "Haslo musi miec co najmniej 6 znakow." };
    }

    const supabase = await createSupabaseUserClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          role: role,
          organizer_name: (typeof organizerName === "string" && organizerName.trim()) || displayName,
          eventmap_onboarding_completed: true
        }
      }
    });

    if (signUpError || !signUpData.user) {
      return { success: false, error: signUpError?.message || "Rejestracja nie powiodla sie." };
    }

    // Ensure current server action client session is updated so RLS works
    if (signUpData.session) {
      await supabase.auth.setSession({
        access_token: signUpData.session.access_token,
        refresh_token: signUpData.session.refresh_token
      });

      const authUser = signUpData.user;

      // Safe insert/update profile: triggers might create profiles automatically in some Supabase projects
      const { data: existingProfile, error: profileSelectError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileSelectError) {
        // If select fails (e.g. RLS blocks select for unconfirmed user), attempt direct insert
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authUser.id,
            display_name: displayName,
            role: role
          });
        if (profileError) {
          return { success: false, error: `Nie udalo sie utworzyc profilu uzytkownika: ${profileError.message}` };
        }
      } else if (!existingProfile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authUser.id,
            display_name: displayName,
            role: role
          });
        if (profileError) {
          return { success: false, error: `Nie udalo sie utworzyc profilu uzytkownika: ${profileError.message}` };
        }
      } else {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            display_name: displayName,
            role: role
          })
          .eq("id", authUser.id);
        if (updateError) {
          return { success: false, error: `Nie udalo sie zaktualizowac profilu uzytkownika: ${updateError.message}` };
        }
      }

      // Check if they are already mapped to an organizer (created by the trigger!)
      const { data: existingMember } = await supabase
        .from("organizer_users")
        .select("id")
        .eq("user_id", authUser.id)
        .limit(1);

      // Create organizer if they selected "organizer" role and no trigger did it
      if (role === "organizer" && (!existingMember || existingMember.length === 0)) {
        const orgName = (typeof organizerName === "string" && organizerName.trim()) || displayName;
        const orgSlug = createSlug(orgName);

        const { data: orgData, error: orgError } = await supabase
          .from("organizers")
          .insert({
            name: orgName,
            slug: orgSlug,
            email: email,
            is_verified: false
          })
          .select("id")
          .single();

        if (orgError) {
          console.error("[auth] Failed to create an organizer profile", { code: orgError.code });
          return { success: false, error: "Nie udało się utworzyć profilu organizatora. Spróbuj ponownie lub skontaktuj się z obsługą strony." };
        }

        const { error: memberError } = await supabase
          .from("organizer_users")
          .insert({
            organizer_id: orgData.id,
            user_id: authUser.id,
            role: "owner"
          });

        if (memberError) {
          return { success: false, error: `Nie udalo sie powiazac uzytkownika z organizatorem: ${memberError.message}` };
        }
      }
    }

    return { success: true, requiresEmailConfirmation: !signUpData.session };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Wystapil nieoczekiwany blad."
    };
  }
}
