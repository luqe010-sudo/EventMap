import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Logowanie | MapaImprez",
  robots: {
    index: false,
    follow: false
  }
};

type LoginPageProps = {
  searchParams: Promise<{ signup?: string; oauth_error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const isSignupSuccess = params?.signup === "success";
  const oauthError = getOAuthErrorMessage(params?.oauth_error);
  const next = safeNextPath(params?.next);

  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">MapaImprez.pl</p>
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

        <LoginForm oauthError={oauthError} next={next} />
      </section>
    </main>
  );
}

function getOAuthErrorMessage(code: string | undefined) {
  if (code === "cancelled") return "Logowanie przez Google zostało anulowane.";
  if (code === "callback") return "Nie udało się dokończyć logowania przez Google. Spróbuj ponownie.";
  if (code === "start") return "Nie udało się rozpocząć logowania przez Google. Spróbuj ponownie.";
  return null;
}

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
