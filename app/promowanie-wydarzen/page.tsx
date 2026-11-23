import Link from "next/link";
import type { Metadata } from "next";
import {
  PROMOTION_BENEFITS,
  PROMOTION_DURATION_LABEL,
  PROMOTION_PRICE_LABEL,
  PROMOTION_SELLER,
  PROMOTION_STEPS,
  buildPromotionQuestionMailto
} from "@/lib/promotion";

export const metadata: Metadata = {
  title: "Promowanie wydarzeń – polecenie za 39 zł | MapaImprez.pl",
  description:
    "Wyróżnij swoje wydarzenie w MapaImprez.pl: miejsce w karuzeli Polecane wydarzenia i oznaczenie Promowane za 39 zł brutto, do dnia wydarzenia.",
  alternates: { canonical: "/promowanie-wydarzen" }
};

export default function PromotionPage() {
  return (
    <main className="appShell legalPage">
      <section className="legalHero">
        <p className="legalEyebrow">Dla organizatorów</p>
        <h1>Polecanie wydarzeń</h1>
        <p>
          Dodanie wydarzenia do MapaImprez.pl jest bezpłatne. Jeśli chcesz, żeby więcej osób je zobaczyło, możesz je
          wyróżnić za <strong>{PROMOTION_PRICE_LABEL}</strong>.
        </p>
      </section>

      <article className="legalDocument">
        <section className="legalSection promotionPriceSection">
          <div className="promotionPriceCard">
            <span className="promotionPriceAmount">39 zł</span>
            <span className="promotionPriceMeta">brutto za jedno wydarzenie</span>
            <span className="promotionPriceMeta">{PROMOTION_DURATION_LABEL}</span>
          </div>
          <p>{PROMOTION_SELLER.vatNote}</p>
        </section>

        <section className="legalSection">
          <h2>Co dostajesz</h2>
          <ul>
            {PROMOTION_BENEFITS.map((benefit) => <li key={benefit}>{benefit}</li>)}
          </ul>
          <p>
            Wyróżnienie nie zmienia treści wydarzenia ani zasad moderacji – polecamy tylko wydarzenia zgodne z regulaminem.
            Kolejność i miejsce w karuzeli zależą też od filtrów (miasto, data, kategoria, promień), które wybierze odwiedzający.
          </p>
        </section>

        <section className="legalSection">
          <h2>Jak zamówić</h2>
          <ol>
            {PROMOTION_STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p className="promotionPageActions">
            <Link href="/organizer/events" className="primaryButton">Przejdź do moich wydarzeń</Link>
            <Link href="/register?next=%2Forganizer" className="secondaryButton">Załóż konto organizatora</Link>
          </p>
          <p>
            Masz pytania? Napisz na <a href={buildPromotionQuestionMailto()}>kontakt@mapaimprez.pl</a>.
          </p>
        </section>

        <section className="legalSection">
          <h2>Sprzedawca</h2>
          <p>
            {PROMOTION_SELLER.name}<br />
            {PROMOTION_SELLER.street}, {PROMOTION_SELLER.postalCity}<br />
            NIP: {PROMOTION_SELLER.nip}
          </p>
          <p>
            Szczegółowe warunki, w tym reklamacje i odstąpienie od umowy, opisuje{" "}
            <Link href="/regulamin#platne-polecanie">regulamin płatnego polecania</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
