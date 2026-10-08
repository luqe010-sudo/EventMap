"use client";

import { useActionState } from "react";
import { organizerCancelEventAction, organizerHideEventAction } from "@/lib/organizer-events";
import { initialOrganizerEventActionState } from "@/lib/organizer-event-action-state";

export default function OrganizerEventQuickAction({ eventId, intent }: { eventId: string; intent: "hide" | "cancel" }) {
  const action = intent === "hide" ? organizerHideEventAction : organizerCancelEventAction;
  const [state, formAction, pending] = useActionState(action.bind(null, eventId), initialOrganizerEventActionState);

  return (
    <form action={formAction} aria-busy={pending} className="organizerEventQuickAction">
      <button type="submit" disabled={pending}>
        {pending ? "Zapisywanie…" : intent === "hide" ? "Ukryj" : "Anuluj"}
      </button>
      {state.error ? <p className="formError" role="alert">{state.error}</p> : null}
      {state.success ? <p className="formSuccess" role="status">{state.success}</p> : null}
    </form>
  );
}
