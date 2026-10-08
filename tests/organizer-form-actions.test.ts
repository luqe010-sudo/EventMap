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
const query = { update: vi.fn(), insert: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
const from = vi.fn();
const getUser = vi.fn();
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
  for (const method of [query.update, query.insert, query.select, query.eq]) method.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  query.single.mockResolvedValue({ data: null, error: { code: "42501", message: "RLS private schema diagnostic" } });
  from.mockReturnValue(query);
  getUser.mockResolvedValue({ data: { user: { id: "user-a", email: "a@example.com" } }, error: null });
  vi.mocked(createSupabaseUserClient).mockResolvedValue({ from, auth: { getUser } } as unknown as Awaited<ReturnType<typeof createSupabaseUserClient>>);
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
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });
  it("keeps invalid upgrade names retryable without starting writes", async () => {
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: "🙂" }));
    expect(result.fieldErrors.organizer_name).toBeTruthy();
    expect(result.creationUnconfirmed).toBeUndefined();
    expect(query.insert).not.toHaveBeenCalled();
  });
  it("makes denied organizer creation an unconfirmed result without exposing database errors or blindly retrying", async () => {
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }));
    expect(result).toMatchObject({ creationUnconfirmed: true, error: expect.stringContaining("Sprawdź panel") });
    expect(result.error).not.toMatch(/RLS|private schema/);
    expect(query.insert).toHaveBeenCalledOnce();
    expect(query.update).not.toHaveBeenCalled();
  });
  it.each([
    ["organizer", "missing"], ["organizer", "foreign"],
    ["membership", "missing"], ["membership", "foreign"],
    ["role", "missing"], ["role", "foreign"]
  ])("does not complete upgrade when %s confirmation is %s", async (stage, resultType) => {
    query.single.mockImplementation(async () => {
      const payload = query.insert.mock.calls.at(-1)?.[0];
      if (query.insert.mock.calls.length === 1) return {
        data: stage === "organizer" ? resultType === "missing" ? null : { id: "foreign-org" } : { id: payload.id }, error: null
      };
      return {
        data: stage === "membership" ? resultType === "missing" ? null : { id: "m-a", organizer_id: payload.organizer_id, user_id: "user-b" } : { id: "m-a", organizer_id: payload.organizer_id, user_id: "user-a" }, error: null
      };
    });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: resultType === "missing" ? null : { id: "user-b" }, error: null });
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }));
    expect(result.creationUnconfirmed).toBe(true);
    expect(result.error).toContain("potwierdzić");
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    if (stage !== "role") expect(query.update).not.toHaveBeenCalled();
  });
  it("redirects to the panel only after all three upgrade rows are confirmed", async () => {
    query.single.mockImplementation(async () => {
      const payload = query.insert.mock.calls.at(-1)?.[0];
      return { data: query.insert.mock.calls.length === 1 ? { id: payload.id } : { id: "m-a", organizer_id: payload.organizer_id, user_id: "user-a" }, error: null };
    });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: { id: "user-a", role: "organizer" }, error: null });
    await expect(createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }))).rejects.toThrow("Redirect: /organizer");
    expect(query.insert).toHaveBeenCalledTimes(2);
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ role: "organizer" });
    expect(revalidatePath).toHaveBeenCalledWith("/organizer");
  });
  it("does not report upgrade success if the returned profile kept its regular role", async () => {
    query.single.mockImplementation(async () => {
      const payload = query.insert.mock.calls.at(-1)?.[0];
      return { data: query.insert.mock.calls.length === 1 ? { id: payload.id } : { id: "m-a", organizer_id: payload.organizer_id, user_id: "user-a" }, error: null };
    });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: { id: "user-a", role: "user" }, error: null });
    expect(await createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }))).toMatchObject({ creationUnconfirmed: true });
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("also requires a confirmed profile insert when the account has no profile row", async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ userId: "user-a", profile: null });
    query.single.mockImplementation(async () => {
      const payload = query.insert.mock.calls.at(-1)?.[0];
      if (query.insert.mock.calls.length === 1) return { data: { id: payload.id }, error: null };
      if (query.insert.mock.calls.length === 2) return { data: { id: "m-a", organizer_id: payload.organizer_id, user_id: "user-a" }, error: null };
      return { data: null, error: null };
    });
    const result = await createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }));
    expect(result.creationUnconfirmed).toBe(true);
    expect(query.insert).toHaveBeenCalledTimes(3);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("preserves the upgrade return path when Auth no longer confirms the same user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
    await expect(createOrganizerAccountFormAction(initial, form({ organizer_name: "A" }))).rejects.toThrow("Redirect: /login?next=%2Forganizer");
    expect(query.insert).not.toHaveBeenCalled();
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
