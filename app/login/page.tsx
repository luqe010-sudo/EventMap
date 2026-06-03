import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ signup?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const isSignupSuccess = params?.signup === "success";

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

        <LoginForm />
      </section>
    </main>
  );
}
