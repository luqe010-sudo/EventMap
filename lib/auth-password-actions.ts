"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestOrigin } from "@/lib/auth-origin";
import { safeNextPath } from "@/lib/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import {
  hasRecoveryContext, PASSWORD_RECOVERY_COOKIE, recoveryCookieOptions, validateNewPassword
} from "@/lib/password-recovery";

export type PasswordFormState = { error: string | null; sent?: boolean };

export async function requestPasswordResetAction(
  _previousState: PasswordFormState, formData: FormData
): Promise<PasswordFormState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: "Wpisz poprawny adres e-mail." };
  }

  try {
    const callback = new URL("/auth/recovery", await getRequestOrigin());
    callback.searchParams.set("next", safeNextPath(formData.get("next")));
    const supabase = await createSupabaseUserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
    if (error) {
      if (error.code === "user_not_found") return { error: null, sent: true };
      console.error("[auth] Password recovery request failed", { code: error.code, status: error.status });
      return { error: error.status === 429
        ? "Wysłano zbyt wiele próśb. Odczekaj chwilę i spróbuj ponownie."
        : "Nie udało się wysłać linku. Spróbuj ponownie za chwilę." };
    }
    return { error: null, sent: true };
  } catch {
    console.error("[auth] Password recovery service unavailable");
    return { error: "Nie udało się połączyć z usługą odzyskiwania hasła. Spróbuj ponownie." };
  }
}

export async function resetPasswordAction(
  _previousState: PasswordFormState, formData: FormData
): Promise<PasswordFormState> {
  const password = formData.get("password");
  const validationError = validateNewPassword(password, formData.get("confirmPassword"));
  if (validationError) return { error: validationError };

  let passwordChanged = false;
  try {
    const supabase = await createSupabaseUserClient();
    const { data, error } = await supabase.auth.getUser();
    const cookieStore = await cookies();
    if (error || !data.user || !hasRecoveryContext(cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value, data.user.id)) {
      return { error: "Link lub sesja wygasły. Poproś o nowy link do zmiany hasła." };
    }
    const secure = (await getRequestOrigin()).startsWith("https:");
    const { error: updateError } = await supabase.auth.updateUser({ password: password as string });
    if (updateError) {
      console.error("[auth] Password update failed", { code: updateError.code, status: updateError.status });
      return { error: updateError.code === "same_password"
        ? "Nowe hasło musi różnić się od poprzedniego."
        : updateError.code === "weak_password"
          ? "To hasło jest zbyt słabe. Wybierz dłuższe hasło z różnymi znakami."
          : "Nie udało się zmienić hasła. Spróbuj ponownie lub poproś o nowy link." };
    }
    passwordChanged = true;
    cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", { ...recoveryCookieOptions(secure), maxAge: 0 });
    // The password has already changed; sign-out failure must not imply it failed.
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) console.error("[auth] Could not close the local recovery session");
    } catch { console.error("[auth] Could not close the local recovery session"); }
  } catch {
    if (!passwordChanged) {
      console.error("[auth] Password update service unavailable");
      return { error: "Nie udało się połączyć z usługą zmiany hasła. Spróbuj ponownie." };
    }
    console.error("[auth] Could not finish cleaning up the recovery session after a successful password update");
  }
  redirect(`/login?reset=success&next=${encodeURIComponent(safeNextPath(formData.get("next")))}`);
}
