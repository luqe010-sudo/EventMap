import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getCurrentUserContext: vi.fn(),
  getPrimaryOrganizerId: vi.fn(),
  requireOrganizerAccess: vi.fn()
}));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/event-editor-server", () => ({ buildEventWritePayload: vi.fn(), saveEventSource: vi.fn() }));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizerAccess } from "../lib/auth";
import { organizerUpdateProfileAction } from "../lib/organizer-events";
import { createSupabaseUserClient } from "../lib/supabase-user";

const organizerId = "organizer-a";
const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
const from = vi.fn();

function profileForm() {
  const form = new FormData();
  form.set("name", "Organizator A");
  form.set("is_verified", "true");
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireOrganizerAccess).mockResolvedValue({
    userId: "current-user",
    profile: null,
    memberships: [{ id: "membership-a", organizer_id: organizerId, user_id: "current-user", role: "owner", created_at: null, organizer: null }],
    isAdmin: false
  });
  vi.mocked(redirect).mockImplementation((path) => { throw new Error(`Redirect: ${path}`); });
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  from.mockReturnValue(query);
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
});

describe("organizer profile update confirmation", () => {
  it("does not report success when RLS silently filters the update to zero rows", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(organizerUpdateProfileAction(organizerId, profileForm())).rejects.toThrow("Nie udało się zapisać profilu organizatora");
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not report success when the database rejects the update", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "42501", message: "Denied" } });
    await expect(organizerUpdateProfileAction(organizerId, profileForm())).rejects.toThrow("Denied");
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("finishes only after the own organization update returns a row and ignores verification input", async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: organizerId }, error: null });
    await expect(organizerUpdateProfileAction(organizerId, profileForm())).rejects.toThrow("Redirect: /organizer/profile");
    expect(from).toHaveBeenCalledExactlyOnceWith("organizers");
    expect(query.eq).toHaveBeenCalledWith("id", organizerId);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("is_verified");
    expect(revalidatePath).toHaveBeenCalledWith("/organizer/profile");
  });

  it("rejects a foreign organization before creating a database client", async () => {
    await expect(organizerUpdateProfileAction("organizer-b", profileForm())).rejects.toThrow("Redirect: /organizer/profile");
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
