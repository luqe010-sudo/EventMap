"use client";

import { useActionState } from "react";
import {
  updateUserProfileAction,
  type UserProfileFormState
} from "@/lib/user-account-actions";

const initialState: UserProfileFormState = { error: null, success: null };

export default function UserProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState(updateUserProfileAction, initialState);

  return (
    <form action={formAction} className="managementForm">
      {state.error ? <div className="formError" role="alert">{state.error}</div> : null}
      {state.success ? <div className="formSuccess" role="status">{state.success}</div> : null}
      <label>
        Nazwa użytkownika
        <input
          name="display_name"
          type="text"
          minLength={2}
          maxLength={160}
          required
          defaultValue={displayName}
          autoComplete="name"
        />
      </label>
      <p className="formHint">Ta nazwa jest widoczna w menu konta i panelach serwisu.</p>
      <button type="submit" className="primaryButton" disabled={pending}>
        {pending ? "Zapisywanie..." : "Zapisz nazwę"}
      </button>
    </form>
  );
}
