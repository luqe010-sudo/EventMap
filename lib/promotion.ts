// Paid event promotion ("Polecane wydarzenie"). Orders are placed by e-mail and
// paid by bank transfer; after payment the admin enables `events.is_featured`
// and `events.featured_until`. An event is promoted only while both hold
// (see docs/paid-promotion.md).

import { addDaysToDateKey, dateTimeLocalToUtcIso, getDateKeyInAppTimeZone } from "./date-format";

export const PROMOTION_PRICE_PLN = 39;
export const PROMOTION_PRICE_LABEL = "39 zł brutto";
export const PROMOTION_MAX_DAYS = 30;
export const PROMOTION_PAGE_PATH = "/promowanie-wydarzen";
export const PROMOTION_ORDER_EMAIL = "kontakt@mapaimprez.pl";

export const PROMOTION_SELLER = {
  name: "DevilEnergy Łukasz Szypuła",
  nip: "8871744618",
  street: "ul. Zimowa 6/4",
  postalCity: "57-215 Srebrna Góra",
  vatNote: "Sprzedawca jest zwolniony z VAT (zwolnienie podmiotowe) – cena 39 zł jest ceną końcową, nie doliczamy podatku VAT."
} as const;

export const PROMOTION_DURATION_LABEL = `do dnia zakończenia wydarzenia, maksymalnie ${PROMOTION_MAX_DAYS} dni od włączenia`;

export const PROMOTION_BENEFITS = [
  "Miejsce w karuzeli „Polecane wydarzenia” nad listą wyników na stronie głównej, gdy wydarzenie pasuje do filtrów odwiedzającego.",
  "Pierwszeństwo przed niepromowanymi wydarzeniami w tej karuzeli.",
  "Wyraźne oznaczenie „Promowane” na karcie wydarzenia.",
  `Wyróżnienie trwa ${PROMOTION_DURATION_LABEL}.`
] as const;

export const PROMOTION_STEPS = [
  "W panelu organizatora kliknij „Zamów polecenie” przy wybranym wydarzeniu – otworzy się gotowa wiadomość e-mail z danymi wydarzenia.",
  "Uzupełnij dane do rachunku (nazwa, adres, NIP – jeśli dotyczy) i wyślij wiadomość.",
  "Odeślemy rachunek z danymi do przelewu na 39 zł.",
  "Po zaksięgowaniu wpłaty włączymy wyróżnienie – zwykle w ciągu 1 dnia roboczego. Wydarzenie musi być opublikowane."
] as const;

type PromotionWindow = {
  is_featured?: boolean | null;
  featured_until?: string | null;
};

export function isPromotionActive(event: PromotionWindow, now: Date = new Date()) {
  if (!event.is_featured || !event.featured_until) return false;
  const until = Date.parse(event.featured_until);
  return Number.isFinite(until) && until > now.getTime();
}

/** Last second (Europe/Warsaw) of the given YYYY-MM-DD day, as UTC ISO. */
export function endOfAppDayIso(dateKey: string) {
  const nextDayStart = dateTimeLocalToUtcIso(`${addDaysToDateKey(dateKey, 1)}T00:00`);
  if (!nextDayStart) return null;
  return new Date(Date.parse(nextDayStart) - 1000).toISOString();
}

/** Default promotion end: end of the event's last day, capped at 30 days from now. */
export function defaultFeaturedUntil(event: { start_at: string; end_at?: string | null }, now: Date = new Date()) {
  const cap = now.getTime() + PROMOTION_MAX_DAYS * 24 * 60 * 60 * 1000;
  const eventDate = event.end_at ?? event.start_at;
  if (!eventDate || !Number.isFinite(Date.parse(eventDate))) return new Date(cap).toISOString();
  const eventDayEnd = endOfAppDayIso(getDateKeyInAppTimeZone(eventDate));
  const eventEnd = eventDayEnd ? Date.parse(eventDayEnd) : Number.NaN;
  return new Date(Number.isFinite(eventEnd) ? Math.min(eventEnd, cap) : cap).toISOString();
}

/**
 * Resolves featured fields for an admin save. `untilDate` is the optional
 * YYYY-MM-DD value of the "Promowane do" field (end of that day in Poland).
 */
export function resolveFeaturedFields(
  input: { isFeatured: boolean; untilDate: string | null },
  event: { start_at: string; end_at?: string | null },
  now: Date = new Date()
): { is_featured: boolean; featured_until: string | null } {
  if (!input.isFeatured) return { is_featured: false, featured_until: null };
  const fromField = input.untilDate && /^\d{4}-\d{2}-\d{2}$/.test(input.untilDate) ? endOfAppDayIso(input.untilDate) : null;
  return { is_featured: true, featured_until: fromField ?? defaultFeaturedUntil(event, now) };
}

type PromotableEvent = PromotionWindow & {
  status: string | null;
  visibility: string | null;
  is_cancelled: boolean | null;
  start_at: string;
  end_at: string | null;
};

export type PromotionState = "featured" | "available" | "unavailable";

export function getPromotionState(event: PromotableEvent, now: Date = new Date()): PromotionState {
  if (isPromotionActive(event, now)) return "featured";
  if (event.is_cancelled || event.visibility === "private") return "unavailable";
  if (event.status !== "published" && event.status !== "pending_review") return "unavailable";
  const endsAt = Date.parse(event.end_at ?? event.start_at);
  if (!Number.isFinite(endsAt) || endsAt <= now.getTime()) return "unavailable";
  return "available";
}

type OrderEvent = {
  id: string;
  title: string;
  start_at: string;
};

export function buildPromotionOrderMailto(event: OrderEvent, options: { organizerName?: string | null; publicUrl?: string | null } = {}) {
  const subject = `Zamówienie polecenia wydarzenia – ${event.title}`;
  const lines = [
    "Dzień dobry,",
    "",
    `zamawiam płatne polecenie wydarzenia w MapaImprez.pl w cenie ${PROMOTION_PRICE_LABEL}.`,
    "",
    `Wydarzenie: ${event.title}`,
    `ID wydarzenia: ${event.id}`,
    `Termin: ${event.start_at.slice(0, 10)}`,
    options.publicUrl ? `Link: ${options.publicUrl}` : null,
    options.organizerName ? `Organizator: ${options.organizerName}` : null,
    "",
    "Dane do rachunku:",
    "Nazwa / imię i nazwisko: ",
    "Adres: ",
    "NIP (jeśli dotyczy): ",
    "",
    "Akceptuję regulamin płatnego polecania wydarzeń: https://mapaimprez.pl/regulamin#platne-polecanie",
    "",
    "Pozdrawiam"
  ].filter((line): line is string => line !== null);

  return `mailto:${PROMOTION_ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function buildPromotionQuestionMailto() {
  return `mailto:${PROMOTION_ORDER_EMAIL}?subject=${encodeURIComponent("Pytanie o płatne polecanie wydarzeń")}`;
}
