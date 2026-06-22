"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInFormAction, type SignInFormState } from "@/lib/auth-actions";
import { signInWithGoogleAction } from "@/lib/auth-actions";
import GoogleIcon from "@/components/GoogleIcon";

const initialSignInFormState: SignInFormState = {
  error: null
};

export default function LoginForm({
  oauthError = null,
  next = "/"
}: {
  oauthError?: string | null;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(
    signInFormAction,
    initialSignInFormState
  );

  return (
    <>
      {state.error || oauthError ? (
        <div className="formError" role="alert">
          {state.error ?? oauthError}
        </div>
      ) : null}

      <form action={signInWithGoogleAction}>
        <input type="hidden" name="intent" value="login" />
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="googleAuthButton">
          <GoogleIcon />
          Kontynuuj z Google
        </button>
      </form>

      <div className="authDivider"><span>lub</span></div>

      <form action={formAction} className="managementForm">
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Haslo
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit" className="primaryButton" disabled={pending}>
          {pending ? "Logowanie..." : "Zaloguj"}
        </button>
      </form>

      <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>
        Nie masz konta?{" "}
        <Link href="/register" style={{ color: "#d95d39", fontWeight: 600, textDecoration: "underline" }}>
          Zarejestruj sie
        </Link>
      </p>
    </>
  );
}
