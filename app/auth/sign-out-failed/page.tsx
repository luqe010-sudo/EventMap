import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ponów wylogowanie | MapaImprez",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function SignOutFailedPage() {
  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">MapaImprez.pl</p>
        <h1>Nie udało się potwierdzić wylogowania</h1>
        <p className="formError" role="alert">
          Twoja sesja może nadal być aktywna. Spróbuj ponownie, gdy połączenie z usługą logowania będzie dostępne.
        </p>
        <form action="/auth/sign-out" method="post" className="managementForm">
          <button type="submit" className="primaryButton">Ponów wylogowanie</button>
        </form>
        <p className="authHelpLinks"><Link href="/">Wróć na stronę główną</Link></p>
      </section>
    </main>
  );
}
