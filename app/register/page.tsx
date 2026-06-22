"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/lib/auth-actions";
import { signInWithGoogleAction } from "@/lib/auth-actions";
import GoogleIcon from "@/components/GoogleIcon";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [organizerName, setOrganizerName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
    if (oauthError === "consent") {
      setError("Aby zarejestrować się przez Google, zaakceptuj regulamin i potwierdź zapoznanie się z polityką prywatności oraz cookies.");
    } else if (oauthError === "start") {
      setError("Nie udało się rozpocząć rejestracji przez Google. Spróbuj ponownie.");
    }
  }, []);

  if (!mounted) {
    return (
      <main className="appShell managementShell">
        <section className="managementPanel loginPanel">
          <p className="eyebrow">MapaImprez.pl</p>
          <h1>Rejestracja</h1>
          <div style={{ minHeight: "350px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="locationPickerSpinner" />
          </div>
        </section>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!termsAccepted || !privacyNoticeAccepted) {
      setError("Akceptacja regulaminu i potwierdzenie zapoznania się z polityką prywatności oraz cookies są wymagane.");
      return;
    }
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await signUpAction(formData);
      if (res.success) {
        router.push("/login?signup=success");
      } else {
        setError(res.error || "Wystapil blad podczas rejestracji.");
        setPending(false);
      }
    } catch (err: any) {
      setError(err.message || "Wystapil nieznany blad podczas rejestracji.");
      setPending(false);
    }
  };

  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">MapaImprez.pl</p>
        <h1>Rejestracja</h1>

        {error && (
          <div className="formError" style={{ color: "#ef4444", marginBottom: "1rem", fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div className="managementForm">
          <label>
            Typ konta (Rola)
            <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Chce przegladac wydarzenia (Widz)</option>
              <option value="organizer">Chce publikowac wydarzenia (Organizator)</option>
            </select>
          </label>

          {role === "organizer" && (
            <label>
              Nazwa Organizacji / Firmy
              <input
                name="organizerName"
                type="text"
                placeholder="Domyslnie jak nazwa uzytkownika"
                value={organizerName}
                onChange={(event) => setOrganizerName(event.target.value)}
              />
            </label>
          )}

          <label className="checkboxLabel legalConsentCheckbox">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>
              Akceptuję{" "}
              <Link href="/regulamin" target="_blank">
                regulamin serwisu
              </Link>
              .
            </span>
          </label>

          <label className="checkboxLabel legalConsentCheckbox">
            <input type="checkbox" checked={privacyNoticeAccepted} onChange={(event) => setPrivacyNoticeAccepted(event.target.checked)} />
            <span>
              Potwierdzam, że zapoznałem/zapoznałam się z{" "}
              <Link href="/regulamin#polityka-prywatnosci" target="_blank">
                polityką prywatności / RODO
              </Link>{" "}
              oraz{" "}
              <Link href="/regulamin#polityka-cookies" target="_blank">
                polityką cookies
              </Link>
              .
            </span>
          </label>

        </div>

        <form action={signInWithGoogleAction} className="googleRegisterForm">
          <input type="hidden" name="intent" value="register" />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="organizerName" value={organizerName} />
          {termsAccepted && <input type="hidden" name="termsAccepted" value="on" />}
          {privacyNoticeAccepted && <input type="hidden" name="privacyNoticeAccepted" value="on" />}
          <button type="submit" className="googleAuthButton">
            <GoogleIcon />
            Zarejestruj się przez Google
          </button>
        </form>

        <div className="authDivider"><span>lub przez email</span></div>

        <form onSubmit={handleSubmit} className="managementForm">
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="organizerName" value={organizerName} />
          {termsAccepted && <input type="hidden" name="termsAccepted" value="on" />}
          {privacyNoticeAccepted && <input type="hidden" name="privacyNoticeAccepted" value="on" />}

          <label>
            Imie i Nazwisko / Nazwa uzytkownika
            <input name="displayName" type="text" required autoComplete="name" />
          </label>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Haslo
            <input name="password" type="password" required autoComplete="new-password" />
          </label>
          <label>
            Powtorz haslo
            <input name="confirmPassword" type="password" required autoComplete="new-password" />
          </label>
          <button type="submit" className="primaryButton" disabled={pending}>
            {pending ? "Rejestrowanie..." : "Zarejestruj sie"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>
          Masz juz konto?{" "}
          <Link href="/login" style={{ color: "#d95d39", fontWeight: 600, textDecoration: "underline" }}>
            Zaloguj sie
          </Link>
        </p>
      </section>
    </main>
  );
}
