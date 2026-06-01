"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="appShell">
      <div className="emptyState">
        <h3>Nie udalo sie pobrac wydarzen.</h3>
        <p>{error.message}</p>
        <button type="button" className="primaryButton" onClick={reset}>
          Sprobuj ponownie
        </button>
      </div>
    </main>
  );
}
