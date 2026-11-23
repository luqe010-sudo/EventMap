import { beforeEach, expect, it, vi } from "vitest";
import { requireOrganizerAccess, requireSignedInUser } from "../lib/auth";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/supabase-user", () => ({
  createSupabaseUserClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from })
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string): never => { throw new Error(path); }
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null } });
});

it.each([
  "/organizer",
  "/organizer/settings",
  "/organizer/events?status=published&dateFrom=2026-11-12",
  "/organizer/events/event-id/edit"
])("returns to %s after signing in", async (path) => {
  const guard = path.startsWith("/organizer/events") ? requireOrganizerAccess : requireSignedInUser;
  await expect(guard(path)).rejects.toThrow(`/login?next=${encodeURIComponent(path)}`);
  expect(mocks.from).not.toHaveBeenCalled();
});

it("keeps the upgrade entry point accessible to a signed-in viewer", async () => {
  const profile = { id: "viewer", role: "user" };
  mocks.getUser.mockResolvedValue({ data: { user: { id: profile.id } } });
  mocks.from.mockReturnValue({ select: () => ({
    eq: () => ({ maybeSingle: async () => ({ data: profile }) })
  }) });

  await expect(requireSignedInUser("/organizer")).resolves.toEqual({ userId: profile.id, profile });
  await expect(requireOrganizerAccess("/organizer/events")).rejects.toThrow(/^\/$/);
  expect(mocks.from.mock.calls).toEqual([["profiles"], ["profiles"]]);
});
