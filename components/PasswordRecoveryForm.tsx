"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, resetPasswordAction, type PasswordFormState } from "@/lib/auth-password-actions";

const initialState: PasswordFormState = { error: null };

export default function PasswordRecoveryForm({ mode, next, linkError = false }: {
  mode: "request" | "reset"; next: string; linkError?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    mode === "request" ? requestPasswordResetAction : resetPasswordAction, initialState
  );

  return (
    <>
      {state.error || (linkError && !state.sent) ? (
        <p className="formError" role="alert">
          {state.error ?? "Link jest nieprawidłowy lub wygasł. Poproś o nowy link do zmiany hasła."}
        </p>
      ) : null}
      {state.sent ? (
        <p className="formSuccess" role="status">
          Jeśli ten adres jest przypisany do konta, otrzymasz wiadomość z linkiem do zmiany hasła. Sprawdź też folder spam.
        </p>
      ) : (
        <form action={formAction} className="managementForm">
          <input type="hidden" name="next" value={next} />
          {mode === "request" ? (
            <label>Adres e-mail
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
          ) : (
            <>
              <label>Nowe hasło
                <input name="password" type="password" autoComplete="new-password" minLength={6} maxLength={128} required aria-describedby="passwordRequirements" />
              </label>
              <p id="passwordRequirements" className="authOnboardingIntro">Co najmniej 6 znaków. Wybierz długie, unikalne hasło.</p>
              <label>Powtórz nowe hasło
                <input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} maxLength={128} required />
              </label>
            </>
          )}
          <button type="submit" className="primaryButton" disabled={pending}>
            {pending ? "Proszę czekać…" : mode === "request" ? "Wyślij link do zmiany hasła" : "Zapisz nowe hasło"}
          </button>
        </form>
      )}
      <p className="authHelpLinks">
        <Link href={`/login?next=${encodeURIComponent(next)}`}>Wróć do logowania</Link>
        {mode === "reset" ? <> · <Link href={`/forgot-password?next=${encodeURIComponent(next)}`}>Poproś o nowy link</Link></> : null}
      </p>
    </>
  );
}
