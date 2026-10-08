import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasRecoveryContext, PASSWORD_RECOVERY_COOKIE, recoveryCookieValue } from "../lib/password-recovery";

const mocks = vi.hoisted(() => ({
  client: vi.fn(), cookies: vi.fn(), origin: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); })
}));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: mocks.client }));
vi.mock("@/lib/auth-origin", () => ({ getRequestOrigin: mocks.origin }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requestPasswordResetAction, resetPasswordAction } from "../lib/auth-password-actions";
import { GET } from "../app/auth/recovery/route";
import { POST as signOut } from "../app/auth/sign-out/route";
import { signInFormAction } from "../lib/auth-actions";

const initialState = { error: null };
const user = { id: "user-a" };
let cookieValues: Map<string, string>;
let cookieSet: ReturnType<typeof vi.fn>;
let auth: {
  resetPasswordForEmail: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
};

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  cookieValues = new Map();
  cookieSet = vi.fn((name: string, value: string) => cookieValues.set(name, value));
  mocks.cookies.mockResolvedValue({ get: (name: string) => ({ value: cookieValues.get(name) }), set: cookieSet });
  mocks.origin.mockResolvedValue("https://mapaimprez.pl");
  auth = {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user, session: {} }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { user, session: {}, redirectType: "recovery" }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null })
  };
  mocks.client.mockResolvedValue({ auth });
});

describe("recovery request", () => {
  it("validates email before contacting Auth", async () => {
    expect((await requestPasswordResetAction(initialState, form({ email: "bad" }))).error).toBeTruthy();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("preserves an event destination and uses the dedicated callback", async () => {
    const next = "/koncerty/wroclaw/test?radius=50";
    expect(await requestPasswordResetAction(initialState, form({ email: " a@example.invalid ", next })))
      .toEqual({ error: null, sent: true });
    const [email, options] = auth.resetPasswordForEmail.mock.calls[0];
    expect(email).toBe("a@example.invalid");
    const callback = new URL(options.redirectTo);
    expect(callback.pathname).toBe("/auth/recovery");
    expect(callback.searchParams.get("next")).toBe(next);
  });
  it("never includes an external next or reveals whether an account exists", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found" } });
    expect(await requestPasswordResetAction(initialState, form({ email: "none@example.invalid", next: "//evil.invalid" })))
      .toEqual({ error: null, sent: true });
    expect(new URL(auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).searchParams.get("next")).toBe("/");
  });
  it("reports rate limits and service failures without raw Auth messages", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429, message: "private email" } });
    const result = await requestPasswordResetAction(initialState, form({ email: "a@example.invalid" }));
    expect(result.error).toContain("Odczekaj");
    expect(result.error).not.toContain("private email");
    mocks.client.mockRejectedValue(new Error("service offline"));
    expect((await requestPasswordResetAction(initialState, form({ email: "a@example.invalid" }))).error).toContain("połączyć");
  });
});

describe("recovery callback", () => {
  it("verifies a recovery token hash, binds the user, and removes the token from the URL", async () => {
    const response = await GET(new Request("https://mapaimprez.pl/auth/recovery?token_hash=secret&type=recovery&next=%2Faccount"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "secret", type: "recovery" });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://mapaimprez.pl/auth/reset-password?next=%2Faccount");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(hasRecoveryContext(cookieValues.get(PASSWORD_RECOVERY_COOKIE), user.id)).toBe(true);
    expect(cookieSet.mock.calls.at(-1)?.[2]).toEqual(expect.objectContaining({ httpOnly: true, secure: true, path: "/auth", maxAge: 600 }));
  });
  it("accepts only recovery PKCE and refuses an ordinary OAuth code", async () => {
    await GET(new Request("https://mapaimprez.pl/auth/recovery?code=valid"));
    expect(hasRecoveryContext(cookieValues.get(PASSWORD_RECOVERY_COOKIE), user.id)).toBe(true);
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user, session: {}, redirectType: null }, error: null });
    const response = await GET(new Request("https://mapaimprez.pl/auth/recovery?code=google"));
    expect(response.headers.get("location")).toContain("/forgot-password?error=expired");
    expect(hasRecoveryContext(cookieValues.get(PASSWORD_RECOVERY_COOKIE), user.id)).toBe(false);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each(["", "?token_hash=secret&type=email", "?code=one&token_hash=two&type=recovery", "?error=access_denied&code=one"])
    ("does not verify malformed or non-recovery parameters %s", async (query) => {
      const response = await GET(new Request(`https://mapaimprez.pl/auth/recovery${query}`));
      expect(response.headers.get("location")).toContain("/forgot-password?error=expired");
      expect(auth.verifyOtp).not.toHaveBeenCalled();
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });
  it("rejects used or expired code even when a user is already logged in", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { code: "flow_state_not_found" } });
    const response = await GET(new Request("https://mapaimprez.pl/auth/recovery?code=used&next=%2F%2Fevil.invalid"));
    expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe("/");
    expect(cookieValues.get(PASSWORD_RECOVERY_COOKIE)).toBe("");
    expect(auth.getUser).not.toHaveBeenCalled();
  });
});

describe("new password", () => {
  it("clears an old recovery context on ordinary login to the same account", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    await expect(signInFormAction(initialState, form({ email: "a@example.invalid", password: "password1", next: "/account" })))
      .rejects.toThrow("REDIRECT:/account");
    expect(cookieValues.get(PASSWORD_RECOVERY_COOKIE)).toBe("");
  });
  it("clears recovery context on logout", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    await expect(signOut()).rejects.toThrow("REDIRECT:/");
    expect(cookieValues.get(PASSWORD_RECOVERY_COOKIE)).toBe("");
  });
  it.each([
    { password: "short", confirmPassword: "short" },
    { password: "password1", confirmPassword: "password2" },
    { password: "x".repeat(129), confirmPassword: "x".repeat(129) }
  ])("rejects invalid password without an Auth write", async (values) => {
    expect((await resetPasswordAction(initialState, form(values))).error).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it.each([undefined, recoveryCookieValue("user-b"), recoveryCookieValue(user.id, Date.now() - 601_000)])
    ("refuses missing, wrong-account or expired recovery context", async (value) => {
      if (value) cookieValues.set(PASSWORD_RECOVERY_COOKIE, value);
      const result = await resetPasswordAction(initialState, form({ password: "password1", confirmPassword: "password1" }));
      expect(result.error).toContain("wygasły");
      expect(auth.updateUser).not.toHaveBeenCalled();
    });
  it("requires a server-verified user in the action as well as the page", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    auth.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    expect((await resetPasswordAction(initialState, form({ password: "password1", confirmPassword: "password1" }))).error).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("keeps the recovery context for retry after a rejected update", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    auth.updateUser.mockResolvedValue({ error: { code: "same_password" } });
    expect((await resetPasswordAction(initialState, form({ password: "password1", confirmPassword: "password1" }))).error).toContain("różnić");
    expect(hasRecoveryContext(cookieValues.get(PASSWORD_RECOVERY_COOKIE), user.id)).toBe(true);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("changes the password once, clears context, and preserves next on login", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    await expect(resetPasswordAction(initialState, form({ password: "password1", confirmPassword: "password1", next: "/account/saved" })))
      .rejects.toThrow("REDIRECT:/login?reset=success&next=%2Faccount%2Fsaved");
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "password1" });
    expect(cookieValues.get(PASSWORD_RECOVERY_COOKIE)).toBe("");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not report a successful password change as failed if cleanup fails", async () => {
    cookieValues.set(PASSWORD_RECOVERY_COOKIE, recoveryCookieValue(user.id));
    cookieSet.mockImplementationOnce(() => { throw new Error("cleanup failed"); });
    await expect(resetPasswordAction(initialState, form({ password: "password1", confirmPassword: "password1", next: "https://evil.invalid" })))
      .rejects.toThrow("REDIRECT:/login?reset=success&next=%2F");
    expect(auth.updateUser).toHaveBeenCalledOnce();
  });
});
