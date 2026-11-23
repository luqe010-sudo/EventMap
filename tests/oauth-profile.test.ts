import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ensureGoogleOAuthAccount } from "../lib/oauth-profile";
import type { GoogleOAuthRegistration } from "../lib/oauth-state";

const user: User = {
  id: "user-a",
  aud: "authenticated",
  app_metadata: { provider: "google" },
  user_metadata: { full_name: "Jan Kowalski" },
  email: "jan@example.invalid",
  created_at: "2026-10-10T12:00:00Z"
};

const registration: GoogleOAuthRegistration = {
  intent: "register",
  role: "organizer",
  organizerName: "Fundacja Przykład",
  next: "/organizer"
};

function setup(profile: { role: string | null; display_name: string | null } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const is = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ is })) }));
  const from = vi.fn(() => ({ select, upsert, update }));
  const rpc = vi.fn().mockResolvedValue({ data: "581267a2-de6f-4420-b1a9-7d1efb5b21de", error: null });
  const client = { from, rpc } as unknown as Parameters<typeof ensureGoogleOAuthAccount>[0];
  return { client, from, upsert, update, is, rpc };
}

describe("Google organizer provisioning", () => {
  it("initializes an ordinary profile before requesting atomic organizer setup", async () => {
    const { client, from, upsert, update, rpc } = setup(null);
    await ensureGoogleOAuthAccount(client, user, registration);

    expect(upsert).toHaveBeenCalledExactlyOnceWith({ id: user.id, role: "user", display_name: "Jan Kowalski" }, { onConflict: "id", ignoreDuplicates: true });
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("upgrade_my_organizer_account", { p_organizer_name: "Fundacja Przykład" });
    expect(from.mock.calls).toEqual([["profiles"], ["profiles"]]);
    expect(update).not.toHaveBeenCalled();
  });

  it("never changes the organizer role directly if the RPC fails", async () => {
    const { client, from, rpc, update } = setup({ role: "user", display_name: "Jan Kowalski" });
    const error = new Error("Organizer setup denied");
    rpc.mockResolvedValue({ data: null, error });

    await expect(ensureGoogleOAuthAccount(client, user, registration)).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledExactlyOnceWith("profiles");
    expect(update).not.toHaveBeenCalled();
  });

  it("uses the Google display name when no organizer name was entered", async () => {
    const { client, rpc } = setup({ role: "organizer", display_name: "Inna nazwa" });
    await ensureGoogleOAuthAccount(client, user, { ...registration, organizerName: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("upgrade_my_organizer_account", { p_organizer_name: "Jan Kowalski" });
  });

  it("fills a legacy null role as user without overwriting a concurrently changed role", async () => {
    const { client, update, is, rpc } = setup({ role: null, display_name: "Jan Kowalski" });
    await ensureGoogleOAuthAccount(client, user, registration);
    expect(update).toHaveBeenCalledExactlyOnceWith({ role: "user" });
    expect(is).toHaveBeenCalledExactlyOnceWith("role", null);
    expect(is.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
  });

  it("preserves the admin account when Google registration requested an organizer", async () => {
    const { client, upsert, update, rpc } = setup({ role: "admin", display_name: "Jan Kowalski" });
    await ensureGoogleOAuthAccount(client, user, registration);
    expect(upsert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["user", "organizer", "admin"])("preserves the existing %s on ordinary Google login", async role => {
    const { client, upsert, update, rpc } = setup({ role, display_name: "Jan Kowalski" });
    await ensureGoogleOAuthAccount(client, user, { ...registration, intent: "login" });
    expect(upsert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
