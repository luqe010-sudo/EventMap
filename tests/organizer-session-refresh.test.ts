import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, expect, it, vi } from "vitest";
import { config, middleware } from "../middleware";

vi.mock("@/lib/supabase-config", () => ({
  supabaseUrl: "https://organizer-test.supabase.invalid",
  supabasePublishableKey: "test-public-key"
}));

const cookieName = "sb-organizer-test-auth-token";

function encodeCookie(session: unknown) {
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

afterEach(() => vi.unstubAllGlobals());

it("limits session refresh to organizer routes", () => {
  expect(unstable_doesMiddlewareMatch({ config, url: "/organizer" })).toBe(true);
  expect(unstable_doesMiddlewareMatch({ config, url: "/organizer/events/new" })).toBe(true);
  expect(unstable_doesMiddlewareMatch({ config, url: "/" })).toBe(false);
  expect(unstable_doesMiddlewareMatch({ config, url: "/api/account/navbar" })).toBe(false);
});

it("lets an anonymous request reach the route guard without contacting Auth", async () => {
  const authFetch = vi.fn();
  vi.stubGlobal("fetch", authFetch);

  const response = await middleware(new NextRequest("https://eventmap.invalid/organizer"));

  expect(authFetch).not.toHaveBeenCalled();
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.cookies.getAll()).toEqual([]);
});

it("sends rotated session cookies to both the current render and the browser", async () => {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: "test-user" };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600 })).toString("base64url");
  const accessToken = `${header}.${payload}.c2ln`;
  const oldCookie = encodeCookie({
    access_token: "expired-token", refresh_token: "old-refresh", expires_at: now - 3600, user
  });
  const authFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      return Response.json({ access_token: accessToken, refresh_token: "new-refresh", expires_in: 3600, user });
    }
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    throw new Error("Unexpected Auth request");
  });
  vi.stubGlobal("fetch", authFetch);

  const request = new NextRequest("https://eventmap.invalid/organizer/events", {
    headers: { cookie: `${cookieName}=${oldCookie}; theme=dark` }
  });
  const response = await middleware(request);

  const newCookie = response.cookies.get(cookieName);
  expect(newCookie).toBeDefined();
  expect(newCookie?.value).not.toBe(oldCookie);
  const session = JSON.parse(Buffer.from(newCookie!.value.slice("base64-".length), "base64url").toString());
  expect(session).toMatchObject({ access_token: accessToken, refresh_token: "new-refresh" });
  expect(response.headers.get("x-middleware-request-cookie")).toContain(`${cookieName}=${newCookie!.value}`);
  expect(response.headers.get("x-middleware-request-cookie")).toContain("theme=dark");
  expect(response.headers.get("cache-control")).toContain("private");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
});
