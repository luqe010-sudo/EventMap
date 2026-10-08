import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const mocks = vi.hoisted(() => ({
  client: vi.fn(), cookieSet: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); })
}));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: mocks.client }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: mocks.cookieSet })) }));
vi.mock("next/navigation", async importOriginal => ({
  ...await importOriginal<typeof import("next/navigation")>(), redirect: mocks.redirect
}));

import { confirmSignOut } from "../lib/auth-sign-out";
import { POST } from "../app/auth/sign-out/route";
import { GET } from "../app/auth/recovery/route";
import SignOutFailedPage from "../app/auth/sign-out-failed/page";
import { PASSWORD_RECOVERY_COOKIE } from "../lib/password-recovery";

const auth = { signOut: vi.fn(), exchangeCodeForSession: vi.fn(), getUser: vi.fn() };
const client = { auth } as unknown as Parameters<typeof confirmSignOut>[0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.signOut.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session: {}, redirectType: null }, error: null });
  mocks.client.mockResolvedValue(client);
});

describe("confirmed logout", () => {
  it("returns to the home page only after Auth confirms sign-out", async () => {
    await expect(POST()).rejects.toThrow("REDIRECT:/");
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "global" });
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/");
    expect(mocks.cookieSet).toHaveBeenCalledWith(PASSWORD_RECOVERY_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
  });

  it.each(["returned", "thrown"])("offers a retry for a %s sign-out failure without logging session data", async failure => {
    const secret = "secret-access-token";
    if (failure === "returned") auth.signOut.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: secret } });
    else auth.signOut.mockRejectedValue(new Error(secret));
    await expect(POST()).rejects.toThrow("REDIRECT:/auth/sign-out-failed");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/auth/sign-out-failed");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
  });

  it("shows the same retry path when the client cannot be created", async () => {
    mocks.client.mockRejectedValue(new Error("secret-client-details"));
    await expect(POST()).rejects.toThrow("REDIRECT:/auth/sign-out-failed");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-client-details");
  });

  it("preserves framework redirect signals", async () => {
    const signal = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    auth.signOut.mockRejectedValue(signal);
    await expect(POST()).rejects.toBe(signal);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("provides a visible retry while explaining that a session may remain active", () => {
    const html = renderToStaticMarkup(createElement(SignOutFailedPage));
    expect(html).toContain("Twoja sesja może nadal być aktywna");
    expect(html).toContain('action="/auth/sign-out"');
    expect(html).toContain('method="post"');
    expect(html).toContain("Ponów wylogowanie");
  });
});

describe("rejected OAuth recovery code cleanup", () => {
  it.each(["returned", "thrown"])("does not imply cleanup succeeded after a %s local sign-out failure", async failure => {
    if (failure === "returned") auth.signOut.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });
    else auth.signOut.mockRejectedValue(new Error("secret-service-error"));
    const response = await GET(new Request("https://mapaimprez.pl/auth/recovery?code=secret-code"));
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://mapaimprez.pl/auth/sign-out-failed");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalledExactlyOnceWith(PASSWORD_RECOVERY_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-");
  });
});
