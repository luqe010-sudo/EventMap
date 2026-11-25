"use client";

import { CircleAlert } from "lucide-react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="appShell managementShell statusPage">
      <div className="managementPanel statusPanel emptyState">
        <CircleAlert className="statusPageIcon" size={36} strokeWidth={1.7} aria-hidden="true" />
        <h1>Nie udało się pobrać wydarzeń</h1>
        <p>{error.message}</p>
        <button type="button" className="primaryButton" onClick={reset}>
          Spróbuj ponownie
        </button>
      </div>
    </main>
  );
}
