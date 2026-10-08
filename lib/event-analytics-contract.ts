export const EVENT_ANALYTICS_TYPES = [
  "view", "phone_click", "website_click", "ticket_click",
  "map_click", "share_click", "save_click"
] as const;

export type EventAnalyticsType = typeof EVENT_ANALYTICS_TYPES[number];
export const ANALYTICS_SESSION_KEY = "eventmap.analyticsSessionId";
export const ANALYTICS_BODY_LIMIT = 1024;

export function isAnalyticsUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type EventAnalyticsBody = {
  eventType: EventAnalyticsType;
  sessionId: string;
  analyticsConsent: true;
};

export function parseAnalyticsBody(value: unknown): EventAnalyticsBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["eventType", "sessionId", "analyticsConsent"].includes(key))) return null;
  if (body.analyticsConsent !== true || !isAnalyticsUuid(body.sessionId) ||
      !EVENT_ANALYTICS_TYPES.includes(body.eventType as EventAnalyticsType)) return null;
  return { eventType: body.eventType as EventAnalyticsType, sessionId: body.sessionId.toLowerCase(), analyticsConsent: true };
}
