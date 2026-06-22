"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  completeGoogleOnboardingAction,
  type GoogleOnboardingFormState
} from "@/lib/auth-actions";

const initialState: GoogleOnboardingFormState = { error: null };

export default function GoogleOnboardingForm() {
  const [role, setRole] = useState<"user" | "organizer">("user");
  const [state, formAction, pending] = useActionState(completeGoogleOnboardingAction, initialState);

  return (
    <form action={formAction} className="managementForm">
      {state.error ? (
        <div className="formError" role="alert">
          {state.error}
        </div>
      ) : null}

      <label>
        Typ konta (Rola)
        <select
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value === "organizer" ? "organizer" : "user")}
        >
          <option value="user">Chcę przeglądać wydarzenia (Widz)</option>
          <option value="organizer">Chcę publikować wydarzenia (Organizator)</option>
        </select>
      </label>

      {role === "organizer" ? (
        <label>
          Nazwa organizacji / firmy
          <input name="organizerName" type="text" placeholder="Domyślnie nazwa konta Google" />
        </label>
      ) : null}

      <label className="checkboxLabel legalConsentCheckbox">
        <input name="termsAccepted" type="checkbox" required />
        <span>
          Akceptuję{" "}
          <Link href="/regulamin" target="_blank">
            regulamin serwisu
          </Link>
          .
        </span>
      </label>

      <label className="checkboxLabel legalConsentCheckbox">
        <input name="privacyNoticeAccepted" type="checkbox" required />
        <span>
          Potwierdzam, że zapoznałem/zapoznałam się z{" "}
          <Link href="/regulamin#polityka-prywatnosci" target="_blank">
            polityką prywatności / RODO
          </Link>{" "}
          oraz{" "}
          <Link href="/regulamin#polityka-cookies" target="_blank">
            polityką cookies
          </Link>
          .
        </span>
      </label>

      <button type="submit" className="primaryButton" disabled={pending}>
        {pending ? "Tworzenie profilu..." : "Utwórz konto"}
      </button>
    </form>
  );
}
