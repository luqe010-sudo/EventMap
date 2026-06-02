"use client";

import { useEffect, useState } from "react";

type EventDetailActionsProps = {
  eventId: string;
  title: string;
  url: string;
};

const STORAGE_KEY = "eventmap.savedEvents";

export default function EventDetailActions({ eventId, title, url }: EventDetailActionsProps) {
  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    setSaved(readSavedEvents().includes(eventId));
  }, [eventId]);

  async function handleShare() {
    setShareStatus("");

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareStatus("Skopiowano link");
    } catch {
      setShareStatus("Nie udalo sie udostepnic");
    }
  }

  function handleSave() {
    const savedEvents = readSavedEvents();
    const nextSaved = savedEvents.includes(eventId)
      ? savedEvents.filter((id) => id !== eventId)
      : [...savedEvents, eventId];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved));
    setSaved(nextSaved.includes(eventId));
  }

  return (
    <div className="eventDetailActionsBar">
      <button type="button" className="eventDetailIconButton" onClick={handleShare}>
        Udostepnij
      </button>
      <button
        type="button"
        className={`eventDetailIconButton ${saved ? "eventDetailIconButtonActive" : ""}`}
        onClick={handleSave}
        aria-pressed={saved}
      >
        {saved ? "Zapisano" : "Zapisz"}
      </button>
      {shareStatus ? <span className="eventDetailShareStatus">{shareStatus}</span> : null}
    </div>
  );
}

function readSavedEvents() {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
