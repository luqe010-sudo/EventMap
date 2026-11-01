import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "node:fs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import DeleteEventButton from "../components/DeleteEventButton";
import { formatEventStatus } from "../lib/event-editor";
import { EventValidationError, validateEventForm } from "../lib/event-editor-validation";
import { isPhotonSettlement, uniqueSuggestionsByLabel } from "../lib/location-suggestions";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function eventForm(startAt: string) {
  const data = new FormData();
  data.set("title", "Koncert testowy");
  data.set("start_at", startAt);
  data.set("price_type", "free");
  return data;
}

describe("panel audit regressions", () => {
  it("does not submit an event delete directly from the admin table", () => {
    const html = renderToStaticMarkup(createElement(DeleteEventButton, { deleteAction: vi.fn(), eventTitle: "Koncert" }));
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
    expect(source("app/admin/events/page.tsx")).not.toContain("<form action={adminDeleteEventAction");
  });

  it("starts a new admin event as a draft", () => {
    const form = source("components/EventEditorForm.tsx");
    expect(form).toContain('defaultValue={event?.status ?? "draft"}');
    expect(form).not.toContain('event?.status ?? "published"');
  });

  it("describes statuses in Polish and keeps unknown values readable", () => {
    expect(formatEventStatus("pending_review")).toBe("Do sprawdzenia");
    expect(formatEventStatus(null)).toBe("Szkic");
    expect(formatEventStatus("custom")).toBe("custom");
  });

  it("rejects a placeholder year in the event form", () => {
    let error: unknown;
    try { validateEventForm(eventForm("2200-01-01T18:00"), "organizer-a"); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(EventValidationError);
    expect((error as EventValidationError).fieldErrors.start_at).toContain("3 lata");
  });

  it("accepts only settlements from Photon", () => {
    expect(isPhotonSettlement({ osm_key: "place", osm_value: "city" })).toBe(true);
    expect(isPhotonSettlement({ osm_key: "place", osm_value: "hamlet" })).toBe(true);
    expect(isPhotonSettlement({ osm_key: "power", osm_value: "plant" })).toBe(false);
    expect(isPhotonSettlement({ osm_key: "highway", osm_value: "residential" })).toBe(false);
    expect(isPhotonSettlement({ osm_key: "place", osm_value: "suburb" })).toBe(false);
  });

  it("keeps the first spelling of the same suggestion", () => {
    const unique = uniqueSuggestionsByLabel([
      { label: "Kraków (woj. małopolskie)" },
      { label: "Krakow (woj. małopolskie)" },
      { label: "Krakowiany (woj. mazowieckie)" }
    ]);
    expect(unique.map((item) => item.label)).toEqual(["Kraków (woj. małopolskie)", "Krakowiany (woj. mazowieckie)"]);
  });

  it("lists admin cities from the cities table", () => {
    const cities = source("lib/admin-city-pages.ts");
    expect(cities).toContain('.from("cities")');
    expect(cities).toContain("listAllCities(supabase)");
  });

  it("maps all sixteen voivodeships to Polish map labels", () => {
    const names = source("components/MapLibreMap.tsx").match(/"[^"]+ Voivodeship"/g) ?? [];
    expect(new Set(names).size).toBe(16);
    expect(names).toHaveLength(16);
  });
});
