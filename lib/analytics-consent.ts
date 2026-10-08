import { ANALYTICS_SESSION_KEY } from "@/lib/event-analytics-contract";

export const ANALYTICS_CONSENT_KEY = "eventmap.cookieConsent";
export const ANALYTICS_CONSENT_EVENT = "eventmap:analytics-consent";
export type AnalyticsConsentValue = "accepted" | "rejected";
let storageFailureChoice: AnalyticsConsentValue | null | undefined;

export function readAnalyticsConsent(): AnalyticsConsentValue | null {
  if (typeof window === "undefined") return null;
  if (storageFailureChoice !== undefined) return storageFailureChoice;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch { return null; }
}

export function clearAnalyticsSession(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(ANALYTICS_SESSION_KEY); } catch { /* Storage can be disabled. */ }
}

export function saveAnalyticsConsent(value: AnalyticsConsentValue): AnalyticsConsentValue | null {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    storageFailureChoice = undefined;
  } catch {
    // A failed rejection write must still stop tracking in this tab immediately.
    storageFailureChoice = value === "rejected" ? "rejected" : null;
  }
  const stored = readAnalyticsConsent();
  if (stored !== "accepted") clearAnalyticsSession();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  return stored;
}

export function subscribeAnalyticsConsent(listener: () => void): () => void {
  const onChange = () => {
    if (readAnalyticsConsent() !== "accepted") clearAnalyticsSession();
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage) return;
    if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) {
      storageFailureChoice = undefined;
      onChange();
    }
  };
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
