import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeEventWrite, eventWriteFailure } from "../lib/event-save-feedback";

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("event save feedback", () => {
  it("does not disclose provider details or promise rollback for an uncertain write", () => {
    const result = eventWriteFailure(new Error("Sensitive database transport detail"), "admin", "event-a");
    expect(result.error).toContain("potwierdzić zapisu");
    expect(result.error).not.toContain("Sensitive");
    expect(result.saveIssue).toEqual({ kind: "unconfirmed", editHref: "/admin/events/event-a/edit", listHref: "/admin/events" });
  });
  it("passes framework redirect signals through both error paths", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    expect(() => eventWriteFailure(redirect, "organizer", "event-a")).toThrow(redirect);
    const nextStep = vi.fn(async () => {});
    await expect(completeEventWrite("organizer", "event-a", [
      { label: "źródła", run: async () => { throw redirect; } },
      { label: "moderacji", run: nextStep }
    ])).rejects.toThrow(redirect);
    expect(nextStep).not.toHaveBeenCalled();
  });
  it("attempts every independent followup and reports all failures after the event was saved", async () => {
    const completed: string[] = [];
    const result = await completeEventWrite("admin", "event-a", [
      { label: "źródła", run: async () => { completed.push("source"); throw new Error("Sensitive source detail"); } },
      { label: "historii", run: async () => { completed.push("history"); } },
      { label: "powiadomień", run: async () => { completed.push("notifications"); throw new Error("Sensitive notification detail"); } }
    ]);
    expect(completed).toEqual(["source", "history", "notifications"]);
    expect(result?.saveIssue).toEqual({ kind: "partial", editHref: "/admin/events/event-a/edit", listHref: "/admin/events" });
    expect(result?.error).toContain("Wydarzenie zostało zapisane");
    expect(result?.error).toContain("źródła; powiadomień");
    expect(result?.error).not.toContain("Sensitive");
  });
  it("returns no error when all followups complete", async () => {
    const source = vi.fn(async () => {});
    const moderation = vi.fn(async () => {});
    expect(await completeEventWrite("organizer", "event-a", [
      { label: "źródła", run: source }, { label: "moderacji", run: moderation }
    ])).toBeNull();
    expect(source).toHaveBeenCalledOnce();
    expect(moderation).toHaveBeenCalledOnce();
  });
});
