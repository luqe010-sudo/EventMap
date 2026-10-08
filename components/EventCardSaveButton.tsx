"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleSavedEventAction } from "@/lib/user-account-actions";

type SavedEventsSnapshot = {
  isLoggedIn: boolean | null;
  eventIds: string[];
  error?: string;
};

let cachedSnapshot: SavedEventsSnapshot | null = null;
let snapshotRequest: Promise<SavedEventsSnapshot> | null = null;
let cachedAt = 0;

type EventCardSaveButtonProps = {
  eventId: string;
  returnTo: string;
  className?: string;
  iconSize?: number;
};

export default function EventCardSaveButton({
  eventId,
  returnTo,
  className = "eventCardHFav",
  iconSize = 18
}: EventCardSaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void loadSavedEventsSnapshot().then((snapshot) => {
      if (!active) return;
      setIsLoggedIn(snapshot.isLoggedIn);
      setSaved(snapshot.eventIds.includes(eventId));
      setError(snapshot.error ?? "");
    });

    function handleSavedEvent(event: Event) {
      const detail = (event as CustomEvent<{ eventId: string; saved: boolean }>).detail;
      if (detail?.eventId === eventId) { setSaved(detail.saved); setError(""); }
    }
    window.addEventListener("eventmap:saved-event", handleSavedEvent);
    return () => {
      active = false;
      window.removeEventListener("eventmap:saved-event", handleSavedEvent);
    };
  }, [eventId]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isLoggedIn === false) {
      window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (isLoggedIn === null) {
      if (error) startTransition(async () => {
        const snapshot = await loadSavedEventsSnapshot();
        setIsLoggedIn(snapshot.isLoggedIn);
        setSaved(snapshot.eventIds.includes(eventId));
        setError(snapshot.error ?? "");
      });
      return;
    }

    const nextSaved = !saved;
    setError("");
    startTransition(async () => {
      const result = await toggleSavedEventAction(eventId, nextSaved);
      if (result.requiresLogin) {
        window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (result.error) { setError(result.error); return; }
      updateCachedSnapshot(eventId, result.saved);
      window.dispatchEvent(new CustomEvent("eventmap:saved-event", {
        detail: { eventId, saved: result.saved }
      }));
    });
  }

  return (
    <><button
      type="button"
      className={`${className}${saved ? ` ${className}Active eventCardHFavActive` : ""}`}
      onClick={handleClick}
      aria-label={isLoggedIn === null && error ? "Ponów sprawdzenie zapisanych wydarzeń" : saved ? "Usuń z zapisanych" : "Zapisz wydarzenie"}
      aria-pressed={saved}
      disabled={pending || (isLoggedIn === null && !error)}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>{error ? <span className="eventCardSaveFeedback" role="alert">{error}</span> : null}</>
  );
}

async function loadSavedEventsSnapshot() {
  if (cachedSnapshot && !cachedSnapshot.error && Date.now() - cachedAt < 2_000) return cachedSnapshot;
  if (!snapshotRequest) {
    snapshotRequest = fetch("/api/account/saved-events", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved events request failed");
        return response.json() as Promise<SavedEventsSnapshot>;
      })
      .catch(() => ({ isLoggedIn: null, eventIds: [], error: "Nie udało się sprawdzić zapisów. Naciśnij serce, aby spróbować ponownie." }));
  }
  cachedSnapshot = await snapshotRequest;
  cachedAt = Date.now();
  snapshotRequest = null;
  return cachedSnapshot;
}

function updateCachedSnapshot(eventId: string, saved: boolean) {
  if (!cachedSnapshot) return;
  const eventIds = new Set(cachedSnapshot.eventIds);
  if (saved) eventIds.add(eventId);
  else eventIds.delete(eventId);
  cachedSnapshot = { ...cachedSnapshot, eventIds: Array.from(eventIds) };
  cachedAt = Date.now();
}
