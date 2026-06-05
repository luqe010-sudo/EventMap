"use client";

import type React from "react";
import { useEffect } from "react";

type EventAnalyticsType =
  | "view"
  | "phone_click"
  | "website_click"
  | "ticket_click"
  | "map_click"
  | "share_click"
  | "save_click";

type TrackedEventLinkProps = {
  eventId: string;
  eventType: EventAnalyticsType;
  href: string;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
};

const SESSION_STORAGE_KEY = "eventmap.analyticsSessionId";

export default function EventAnalyticsTracker({ eventId }: { eventId: string }) {
  useEffect(() => {
    trackEventAnalytics(eventId, "view");
  }, [eventId]);

  return null;
}

export function TrackedEventLink({
  eventId,
  eventType,
  href,
  className,
  children,
  target,
  rel
}: TrackedEventLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={className}
      onClick={() => trackEventAnalytics(eventId, eventType)}
    >
      {children}
    </a>
  );
}

export function trackEventAnalytics(eventId: string, eventType: EventAnalyticsType) {
  const payload = JSON.stringify({
    eventType,
    sessionId: getAnalyticsSessionId()
  });

  const url = `/api/events/${eventId}/analytics`;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {
    if (!navigator.sendBeacon) return;
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(url, blob);
  });
}

function getAnalyticsSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}
