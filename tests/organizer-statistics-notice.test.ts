import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import OrganizerStatisticsNotice from "../components/OrganizerStatisticsNotice";
import type { OrganizerEventListItem } from "../lib/organizer-events";

vi.mock("@/lib/organizer-events", () => ({ getOrganizerStats: vi.fn() }));
import { getOrganizerStats } from "../lib/organizer-events";
import OrganizerStatsPage from "../app/organizer/stats/page";

it("shows an explicit partial-data alert without replacing missing metrics with zero", () => {
  const html = renderToStaticMarkup(createElement(OrganizerStatisticsNotice, { analyticsStatus: "incomplete", savesStatus: "unavailable" }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("interakcji (niepełny odczyt)");
  expect(html).toContain("bieżących zapisań (niedostępne)");
  expect(html).toContain("—");
  expect(html).toContain("Odśwież stronę");
});

it("does not show an error after both datasets were completely read", () => {
  expect(renderToStaticMarkup(createElement(OrganizerStatisticsNotice, { analyticsStatus: "complete", savesStatus: "complete" }))).toBe("");
});

it("renders unavailable interaction values as dashes while preserving a confirmed current save count", async () => {
  vi.mocked(getOrganizerStats).mockResolvedValue({
    analyticsStatus: "incomplete", savesStatus: "complete",
    rows: [{
      event: { id: "event-a", title: "Przykładowe wydarzenie", start_at: "2027-05-01T12:00:00Z" } as OrganizerEventListItem,
      views: null, phoneClicks: null, websiteClicks: null, mapClicks: null, ticketClicks: null,
      saveClicks: null, currentSaves: 7, shares: null
    }]
  });
  const html = renderToStaticMarkup(await OrganizerStatsPage());
  expect(html).toContain("Kliknięcia serca");
  expect(html).toContain("Bieżące zapisania");
  expect(html).toContain('role="alert"');
  const tableBody = html.split("<tbody>")[1].split("</tbody>")[0];
  expect(tableBody.match(/<td>—<\/td>/g)).toHaveLength(7);
  expect(tableBody).toContain("<td>7</td>");
  expect(tableBody).not.toContain("<td>0</td>");
});
