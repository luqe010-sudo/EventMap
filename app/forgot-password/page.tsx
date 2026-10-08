import type { Metadata } from "next";
import PasswordRecoveryForm from "@/components/PasswordRecoveryForm";
import { safeNextPath } from "@/lib/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Odzyskiwanie hasła | MapaImprez", robots: { index: false, follow: false }, referrer: "no-referrer"
};

export default async function ForgotPasswordPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">MapaImprez.pl</p>
        <h1>Odzyskiwanie hasła</h1>
        <p className="authOnboardingIntro">Podaj adres e-mail użyty podczas rejestracji. Wyślemy link do ustawienia nowego hasła.</p>
        <PasswordRecoveryForm mode="request" next={safeNextPath(params.next)} linkError={params.error === "expired"} />
      </section>
    </main>
  );
}
