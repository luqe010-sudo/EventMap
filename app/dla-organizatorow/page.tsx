import Link from "next/link";
import type { Metadata } from "next";
import { PROMOTION_DURATION_LABEL, PROMOTION_PAGE_PATH, PROMOTION_PRICE_LABEL } from "@/lib/promotion";

export const metadata: Metadata = {
  title: "Dodaj wydarzenie — dla organizatorów | MapaImprez.pl",
  description: "Zgłoś lokalne wydarzenie do MapaImprez.pl. Poznaj zasady dodawania i moderacji wydarzeń.",
  alternates: { canonical: "/dla-organizatorow" },
};

export default function OrganizerIntroduction() {
  return <main className="appShell legalPage">
    <section className="legalHero">
      <p className="legalEyebrow">Dla organizatorów</p>
      <h1>Dodaj swoje wydarzenie</h1>
      <p>Organizujesz koncert, festyn, targi lub inne lokalne wydarzenie w Polsce? Zgłoś je, aby odbiorcy mogli znaleźć je na mapie i w kalendarzu.</p>
    </section>
    <section className="legalDocument legalSection">
      <h2>Jak to działa?</h2>
      <ol>
        <li>Załóż konto organizatora i uzupełnij profil organizacji.</li>
        <li>W panelu dodaj tytuł, opis, termin, miejsce, kategorię, cenę i link do źródła lub biletów.</li>
        <li>Wyślij wydarzenie do sprawdzenia. Pojawi się publicznie po akceptacji moderatora.</li>
      </ol>
      <p>Możesz edytować swoje zgłoszenia. Zmiana opublikowanego wydarzenia wymaga ponownej moderacji.</p>
      <h2>Chcesz więcej odbiorców?</h2>
      <p>Dodanie wydarzenia jest bezpłatne. Opcjonalnie możesz je wyróżnić za <strong>{PROMOTION_PRICE_LABEL}</strong> – trafi do karuzeli „Polecane wydarzenia” z oznaczeniem „Promowane” {PROMOTION_DURATION_LABEL}. <Link href={PROMOTION_PAGE_PATH}>Zobacz szczegóły polecania</Link>.</p>
      <p><Link href="/register?next=%2Forganizer" className="primaryButton">Załóż konto organizatora</Link></p>
      <p><Link href="/login?next=%2Forganizer">Mam już konto — przejdź do panelu</Link></p>
    </section>
  </main>;
}
