import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", () => ({ useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect) }));

const eventId = "11111111-1111-4111-8111-111111111111";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    values
  };
}
let local: ReturnType<typeof storage>;
let session: ReturnType<typeof storage>;
let target: EventTarget;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  hooks.effects.length = 0;
  local = storage(); session = storage(); target = new EventTarget();
  vi.stubGlobal("window", Object.assign(target, { localStorage: local, sessionStorage: session }));
  fetchMock = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("analytics browser choice", () => {
  it.each([null, "rejected", "corrupt"])("sends no data or new ID before accepted consent (%s)", async (choice) => {
    if (choice) local.values.set("eventmap.cookieConsent", choice);
    session.values.set("eventmap.analyticsSessionId", "old");
    const { trackEventAnalytics } = await import("@/components/EventAnalyticsTracker");
    trackEventAnalytics(eventId, "view");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.setItem).not.toHaveBeenCalled();
    expect(session.values.size).toBe(0);
  });

  it("creates a UUID only after acceptance and sends no cookies or account ID", async () => {
    local.values.set("eventmap.cookieConsent", "accepted");
    session.values.set("eventmap.analyticsSessionId", "legacy-invalid-value");
    const { trackEventAnalytics } = await import("@/components/EventAnalyticsTracker");
    trackEventAnalytics(eventId, "view");
    trackEventAnalytics(eventId, "share_click");
    expect(session.setItem).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe("omit");
    expect(options.keepalive).toBe(true);
    expect(JSON.parse(options.body)).toEqual({ eventType: "view", analyticsConsent: true, sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).sessionId).toBe(JSON.parse(options.body).sessionId);
  });

  it("stops immediately and deletes the session even if rejecting consent cannot persist", async () => {
    local.values.set("eventmap.cookieConsent", "accepted");
    const { trackEventAnalytics } = await import("@/components/EventAnalyticsTracker");
    const { saveAnalyticsConsent, readAnalyticsConsent } = await import("@/lib/analytics-consent");
    trackEventAnalytics(eventId, "view");
    local.setItem.mockImplementation(() => { throw new Error("storage blocked"); });
    expect(saveAnalyticsConsent("rejected")).toBe("rejected");
    expect(readAnalyticsConsent()).toBe("rejected");
    trackEventAnalytics(eventId, "share_click");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(session.values.size).toBe(0);
  });

  it("fails closed when accepting consent or creating the session cannot persist", async () => {
    const { saveAnalyticsConsent } = await import("@/lib/analytics-consent");
    const { trackEventAnalytics } = await import("@/components/EventAnalyticsTracker");
    local.setItem.mockImplementation(() => { throw new Error("blocked"); });
    expect(saveAnalyticsConsent("accepted")).toBeNull();
    trackEventAnalytics(eventId, "view");
    expect(fetchMock).not.toHaveBeenCalled();
    local.setItem.mockImplementation((key, value) => { local.values.set(key, value); });
    saveAnalyticsConsent("accepted");
    session.setItem.mockImplementation(() => { throw new Error("blocked"); });
    trackEventAnalytics(eventId, "view");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("observes acceptance on an already open detail and unsubscribes after leaving", async () => {
    const { default: Tracker } = await import("@/components/EventAnalyticsTracker");
    const { saveAnalyticsConsent } = await import("@/lib/analytics-consent");
    Tracker({ eventId });
    const cleanup = hooks.effects[0]();
    expect(fetchMock).not.toHaveBeenCalled();
    saveAnalyticsConsent("accepted");
    expect(fetchMock).toHaveBeenCalledOnce();
    saveAnalyticsConsent("rejected");
    expect(fetchMock).toHaveBeenCalledOnce();
    if (typeof cleanup !== "function") throw new Error("Missing unsubscribe");
    cleanup();
    saveAnalyticsConsent("accepted");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("observes rejection from another tab and ignores unrelated preferences", async () => {
    local.values.set("eventmap.cookieConsent", "accepted");
    session.values.set("eventmap.analyticsSessionId", "old");
    const { subscribeAnalyticsConsent } = await import("@/lib/analytics-consent");
    const listener = vi.fn();
    const unsubscribe = subscribeAnalyticsConsent(listener);
    const unrelated = Object.assign(new Event("storage"), { key: "theme", storageArea: window.localStorage });
    target.dispatchEvent(unrelated);
    expect(listener).not.toHaveBeenCalled();
    local.values.set("eventmap.cookieConsent", "rejected");
    target.dispatchEvent(Object.assign(new Event("storage"), { key: "eventmap.cookieConsent", storageArea: window.localStorage }));
    expect(listener).toHaveBeenCalledOnce();
    expect(session.values.size).toBe(0);
    unsubscribe();
  });

  it("does not resurrect stale acceptance on a sessionStorage clear after a failed rejection", async () => {
    local.values.set("eventmap.cookieConsent", "accepted");
    const { saveAnalyticsConsent, subscribeAnalyticsConsent, readAnalyticsConsent } = await import("@/lib/analytics-consent");
    const listener = vi.fn();
    const unsubscribe = subscribeAnalyticsConsent(listener);
    local.setItem.mockImplementation(() => { throw new Error("blocked"); });
    saveAnalyticsConsent("rejected");
    listener.mockClear();
    target.dispatchEvent(Object.assign(new Event("storage"), { key: null, storageArea: window.sessionStorage }));
    expect(listener).not.toHaveBeenCalled();
    expect(readAnalyticsConsent()).toBe("rejected");
    unsubscribe();
  });

  it("does not retry uncertain transport failures via beacon", async () => {
    local.values.set("eventmap.cookieConsent", "accepted");
    const beacon = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    fetchMock.mockRejectedValue(new Error("response lost"));
    const { trackEventAnalytics } = await import("@/components/EventAnalyticsTracker");
    trackEventAnalytics(eventId, "view");
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(beacon).not.toHaveBeenCalled();
  });
});
