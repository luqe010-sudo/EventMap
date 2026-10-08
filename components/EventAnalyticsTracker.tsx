"use client";

import type React from "react";
import { useEffect } from "react";
import { clearAnalyticsSession, readAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics-consent";
import { ANALYTICS_SESSION_KEY, isAnalyticsUuid, type EventAnalyticsType } from "@/lib/event-analytics-contract";

type TrackedEventLinkProps = {
  eventId: string;
  eventType: EventAnalyticsType;
  href: string;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
};

export default function EventAnalyticsTracker({ eventId }: { eventId: string }) {
  useEffect(() => {
    const recordView = () => trackEventAnalytics(eventId, "view");
    recordView();
    return subscribeAnalyticsConsent(recordView);
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
  if (typeof window === "undefined" || readAnalyticsConsent() !== "accepted") {
    clearAnalyticsSession();
    return;
  }
  if (!isAnalyticsUuid(eventId)) return;
  const sessionId = getAnalyticsSessionId();
  if (!sessionId) return;
  const payload = JSON.stringify({
    eventType,
    sessionId,
    analyticsConsent: true
  });

  const url = `/api/events/${eventId}/analytics`;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "omit"
  }).catch(() => { /* Measurement must not interrupt navigation or retry an uncertain write. */ });
}

function getAnalyticsSessionId() {
  try {
    const existing = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    if (isAnalyticsUuid(existing)) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, next);
    return next;
  } catch {
    return null;
  }
}
