import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import PasswordRecoveryForm from "@/components/PasswordRecoveryForm";
import { safeNextPath } from "@/lib/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { hasRecoveryContext, PASSWORD_RECOVERY_COOKIE } from "@/lib/password-recovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nowe hasło | MapaImprez", robots: { index: false, follow: false }, referrer: "no-referrer"
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  let canReset = false;
  try {
    const cookieStore = await cookies();
    if (cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value) {
      const supabase = await createSupabaseUserClient();
      const { data, error } = await supabase.auth.getUser();
      canReset = !error && !!data.user && hasRecoveryContext(cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value, data.user.id);
    }
  } catch { console.error("[auth] Could not check the password recovery session"); }

  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">MapaImprez.pl</p>
        <h1>Ustaw nowe hasło</h1>
        {canReset ? <PasswordRecoveryForm mode="reset" next={next} /> : (
          <>
            <p className="formError" role="alert">Link lub sesja wygasły. Otwórz link z wiadomości albo poproś o nowy.</p>
            <Link className="primaryButton" href={`/forgot-password?next=${encodeURIComponent(next)}`}>Poproś o nowy link</Link>
          </>
        )}
      </section>
    </main>
  );
}
