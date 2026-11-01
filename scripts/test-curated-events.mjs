import assert from "node:assert/strict";
import test from "node:test";
import { assertOwnedSource, assertUnchangedPending, canonicalSourceUrl, eventKey, findDuplicate, localDay, normalizeText, validateBatch } from "./import-curated-events.mjs";

const now = new Date("2026-10-29T09:00:00Z");
const raw = {
  title: "Próba chóru", category_slug: "kultura", start_at: "2026-11-05T18:00:00+01:00",
  short_description: "Spotkanie chóralne.", description: "Otwarta próba chóru w Gdańsku.",
  location: { name: "Dom Kultury", address: "ul. Długa 1", city: "Gdańsk" },
  source_name: "Dom Kultury", source_url: "https://example.org/program?utm_source=test", price_type: "unknown"
};
const batch = events => ({ checked_at: "2026-10-29T09:00:00Z", events });
const existing = (candidate, overrides = {}) => ({
  id: "existing", title: candidate.title, start_at: candidate.start_at,
  location: { city: { name: "Gdańsk" } }, ...overrides
});

test("normalizacja polskich nazw, kanoniczne źródło i deterministyczny klucz", () => {
  assert.equal(normalizeText("  Łódź — ŻÓŁTA! "), "lodz zolta");
  assert.equal(canonicalSourceUrl("https://example.org/program/?b=2&utm_source=x&a=1#opis"), "https://example.org/program?a=1&b=2");
  assert.equal(eventKey("Próba chóru", "Gdańsk", "2026-11-05T18:00:00+01:00"), eventKey("Proba choru", "Gdansk", "2026-11-05T17:00:00Z"));
  assert.throws(() => canonicalSourceUrl("https://user:password@example.org/"));
});

test("czas warszawski i cena unknown pozostają jawne", () => {
  const candidate = validateBatch(batch([raw]), now).events[0];
  assert.equal(candidate.start_at, "2026-11-05T17:00:00.000Z");
  assert.equal(localDay("2026-11-05T23:30:00Z"), "2026-11-06");
  assert.equal(candidate.price_type, "unknown");
  assert.equal(candidate.price_min, null);
  assert.equal(candidate.price_max, null);
  assert.ok(candidate.slug.startsWith("curated-proba-choru-gdansk-2026-11-05-"));
});

test("walidacja odrzuca daty przeszłe, nieistniejące, bez offsetu i stare sprawdzenie", () => {
  for (const start_at of ["2026-10-28T18:00:00+01:00", "2026-11-31T18:00:00+01:00", "2026-11-05T18:00:00"]) {
    assert.throws(() => validateBatch(batch([{ ...raw, start_at }]), now));
  }
  assert.throws(() => validateBatch({ ...batch([raw]), checked_at: "2026-10-25T09:00:00Z" }, now));
  assert.throws(() => validateBatch(batch([{ ...raw, end_at: "2026-11-05T16:00:00+01:00" }]), now));
});

test("walidacja cen i współrzędnych blokuje nieprawdziwe wartości", () => {
  for (const fields of [
    { price_type: "unknown", price_min: 20 }, { price_type: "free", price_min: 20 },
    { price_type: "paid" }, { price_type: "paid", price_min: 40, price_max: 20 },
    { location: { ...raw.location, latitude: 54 } }, { location: { ...raw.location, latitude: 100, longitude: 18 } }
  ]) assert.throws(() => validateBatch(batch([{ ...raw, ...fields }]), now));
  const free = validateBatch(batch([{ ...raw, price_type: "free" }]), now).events[0];
  assert.deepEqual([free.price_min, free.price_max], [0, 0]);
});

test("różne pozycje jednego programu nie są duplikatami", () => {
  const candidates = validateBatch(batch([raw, { ...raw, title: "Warsztat literacki", start_at: "2026-11-06T18:00:00+01:00" }]), now).events;
  const catalog = { events: [existing(candidates[0])], sources: [{ event_id: "existing", source_url: candidates[0].source_url }] };
  assert.equal(findDuplicate(catalog, candidates[1]).duplicateId, null);
  assert.equal(findDuplicate(catalog, candidates[0]).duplicateId, "existing");
});

test("cross-source tytuł + lokalny dzień + miasto wykrywa duplikat", () => {
  const candidate = validateBatch(batch([raw]), now).events[0];
  const catalog = { events: [existing(candidate, { title: "PROBA CHORU", start_at: "2026-11-05T19:00:00+01:00" })], sources: [] };
  assert.equal(findDuplicate(catalog, candidate).duplicateId, "existing");
  catalog.events[0].location.city.name = "Gdynia";
  assert.equal(findDuplicate(catalog, candidate).duplicateId, null);
});

test("własny oczekujący rekord rozpoznawany tylko po slug i pełnym markerze", () => {
  const candidate = validateBatch(batch([raw]), now).events[0];
  const own = existing(candidate, { slug: candidate.slug, review_note: candidate.marker, status: "pending_review" });
  const catalog = { events: [own], sources: [{ event_id: own.id, external_id: `curated:${candidate.key}` }] };
  assert.equal(findDuplicate(catalog, candidate).own, own);
  assert.equal(findDuplicate(catalog, candidate).duplicateId, null);
  own.review_note = "Ręczna zmiana";
  assert.equal(findDuplicate(catalog, candidate).own, undefined);
  assert.equal(findDuplicate(catalog, candidate).duplicateId, own.id);
});

test("odzysk nie nadpisuje ręcznie zmienionego pending_review", () => {
  const payload = { title: "Próba chóru", start_at: "2026-11-05T17:00:00.000Z", end_at: null, status: "pending_review", organizer_id: null };
  assert.doesNotThrow(() => assertUnchangedPending({ ...payload, start_at: "2026-11-05T18:00:00+01:00" }, payload));
  assert.throws(() => assertUnchangedPending({ ...payload, title: "Ręczna korekta" }, payload), /title/);
  assert.throws(() => assertUnchangedPending({ ...payload, status: "rejected" }, payload), /status/);
});

test("przed publikacją źródło wymaga zgodnego URL, właściciela, typu i aktywności", () => {
  const candidate = validateBatch(batch([raw]), now).events[0];
  const source = { id: "source-1", event_id: "event-1", source_url: candidate.source_url,
    external_id: `curated:${candidate.key}`, source_type: "manual", is_active: true };
  assert.doesNotThrow(() => assertOwnedSource(source, candidate, "event-1"));
  for (const changed of [
    { source_url: "https://example.org/other-event" }, { source_url: "nie-url" }, { event_id: "other-event" },
    { external_id: "manually-edited" }, { source_type: "organizer" }, { is_active: false }, { is_active: null }
  ]) assert.throws(() => assertOwnedSource({ ...source, ...changed }, candidate, "event-1"), /ręcznego sprawdzenia/);
});
