import { formString, normalizeDateTimeLocal, toDateTimeLocal } from "./event-editor";

export type EventFieldErrors = Partial<Record<string, string>>;
export type EventEditorState = {
  fieldErrors: EventFieldErrors;
  error: string | null;
  saveIssue?: {
    kind: "partial" | "unconfirmed";
    editHref: string;
    listHref: string;
  };
};

export const eventTextLimits = {
  title: 300, slug: 300, short_description: 500, description: 30000,
  review_note: 4000, source_name: 300, source_type: 80,
  main_image_url: 2048, source_url: 2048,
  location_name: 300, location_city: 200, location_address: 500,
  location_postal_code: 20, location_county: 200, location_voivodeship: 200, location_municipality: 200
} as const;

export class EventValidationError extends Error {
  constructor(public readonly fieldErrors: EventFieldErrors) {
    super("Popraw zaznaczone pola formularza.");
    this.name = "EventValidationError";
  }
}

export function eventValidationState(error: unknown): EventEditorState {
  if (!(error instanceof EventValidationError)) throw error;
  return { fieldErrors: error.fieldErrors, error: error.message };
}

/** Validate the entire form before uploads or location/source writes. */
export function validateEventForm(formData: FormData, organizerId: string) {
  const errors: EventFieldErrors = {};
  for (const [field, limit] of Object.entries(eventTextLimits)) {
    const value = formString(formData, field);
    if (value && value.length > limit) errors[field] = `Maksymalna długość: ${limit} znaków.`;
  }
  if (!formString(formData, "title")) errors.title = "Podaj tytuł wydarzenia.";
  if (!formString(formData, "category_id")) errors.category_id = "Wybierz kategorię.";
  if (!organizerId) errors.organizer_id = "Wybierz organizatora.";

  const startAt = readDate(formData, "start_at", errors, true);
  const endAt = readDate(formData, "end_at", errors, false);
  if (startAt && endAt && endAt < startAt) errors.end_at = "Koniec nie może być wcześniejszy niż rozpoczęcie.";

  const priceMin = readNumber(formData, "price_min", errors, 0);
  const priceMax = readNumber(formData, "price_max", errors, 0);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) errors.price_max = "Cena maksymalna nie może być niższa od minimalnej.";
  const priceType = formString(formData, "price_type");
  if (priceType && !["free", "paid", "donation"].includes(priceType)) errors.price_type = "Wybierz poprawny typ ceny.";
  if (priceType === "free" && ((priceMin ?? 0) > 0 || (priceMax ?? 0) > 0)) errors.price_type = "Wydarzenie bezpłatne nie może mieć dodatniej ceny.";
  const currency = formString(formData, "currency") ?? "PLN";
  if (!/^[A-Za-z]{3}$/.test(currency)) errors.currency = "Podaj trzyliterowy kod waluty, np. PLN.";

  const latitude = readNumber(formData, "location_latitude", errors, -90, 90);
  const longitude = readNumber(formData, "location_longitude", errors, -180, 180);
  if ((latitude === null) !== (longitude === null)) {
    const field = latitude === null ? "location_latitude" : "location_longitude";
    errors[field] ??= "Wybierz punkt na mapie z obiema współrzędnymi.";
  }

  for (const field of ["main_image_url", "source_url"]) validateEventUrl(formString(formData, field), field, errors);
  const image = formData.get("main_image_file");
  if (image && typeof image !== "string" && image.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(image.type)) errors.main_image_file = "Wybierz obraz JPG, PNG, WebP, GIF albo AVIF.";
    if (image.size > 5 * 1024 * 1024) errors.main_image_file = "Obraz może mieć maksymalnie 5 MB.";
  }
  if (Object.keys(errors).length) throw new EventValidationError(errors);
  return { startAt: startAt!, endAt, priceMin, priceMax, priceType, currency: currency.toUpperCase(), latitude, longitude };
}

export function validateEventUrl(value: string | null, field: string, errors: EventFieldErrors) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
  } catch { errors[field] = "Podaj pełny adres http:// lub https:// bez danych logowania."; }
}

function readNumber(formData: FormData, field: string, errors: EventFieldErrors, min: number, max = Number.MAX_VALUE) {
  const value = formString(formData, field);
  if (!value) return null;
  const parsed = Number(value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    errors[field] = max === Number.MAX_VALUE ? "Podaj poprawną liczbę nie mniejszą niż 0." : `Podaj liczbę od ${min} do ${max}.`;
    return null;
  }
  return parsed;
}

function readDate(formData: FormData, field: string, errors: EventFieldErrors, required: boolean) {
  const value = formString(formData, field);
  if (!value) {
    if (required) errors[field] = "Podaj datę rozpoczęcia.";
    return null;
  }
  // datetime-local values are Warsaw wall time. The round trip rejects overflow
  // calendar dates and the nonexistent hour at the spring DST transition.
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  let iso: string | null = null;
  try { iso = match ? normalizeDateTimeLocal(value) : null; } catch { /* Invalid date fields. */ }
  if (!match || !iso || Number(match[3] ?? 0) > 59 || toDateTimeLocal(iso) !== `${match[1]}T${match[2]}`) {
    errors[field] = "Podaj poprawną datę i godzinę w strefie Europe/Warsaw.";
    return null;
  }
  return iso;
}
