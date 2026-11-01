"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type DeleteLocationButtonProps = {
  deleteAction: () => Promise<void>;
  locationName: string;
};

export default function DeleteLocationButton({
  deleteAction,
  locationName
}: DeleteLocationButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`Czy na pewno chcesz usunąć lokalizację "${locationName}"?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteAction();
        router.refresh();
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Wystąpił błąd podczas usuwania lokalizacji.";
        alert(message);
      }
    });
  }

  return (
    <button
      type="button"
      className="dangerButton"
      disabled={pending}
      onClick={onClick}
      title={`Usuń lokalizację ${locationName}`}
    >
      {pending ? "Usuwam..." : "Usuń"}
    </button>
  );
}
