"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInFormAction, type SignInFormState } from "@/lib/auth-actions";

const initialSignInFormState: SignInFormState = {
  error: null
};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInFormAction,
    initialSignInFormState
  );

  return (
    <>
      {state.error ? (
        <div className="formError" role="alert">
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="managementForm">
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
