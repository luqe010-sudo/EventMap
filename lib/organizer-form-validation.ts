import type { Database } from "@/database.types";
import { createSlug, formString } from "@/lib/event-editor";

export type OrganizerFormState = {
  fieldErrors: Record<string, string>;
  error: string | null;
  success?: string;
  creationUnconfirmed?: boolean;
};

export class OrganizerFormValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Sprawdź zaznaczone pola.");
    this.name = "OrganizerFormValidationError";
  }
}

export const organizerTextLimits = {
  name: 200, slug: 200, display_name: 200, organizer_name: 200,
  description: 10000, phone: 60, email: 254, type: 100,
  website: 2048, facebook_url: 2048, instagram_url: 2048, logo_url: 2048
} as const;

type Field = keyof typeof organizerTextLimits;

function readField(data: FormData, field: Field, errors: Record<string, string>, required = false) {
  const raw = data.get(field);
  const value = formString(data, field);
  if (raw !== null && typeof raw !== "string") errors[field] = "Wpisz tekst w tym polu.";
  if (required && !value) errors[field] = "Uzupełnij to pole.";
  if (value && value.length > organizerTextLimits[field]) errors[field] = `Wpisz maksymalnie ${organizerTextLimits[field]} znaków.`;
  return value;
}

function rejectErrors(errors: Record<string, string>) {
  if (Object.keys(errors).length) throw new OrganizerFormValidationError(errors);
}

export function validateOrganizerProfileForm(data: FormData): Database["public"]["Tables"]["organizers"]["Update"] {
  const errors: Record<string, string> = {};
  const name = readField(data, "name", errors, true);
  const slugInput = readField(data, "slug", errors);
  const slug = createSlug(slugInput ?? name ?? "");
  if (!slug) errors["slug"] = "Podaj nazwę lub adres profilu zawierający litery albo cyfry.";
  const website = readField(data, "website", errors);
  const facebook = readField(data, "facebook_url", errors);
  const instagram = readField(data, "instagram_url", errors);
  const logo = readField(data, "logo_url", errors);
  for (const [field, value] of [["website", website], ["facebook_url", facebook], ["instagram_url", instagram], ["logo_url", logo]] as const) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /[\u0000-\u001f\u007f]/.test(value)) throw new Error("Invalid URL");
    } catch { errors[field] = "Podaj pełny adres zaczynający się od https:// lub http://."; }
  }
  const phone = readField(data, "phone", errors);
  const email = readField(data, "email", errors);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Podaj poprawny adres e-mail.";
  const type = readField(data, "type", errors);
  const description = readField(data, "description", errors);
  rejectErrors(errors);
  return { name: name!, slug, website, facebook_url: facebook, instagram_url: instagram, phone, email, logo_url: logo, type, description };
}

export function validateOrganizerDisplayName(data: FormData) {
  const errors: Record<string, string> = {};
  const name = readField(data, "display_name", errors, true);
  rejectErrors(errors);
  return name!;
}

export function validateOrganizerAccountName(data: FormData, fallback?: string | null) {
  const errors: Record<string, string> = {};
  const submitted = readField(data, "organizer_name", errors);
  const name = data.has("organizer_name") ? submitted : fallback?.trim() ?? null;
  if (!name) errors.organizer_name = "Podaj nazwę organizatora.";
  if (name && name.length > organizerTextLimits.organizer_name) errors.organizer_name = `Wpisz maksymalnie ${organizerTextLimits.organizer_name} znaków.`;
  if (name && !createSlug(name)) errors.organizer_name = "Nazwa musi zawierać litery albo cyfry.";
  rejectErrors(errors);
  return name!;
}
