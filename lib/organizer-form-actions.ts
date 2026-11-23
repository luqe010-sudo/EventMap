"use server";

import { unstable_rethrow } from "next/navigation";
import { createOrganizerAccountAction, organizerUpdateAccountAction, organizerUpdateProfileAction } from "@/lib/organizer-events";
import { OrganizerFormValidationError, type OrganizerFormState } from "@/lib/organizer-form-validation";

function formFailure(error: unknown, message: string): OrganizerFormState {
  unstable_rethrow(error);
  if (error instanceof OrganizerFormValidationError) return { fieldErrors: error.fieldErrors, error: error.message };
  console.error("[organizer-form] Save was not confirmed", error);
  return { fieldErrors: {}, error: message };
}

export async function organizerUpdateProfileFormAction(organizerId: string, _previous: OrganizerFormState, data: FormData): Promise<OrganizerFormState> {
  try {
    await organizerUpdateProfileAction(organizerId, data, true);
    return { fieldErrors: {}, error: null, success: "Profil organizatora został zapisany." };
  } catch (error) {
    return formFailure(error, "Nie udało się potwierdzić zapisu profilu organizatora. Wpisane dane pozostały w formularzu. Sprawdź profil w nowej karcie. Jeśli zapis nadal jest niedostępny, skontaktuj się z administratorem.");
  }
}

export async function organizerUpdateAccountFormAction(_previous: OrganizerFormState, data: FormData): Promise<OrganizerFormState> {
  try {
    await organizerUpdateAccountAction(data);
    return { fieldErrors: {}, error: null, success: "Ustawienia konta zostały zapisane." };
  } catch (error) {
    return formFailure(error, "Nie udało się potwierdzić zapisu ustawień konta. Wpisana nazwa pozostała w formularzu. Sprawdź ustawienia w nowej karcie, zanim ponowisz próbę.");
  }
}

export async function createOrganizerAccountFormAction(_previous: OrganizerFormState, data: FormData): Promise<OrganizerFormState> {
  try {
    await createOrganizerAccountAction(data);
    return { fieldErrors: {}, error: null };
  } catch (error) {
    return formFailure(error, "Nie udało się potwierdzić utworzenia profilu organizatora. Możesz sprawdzić panel w nowej karcie lub ponowić próbę. Jeśli problem się powtarza, skontaktuj się z administratorem.");
  }
}
