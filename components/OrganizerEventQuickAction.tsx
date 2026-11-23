"use client";

import { startTransition, useActionState } from "react";
import { organizerCancelEventAction, organizerHideEventAction } from "@/lib/organizer-events";
import { initialOrganizerEventActionState } from "@/lib/organizer-event-action-state";

type OrganizerEventQuickActionProps = {
  eventId: string;
  eventTitle: string;
  intent: "hide" | "cancel";
  available: boolean;
};

export default function OrganizerEventQuickAction({ eventId, eventTitle, intent, available }: OrganizerEventQuickActionProps) {
  const isCancellation = intent === "cancel";
  const action = isCancellation ? organizerCancelEventAction : organizerHideEventAction;
  const [state, formAction, pending] = useActionState(action.bind(null, eventId), initialOrganizerEventActionState);
  const label = isCancellation ? "Anuluj" : "Ukryj";

  function confirmCancellation() {
    if (confirm(`Czy chcesz anulować wydarzenie „${eventTitle}”? Zostanie ono przeniesione do archiwum.`)) {
      startTransition(() => formAction());
    }
  }

  if (!available && !state.error && !state.success) return null;

  return (
    <form action={formAction} aria-busy={pending} className="organizerEventQuickAction">
      {available ? (
        <button
          type={isCancellation ? "button" : "submit"}
          disabled={pending}
          aria-label={`${label} wydarzenie ${eventTitle}`}
          onClick={isCancellation ? confirmCancellation : undefined}
        >
          {pending ? "Zapisywanie…" : label}
        </button>
      ) : null}
      {state.error ? <p className="formError" role="alert">{state.error}</p> : null}
      {state.success ? <p className="formSuccess" role="status">{state.success}</p> : null}
    </form>
  );
}
