import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GoogleOnboardingForm from "@/components/GoogleOnboardingForm";
import { GOOGLE_ONBOARDING_COOKIE } from "@/lib/oauth-state";
import { createSupabaseUserClient } from "@/lib/supabase-user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dokończ rejestrację | MapaImprez",
  robots: {
    index: false,
    follow: false
  }
};

export default async function GoogleOnboardingPage() {
  const supabase = await createSupabaseUserClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) redirect("/login");

  const cookieStore = await cookies();
  if (cookieStore.get(GOOGLE_ONBOARDING_COOKIE)?.value !== data.user.id) redirect("/");

  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">Konto Google połączone</p>
        <h1>Dokończ rejestrację</h1>
        <p className="authOnboardingIntro">
          Wybierz typ konta i zaakceptuj wymagane dokumenty. Profil MapaImprez powstanie dopiero po
          zatwierdzeniu tego formularza.
        </p>
        <GoogleOnboardingForm />
      </section>
    </main>
  );
}
