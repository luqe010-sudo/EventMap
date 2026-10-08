import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminEventListPage } from "@/lib/admin-event-list";

const mocks = vi.hoisted(() => ({ list: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/admin-events", () => ({
  listAdminEvents: mocks.list, listAdminReviewEvents: mocks.review,
  adminDeleteEventAction: vi.fn(), adminSetEventStatusAction: vi.fn()
}));
import EventsPage from "../app/admin/events/page";
import ReviewPage from "../app/admin/review/page";

const empty: AdminEventListPage = { events: [], totalCount: 0, page: 1, pageSize: 50, pageCount: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue(empty); mocks.review.mockResolvedValue(empty);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("admin result states and navigation", () => {
  it.each([EventsPage, ReviewPage])("shows a real empty result without an unavailable warning", async (Page) => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("0 wyników");
    expect(html).toContain("0–0 z 0");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Następna strona");
  });

  it("preserves filters in both page links and resets the page when applying filters", async () => {
    mocks.list.mockResolvedValue({ ...empty, page: 2, pageCount: 3, totalCount: 105 });
    const html = renderToStaticMarkup(await EventsPage({ searchParams: Promise.resolve({ q: "50% koncert", city: "Łódź", sort: "city", dir: "asc", page: "2", token: "private", save: "unconfirmed" }) }));
    expect(html).toContain("105 wyników");
    expect(html).toContain("Strona 2 z 3");
    expect(html).toContain("Poprzednia strona");
    expect(html).toContain("Następna strona");
    expect(html).toContain("q=50%25+koncert");
    expect(html).toContain("page=3");
    expect(html).not.toContain("token=");
    const filterForm = html.split('method="get"')[1].split("</form>")[0];
    expect(filterForm).not.toContain('name="page"');
  });

  it.each([[EventsPage, mocks.list], [ReviewPage, mocks.review]] as const)("shows unavailable separately from empty and does not expose database details", async (Page, list) => {
    list.mockRejectedValue(new Error("sensitive database details"));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ city: "Warszawa" }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Wyniki niedostępne");
    expect(html).toContain("Spróbuj ponownie");
    expect(html).not.toContain("sensitive database details");
    expect(html).not.toContain("0 wyników");
  });

  it.each([[EventsPage, mocks.list], [ReviewPage, mocks.review]] as const)("preserves the Next Auth redirect instead of rendering the panel after catching it", async (Page, list) => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    list.mockRejectedValue(redirect);
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toBe(redirect);
  });
});
