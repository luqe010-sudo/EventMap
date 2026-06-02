"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/lib/auth-actions";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        <p className="eyebrow">EventMap</p>
        <h1>Rejestracja</h1>

        {error && (
          <div className="formError" style={{ color: "#ef4444", marginBottom: "1rem", fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="managementForm">
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
              />
            </label>
          )}

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
