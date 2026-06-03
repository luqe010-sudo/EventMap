"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "eventmap.savedEvents";

/* ================================================================
   Hero CTA area — ticket link + share button
   ================================================================ */

type HeroCtaProps = {
  title: string;
  url: string;
  ticketUrl?: string;
};

export default function EventHeroCta({
  title,
  url,
  ticketUrl,
}: HeroCtaProps) {
  const [shareStatus, setShareStatus] = useState("");

  async function handleShare() {
    setShareStatus("");
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Skopiowano link!");
    } catch {
      setShareStatus("Nie udało się udostępnić");
    }
  }

  return (
    <div className="edHeroCta">
      {ticketUrl ? (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="edTicketBtn"
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
};

export function EventSaveButton({ eventId }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSavedEvents().includes(eventId));
  }, [eventId]);

  function handleSave() {
    const savedEvents = readSavedEvents();
    const nextSaved = savedEvents.includes(eventId)
      ? savedEvents.filter((id) => id !== eventId)
      : [...savedEvents, eventId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved));
    setSaved(nextSaved.includes(eventId));
  }

  return (
    <button
      type="button"
      className={`edSaveBtn ${saved ? "edSaveBtnActive" : ""}`}
      onClick={handleSave}
      aria-pressed={saved}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {saved ? "Zapisano" : "Zapisz"}
    </button>
  );
}

/* ================================================================
   Helpers
   ================================================================ */

function readSavedEvents() {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
