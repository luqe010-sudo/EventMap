"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type DeleteEventButtonProps = {
  deleteAction: () => Promise<void>;
  eventTitle: string;
};

export default function DeleteEventButton({ deleteAction, eventTitle }: DeleteEventButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`Czy na pewno chcesz trwale usunąć wydarzenie "${eventTitle}"? Tej operacji nie można cofnąć.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteAction();
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Wystąpił błąd podczas usuwania wydarzenia.");
      }
    });
  }

  return (
    <button type="button" className="dangerButton" disabled={pending} onClick={onClick} title={`Usuń wydarzenie ${eventTitle}`}>
      {pending ? "Usuwam..." : "Usuń"}
    </button>
  );
}
