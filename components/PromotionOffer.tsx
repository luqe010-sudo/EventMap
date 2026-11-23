import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  PROMOTION_DURATION_LABEL,
  PROMOTION_PAGE_PATH,
  PROMOTION_PRICE_LABEL
} from "@/lib/promotion";

type Props = {
  variant: "organizer" | "viewer";
  action?: React.ReactNode;
};

// Compact offer box shown in the organizer and viewer panels.
export default function PromotionOffer({ variant, action }: Props) {
  return (
    <section className="managementPanel promotionOffer" aria-labelledby={`promotion-offer-${variant}`}>
      <div className="promotionOfferIcon" aria-hidden="true"><Sparkles size={22} /></div>
      <div className="promotionOfferBody">
        <p className="eyebrow">Płatne polecanie</p>
        <h2 id={`promotion-offer-${variant}`}>
          {variant === "organizer" ? "Wyróżnij swoje wydarzenie" : "Organizujesz wydarzenie? Wyróżnij je"}
          {" "}<span className="promotionPrice">{PROMOTION_PRICE_LABEL}</span>
        </h2>
        <p>
          Polecane wydarzenie trafia do karuzeli „Polecane wydarzenia” nad listą wyników i dostaje oznaczenie „Promowane”.
          Wyróżnienie trwa {PROMOTION_DURATION_LABEL}. Sprzedawca zwolniony z VAT – cena jest ceną końcową.
        </p>
        {variant === "organizer" ? (
          <p className="panelMutedText">Zamówisz je przyciskiem „Zamów polecenie” na liście swoich wydarzeń.</p>
        ) : (
          <p className="panelMutedText">Najpierw załóż konto organizatora i dodaj wydarzenie – dodanie jest bezpłatne.</p>
        )}
        <div className="promotionOfferActions">
          {action}
          <Link href={PROMOTION_PAGE_PATH} className="secondaryButton">Jak to działa</Link>
        </div>
      </div>
    </section>
  );
}
