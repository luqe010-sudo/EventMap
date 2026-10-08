import { unstable_rethrow } from "next/navigation";
import type { EventEditorState } from "@/lib/event-editor-validation";

type EditorScope = "admin" | "organizer";

function saveIssue(scope: EditorScope, eventId: string, kind: "partial" | "unconfirmed") {
  return {
    kind,
    editHref: `/${scope}/events/${encodeURIComponent(eventId)}/edit`,
    listHref: `/${scope}/events`
  };
}

/** A transport error can arrive after COMMIT. Never promise that nothing was saved. */
export function eventWriteFailure(error: unknown, scope: EditorScope, eventId: string): EventEditorState {
  unstable_rethrow(error);
  console.error("[event-editor] Event write was not confirmed", error);
  return {
    fieldErrors: {},
    error: "Nie udało się potwierdzić zapisu wydarzenia. Sprawdź wydarzenie lub listę w nowej karcie przed kolejną próbą, aby uniknąć duplikatu. Dane pozostają w tym formularzu.",
    saveIssue: saveIssue(scope, eventId, "unconfirmed")
  };
}

/** Independent followups must all be attempted, even when one of them fails. */
export async function completeEventWrite(
  scope: EditorScope,
  eventId: string,
  followups: Array<{ label: string; run: () => Promise<void> }>
): Promise<EventEditorState | null> {
  const failed: string[] = [];
  for (const followup of followups) {
    try {
      await followup.run();
    } catch (error) {
      unstable_rethrow(error);
      console.error(`[event-editor] Failed to complete ${followup.label}`, error);
      failed.push(followup.label);
    }
  }
  if (!failed.length) return null;
  return {
    fieldErrors: {},
    error: `Wydarzenie zostało zapisane, ale nie udało się potwierdzić zapisu: ${failed.join("; ")}. Otwórz zapisane wydarzenie w nowej karcie i sprawdź brakujące dane. Dane pozostają w tym formularzu.${failed.some(label => label.includes("moderacji")) ? " Historia moderacji i powiadomienia wymagają sprawdzenia przez administratora." : ""}`,
    saveIssue: saveIssue(scope, eventId, "partial")
  };
}
