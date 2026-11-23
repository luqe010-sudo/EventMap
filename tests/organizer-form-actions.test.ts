import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`Redirect: ${path}`); }),
  unstable_rethrow: vi.fn((error: unknown) => { if (error instanceof Error && error.message.startsWith("Redirect:")) throw error; })
}));
vi.mock("@/lib/auth", () => ({ getCurrentUserContext: vi.fn(), getPrimaryOrganizerId: vi.fn(), requireOrganizerAccess: vi.fn() }));
vi.mock("@/lib/supabase-user", () => ({ createSupabaseUserClient: vi.fn() }));
vi.mock("@/lib/event-editor-server", () => ({ buildEventWritePayload: vi.fn(), saveEventSource: vi.fn() }));

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext, requireOrganizerAccess } from "../lib/auth";
import { createSupabaseUserClient } from "../lib/supabase-user";
import { createOrganizerAccountFormAction, organizerUpdateAccountFormAction, organizerUpdateProfileFormAction } from "../lib/organizer-form-actions";
import { validateOrganizerProfileForm, OrganizerFormValidationError } from "../lib/organizer-form-validation";

const initial = { fieldErrors: {}, error: null };
const query = { update: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
const from = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();
const organizerId = "581267a2-de6f-4420-b1a9-7d1efb5b21de";
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(redirect).mockImplementation(path => { throw new Error(`Redirect: ${path}`); });
  vi.mocked(getCurrentUserContext).mockResolvedValue({ userId: "user-a", profile: { id: "user-a", role: "user", display_name: "A", created_at: null } });
  vi.mocked(requireOrganizerAccess).mockResolvedValue({ userId: "user-a", profile: null, isAdmin: false, memberships: [{ id: "m-a", organizer_id: "org-a", user_id: "user-a", role: "owner", created_at: null, organizer: null }] });
  for (const method of [query.update, query.select, query.eq]) method.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  from.mockReturnValue(query);
  getUser.mockResolvedValue({ data: { user: { id: "user-a", email: "a@example.com" } }, error: null });
  rpc.mockResolvedValue({ data: organizerId, error: null });
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ from, auth: { getUser }, rpc } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("organizer profile and account form outcomes", () => {
  it("returns all field errors before starting a profile write", async () => {
    const result = await organizerUpdateProfileFormAction("org-a", initial, form({ name: " ", website: "javascript:alert(1)", email: "invalid", description: "a".repeat(10001) }));
    expect(result.fieldErrors).toMatchObject({ name: expect.any(String), website: expect.any(String), email: expect.any(String), description: expect.any(String) });
    expect(query.update).not.toHaveBeenCalled();
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });
  it.each([null, { id: "foreign-org" }])("does not report profile success for an absent or mismatched result %o", async data => {
    query.maybeSingle.mockResolvedValue({ data, error: null });
    const result = await organizerUpdateProfileFormAction("org-a", initial, form({ name: "Moja organizacja" }));
    expect(result.error).toContain("Nie udało się potwierdzić");
    expect(result.success).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("shows a safe error when profile RLS denies the write without leaking diagnostics", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: "RLS private schema diagnostic" } });
    const result = await organizerUpdateProfileFormAction("org-a", initial, form({ name: "Moja organizacja" }));
    expect(result.error).toContain("administratorem");
    expect(result.error).not.toMatch(/RLS|private schema/);
    expect(result.success).toBeUndefined();
  });
  it("confirms profile success only after its id returns and ignores protected input", async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: "org-a" }, error: null });
    const result = await organizerUpdateProfileFormAction("org-a", initial, form({ name: "Moja organizacja", is_verified: "true", id: "foreign", created_at: "fake" }));
    expect(result.success).toContain("zapisany");
    expect(result.error).toBeNull();
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("is_verified");
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("id");
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("created_at");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("passes foreign-owner access redirects through the form wrapper", async () => {
    await expect(organizerUpdateProfileFormAction("foreign-org", initial, form({ name: "A" }))).rejects.toThrow("Redirect: /organizer/profile");
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
  });
  it("validates account name before the update and never accepts a forged role", async () => {
    const invalid = await organizerUpdateAccountFormAction(initial, form({ display_name: " " }));
    expect(invalid.fieldErrors.display_name).toBeTruthy();
    expect(query.update).not.toHaveBeenCalled();
    query.maybeSingle.mockResolvedValue({ data: { id: "user-a" }, error: null });
    const result = await organizerUpdateAccountFormAction(initial, form({ display_name: "Nowa nazwa", role: "admin" }));
    expect(result.success).toContain("zapisane");
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ display_name: "Nowa nazwa" });
    expect(query.eq).toHaveBeenCalledWith("id", "user-a");
  });
  it.each([null, { id: "user-b" }])("treats zero/foreign rows in account update as unconfirmed %o", async data => {
    query.maybeSingle.mockResolvedValue({ data, error: null });
    expect(await organizerUpdateAccountFormAction(initial, form({ display_name: "Nowa nazwa" }))).toMatchObject({ error: expect.stringContaining("Nie udało się potwierdzić") });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["admin", "organizer"])("prevents the upgrade flow from changing an existing %s role", async role => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ userId: "user-a", profile: { id: "user-a", role, display_name: "A", created_at: null } });
    await expect(createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }))).rejects.toThrow("Redirect: /organizer");
    expect(createSupabaseUserClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["🙂", "Fundacja\nPrzykład"])("keeps invalid upgrade names retryable without starting writes (%j)", async name => {
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: name }));
    expect(result.fieldErrors.organizer_name).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps denied organizer creation retryable without exposing database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "RLS private schema diagnostic" } });
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }));
    expect(result).toMatchObject({ fieldErrors: {}, error: expect.stringContaining("ponowić próbę") });
    expect(result.error).not.toMatch(/RLS|private schema/);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it.each([null, "", "invalid", { id: organizerId }])("requires an organizer UUID to complete the upgrade (%o)", async data => {
    rpc.mockResolvedValue({ data, error: null });
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }));
    expect(result.error).toContain("potwierdzić");
    expect(from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("uses one atomic RPC with only the validated name and redirects to the panel", async () => {
    await expect(createOrganizerAccountFormAction(initial, form({ organizer_name: " A ", role: "admin", user_id: "user-b", organizer_id: "org-b" }))).rejects.toThrow("Redirect: /organizer");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("upgrade_my_organizer_account", { p_organizer_name: "A" });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });
  it("allows the same operation to be retried after a response was lost", async () => {
    rpc.mockRejectedValueOnce(new Error("Network response lost"));
    const data = form({ organizer_name: "A" });
    const result = await createOrganizerAccountFormAction(initial, data);
    expect(result.error).toContain("ponowić");
    await expect(createOrganizerAccountFormAction(result, data)).rejects.toThrow("Redirect: /organizer");
    expect(rpc.mock.calls).toEqual([
      ["upgrade_my_organizer_account", { p_organizer_name: "A" }],
      ["upgrade_my_organizer_account", { p_organizer_name: "A" }]
    ]);
    expect(from).not.toHaveBeenCalled();
  });
  it("leaves profile initialization to the same RPC when the account has no profile row", async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ userId: "user-a", profile: null });
    await expect(createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }))).rejects.toThrow("Redirect: /organizer");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("upgrade_my_organizer_account", { p_organizer_name: "A" });
    expect(from).not.toHaveBeenCalled();
  });
  it("preserves the upgrade return path when Auth no longer confirms the same user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
    await expect(createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }))).rejects.toThrow("Redirect: /login?next=%2Forganizer");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("organizer profile safe URL contract", () => {
  it.each(["javascript:alert(1)", "data:text/html,content", "https://user:password@example.com", "//example.com", "not a URL"])("rejects unsafe URL %s", value => {
    expect(() => validateOrganizerProfileForm(form({ name: "A", website: value, logo_url: value }))).toThrow(OrganizerFormValidationError);
  });
  it("accepts ordinary URLs, empty optional fields and existing custom types", () => {
    expect(validateOrganizerProfileForm(form({ name: " Dom kultury ", website: "https://example.com/?x=1", type: "historical_type" }))).toMatchObject({ name: "Dom kultury", slug: "dom-kultury", website: "https://example.com/?x=1", type: "historical_type", logo_url: null });
  });
});
