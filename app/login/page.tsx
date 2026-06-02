import Link from "next/link";
import { signInAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ signup?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams && typeof (searchParams as any).then === "function"
    ? await searchParams
    : (searchParams as any);
  const isSignupSuccess = resolvedParams?.signup === "success";

  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">EventMap</p>
        <h1>Logowanie</h1>

        {isSignupSuccess && (
          <div className="signupSuccessAlert" style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "0.92rem",
            fontWeight: 500,
            textAlign: "center"
          }}>
            Rejestracja powiodla sie! Mozesz teraz sie zalogowac.
          </div>
        )}

        <form action={signInAction} className="managementForm">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Haslo
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="primaryButton">Zaloguj</button>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>
          Nie masz konta?{" "}
          <Link href="/register" style={{ color: "#d95d39", fontWeight: 600, textDecoration: "underline" }}>
            Zarejestruj sie
          </Link>
        </p>
      </section>
    </main>
  );
}
