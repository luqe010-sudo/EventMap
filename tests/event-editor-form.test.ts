import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const editorState = vi.hoisted(() => ({ current: null as EventEditorState | null, acknowledged: false, pending: false }));

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: vi.fn((_action: unknown, initialState: EventEditorState) => [editorState.current ?? initialState, () => {}, editorState.pending]),
  useState: vi.fn(() => [editorState.acknowledged, () => {}])
}));

vi.mock("@/components/LocationSection", () => ({ default: () => null }));

import EventEditorForm from "../components/EventEditorForm";
import type { EditableEvent } from "../lib/event-editor";
import type { EventEditorState } from "../lib/event-editor-validation";

const options = { categories: [], locations: [], organizers: [{ id: "submitter-organizer", name: "Organizator zgłaszający" }] };
const action = vi.fn(async () => ({ fieldErrors: {}, error: null }));

beforeEach(() => { editorState.current = null; editorState.acknowledged = false; editorState.pending = false; });

function render(organizer: { id: string; name: string } | null, organizerId = "display-organizer") {
  const event = { organizer_id: organizerId, organizer, submitted_by_organizer_id: "submitter-organizer" } as EditableEvent;
  return renderToStaticMarkup(createElement(EventEditorForm, { action, event, options, mode: "organizer", submitLabel: "Zapisz zmiany" }));
}

it("shows the admin-assigned display organizer even when it is outside the submitter's memberships", () => {
  const html = render({ id: "display-organizer", name: "Organizator przypisany przez admina" });
  expect(html).toMatch(/<select[^>]*name="organizer_id"[^>]*disabled=""/);
  expect(html).toContain('<option value="display-organizer" selected="">Organizator przypisany przez admina</option>');
  expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="organizer_id"[^>]*value="display-organizer"/);
});

it("uses a human label when the assigned organizer relation is unavailable", () => {
  const html = render(null);
  expect(html).toContain('<option value="display-organizer" selected="">Organizator przypisany do wydarzenia</option>');
  expect(html).not.toContain('>display-organizer<');
});

it("does not add a duplicate option when the assigned organizer is already among memberships", () => {
  const html = render({ id: "submitter-organizer", name: "Organizator zgłaszający" }, "submitter-organizer");
  expect(html.match(/<option value="submitter-organizer"/g)).toHaveLength(1);
  expect(html).toContain('<option value="submitter-organizer" selected="">Organizator zgłaszający</option>');
});

it.each(["partial", "unconfirmed"] as const)("blocks another create submit after a %s save while keeping verification links available", kind => {
  editorState.current = {
    fieldErrors: {}, error: "Sprawdź wynik zapisu.",
    saveIssue: { kind, editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" }
  };
  const html = renderToStaticMarkup(createElement(EventEditorForm, { action, options, mode: "organizer", submitLabel: "Dodaj wydarzenie" }));
  expect(html).toContain('role="alert">Sprawdź wynik zapisu.');
  expect(html).not.toMatch(/<fieldset[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Dodaj wydarzenie/);
  const linksOutsideFieldset = html.split("<fieldset")[0];
  expect(linksOutsideFieldset).toContain('href="/organizer/events/event-a/edit" target="_blank" rel="noopener noreferrer"');
  expect(linksOutsideFieldset).toContain('href="/organizer/events" target="_blank" rel="noopener noreferrer"');
  expect(linksOutsideFieldset).toContain(kind === "partial" ? "Otwórz zapisane wydarzenie" : "Sprawdź zapis wydarzenia");
});

it("blocks both editing and resubmission after a partial save of a rejected event", () => {
  editorState.current = {
    fieldErrors: {}, error: "Źródło wymaga sprawdzenia.",
    saveIssue: { kind: "partial", editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" }
  };
  const event = { title: "Zachowany tytuł", status: "rejected", is_cancelled: false } as EditableEvent;
  const html = renderToStaticMarkup(createElement(EventEditorForm, { action, event, options, mode: "organizer", submitLabel: "Zapisz zmiany" }));
  expect(html).toContain('value="Zachowany tytuł"');
  expect(html).not.toMatch(/<fieldset[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Zapisz zmiany/);
  expect(html).toMatch(/<button(?=[^>]*name="intent")(?=[^>]*value="resubmit")(?=[^>]*disabled="")[^>]*>/);
});

it("allows correcting a validation error without treating it as an uncertain save", () => {
  editorState.current = { fieldErrors: { title: "Podaj tytuł." }, error: "Popraw formularz." };
  const html = renderToStaticMarkup(createElement(EventEditorForm, { action, options, mode: "admin", submitLabel: "Dodaj wydarzenie" }));
  expect(html).not.toMatch(/<fieldset[^>]*disabled=""/);
  expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  expect(html).toContain('aria-invalid="true" aria-describedby="event-error-title"');
  expect(html).not.toContain("nowa karta");
});

it("allows a deliberate retry of an unconfirmed write only after explicit acknowledgement", () => {
  editorState.current = {
    fieldErrors: {}, error: "Sprawdź wynik zapisu.",
    saveIssue: { kind: "unconfirmed", editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" }
  };
  let html = renderToStaticMarkup(createElement(EventEditorForm, { action, options, mode: "organizer", submitLabel: "Dodaj wydarzenie" }));
  expect(html).toContain("Sprawdziłem listę i szczegóły: zapis nie został wykonany. Chcę ponowić próbę.");
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  editorState.acknowledged = true;
  html = renderToStaticMarkup(createElement(EventEditorForm, { action, options, mode: "organizer", submitLabel: "Dodaj wydarzenie" }));
  expect(html).toMatch(/<input(?=[^>]*type="checkbox")(?=[^>]*checked="")[^>]*>/);
  expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
});

it("keeps partial saves blocked even if a previous uncertainty acknowledgement remains checked", () => {
  editorState.acknowledged = true;
  editorState.current = {
    fieldErrors: {}, error: "Wydarzenie zapisano częściowo.",
    saveIssue: { kind: "partial", editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" }
  };
  const html = renderToStaticMarkup(createElement(EventEditorForm, { action, options, mode: "organizer", submitLabel: "Dodaj wydarzenie" }));
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  expect(html).not.toMatch(/<fieldset[^>]*disabled=""/);
  expect(html).not.toContain("Chcę ponowić próbę");
  expect(html).toContain("Możesz skopiować zachowane dane");
});

it("blocks controls and manual retry while a request is pending", () => {
  editorState.pending = true;
  editorState.acknowledged = true;
  editorState.current = {
    fieldErrors: {}, error: "Sprawdź wynik zapisu.",
    saveIssue: { kind: "unconfirmed", editHref: "/organizer/events/event-a/edit", listHref: "/organizer/events" }
  };
  const html = renderToStaticMarkup(createElement(EventEditorForm, { action, options, mode: "organizer", submitLabel: "Dodaj wydarzenie" }));
  expect(html).toMatch(/<fieldset[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  expect(html.split("<fieldset")[0]).toMatch(/<input(?=[^>]*type="checkbox")(?=[^>]*disabled="")[^>]*>/);
});
