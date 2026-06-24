"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { trackEventAnalytics } from "@/components/EventAnalyticsTracker";
import { toggleSavedEventAction } from "@/lib/user-account-actions";

/* ================================================================
   Hero CTA area — ticket link + share button
   ================================================================ */

type HeroCtaProps = {
  eventId: string;
  title: string;
  url: string;
  ticketUrl?: string;
  hideTicketLink?: boolean;
};

export default function EventHeroCta({
  eventId,
  title,
  url,
  ticketUrl,
  hideTicketLink = false,
}: HeroCtaProps) {
  const [shareStatus, setShareStatus] = useState("");

  async function handleShare() {
    setShareStatus("");
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        trackEventAnalytics(eventId, "share_click");
        return;
      }
      await navigator.clipboard.writeText(url);
      trackEventAnalytics(eventId, "share_click");
      setShareStatus("Skopiowano link!");
    } catch {
      setShareStatus("Nie udało się udostępnić");
    }
  }

  return (
    <div className="edHeroCta">
      {ticketUrl && !hideTicketLink ? (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="edTicketBtn"
          onClick={() => trackEventAnalytics(eventId, "ticket_click")}
        >
          Zobacz bilety / strona wydarzenia
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      ) : null}
      <button type="button" className="edShareBtn" onClick={handleShare}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Udostępnij
      </button>
      {shareStatus ? (
        <span className="edShareStatus">{shareStatus}</span>
      ) : null}
    </div>
  );
}

/* ================================================================
   Save / Like button (placed under hero image)
   ================================================================ */

type SaveButtonProps = {
  eventId: string;
  initialSaved?: boolean;
  isLoggedIn?: boolean;
  returnTo: string;
};

export function EventSaveButton({ eventId, initialSaved, isLoggedIn, returnTo }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [resolvedLoggedIn, setResolvedLoggedIn] = useState<boolean | null>(isLoggedIn ?? null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    setError("");

    if (typeof isLoggedIn === "boolean") {
      setResolvedLoggedIn(isLoggedIn);
      setSaved(initialSaved ?? false);
    } else {
      setResolvedLoggedIn(null);
      void fetch("/api/account/saved-events", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Saved events request failed");
          return response.json() as Promise<{ isLoggedIn: boolean; eventIds: string[] }>;
        })
        .then((snapshot) => {
          if (!active) return;
          setResolvedLoggedIn(snapshot.isLoggedIn);
          setSaved(snapshot.eventIds.includes(eventId));
        })
        .catch(() => {
          if (!active) return;
          setResolvedLoggedIn(false);
          setSaved(false);
        });
    }

    function handleSavedEvent(event: Event) {
      const detail = (event as CustomEvent<{ eventId: string; saved: boolean }>).detail;
      if (detail?.eventId === eventId) setSaved(detail.saved);
    }

    window.addEventListener("eventmap:saved-event", handleSavedEvent);
    return () => {
      active = false;
      window.removeEventListener("eventmap:saved-event", handleSavedEvent);
    };
  }, [eventId, initialSaved, isLoggedIn]);

  if (resolvedLoggedIn === null) {
    return (
      <button type="button" className="edSaveBtn" disabled>
        <HeartIcon filled={false} />
        Sprawdzam zapis…
      </button>
    );
  }

  if (!resolvedLoggedIn) {
    return (
      <Link className="edSaveBtn" href={`/login?next=${encodeURIComponent(returnTo)}`}>
        <HeartIcon filled={false} />
        Zaloguj się, aby zapisać
      </Link>
    );
  }

  function handleSave() {
    const nextSaved = !saved;
    setError("");
    startTransition(async () => {
      const result = await toggleSavedEventAction(eventId, nextSaved);
      if (result.requiresLogin) {
        window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(result.saved);
      window.dispatchEvent(new CustomEvent("eventmap:saved-event", {
        detail: { eventId, saved: result.saved }
      }));
      if (result.saved) trackEventAnalytics(eventId, "save_click");
    });
  }

  return (
    <div className="eventSaveControl">
      <button
        type="button"
        className={`edSaveBtn ${saved ? "edSaveBtnActive" : ""}`}
        onClick={handleSave}
        aria-pressed={saved}
        disabled={pending}
      >
        <HeartIcon filled={saved} />
        {pending ? "Zapisywanie..." : saved ? "Zapisano" : "Zapisz"}
      </button>
      {error ? <span className="eventSaveError" role="alert">{error}</span> : null}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
