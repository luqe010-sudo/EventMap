import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-user", () => ({
  createSupabaseUserClient: vi.fn(),
  hasSupabaseUserConfig: vi.fn()
}));

import { GET } from "../app/api/account/navbar/route";
import { createSupabaseUserClient, hasSupabaseUserConfig } from "../lib/supabase-user";

const getUser = vi.fn();
const from = vi.fn();
const profileQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(hasSupabaseUserConfig).mockReturnValue(true);
  getUser.mockResolvedValue({ data: { user: { id: "current-user", email: "private@example.invalid" } }, error: null });
  from.mockReturnValue(profileQuery);
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);
  profileQuery.maybeSingle.mockResolvedValue({ data: { display_name: "Organizator A", role: "organizer" }, error: null });
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ auth: { getUser }, from } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
});

async function expectAnonymousResponse() {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  expect(await response.json()).toEqual({ isLoggedIn: false });
}

describe("navbar authentication fallback", () => {
  it("shows an anonymous navbar when config is missing without calling Auth", async () => {
    vi.mocked(hasSupabaseUserConfig).mockReturnValue(false);
    await expectAnonymousResponse();
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });

  it("shows an anonymous navbar for a logged-out visitor without requesting a profile", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expectAnonymousResponse();
    expect(from).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs Auth errors and does not expose user data even when a user was returned", async () => {
    const error = { message: "Auth unavailable" };
    getUser.mockResolvedValue({ data: { user: { id: "current-user", email: "private@example.invalid" } }, error });
    await expectAnonymousResponse();
    expect(from).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("[navbar] Failed to load auth user", error);
  });

  it("logs profile errors and returns anonymous state instead of a fabricated user role", async () => {
    const error = { message: "Profile unavailable" };
    profileQuery.maybeSingle.mockResolvedValue({ data: null, error });
    await expectAnonymousResponse();
    expect(console.error).toHaveBeenCalledWith("[navbar] Failed to load profile", error);
  });

  it("contains thrown client failures in the anonymous fallback", async () => {
    vi.mocked(createSupabaseUserClient).mockRejectedValue(new Error("Config failure"));
    await expectAnonymousResponse();
    expect(console.error).toHaveBeenCalledWith("[navbar] Failed to load auth state", expect.any(Error));
  });

  it("contains thrown profile failures in the anonymous fallback", async () => {
    profileQuery.maybeSingle.mockRejectedValue(new Error("Network failure"));
    await expectAnonymousResponse();
    expect(console.error).toHaveBeenCalledWith("[navbar] Failed to load auth state", expect.any(Error));
  });

  it("returns the verified account profile when Auth and profile reads succeed", async () => {
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ isLoggedIn: true, displayName: "Organizator A", email: "private@example.invalid", role: "organizer" });
    expect(profileQuery.eq).toHaveBeenCalledWith("id", "current-user");
  });
});
