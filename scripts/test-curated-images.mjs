import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { attachOne, assertOwnedEvent, checkpointMatches, imagePlan, imageType, insideWorkspace, signParams, validCloudinaryUrl, validateManifest } from "./enrich-curated-images.mjs";
import { eventKey } from "./import-curated-events.mjs";

const title = "Próba chóru";
const city = "Gdańsk";
const startAt = "2026-11-05T17:00:00.000Z";
const key = eventKey(title, city, startAt);
const eventId = "11111111-2222-4333-8444-555555555555";
const image = {
  event_id: eventId, title, city, start_at: startAt, key,
  source_url: "https://example.org/event", sha256: "a".repeat(64), prompt_sha256: "b".repeat(64),
  marker: `EventMap curated import v1; key=${key}; source=https://example.org/event`
};
const event = {
  id: eventId, title, start_at: startAt, slug: `curated-proba-choru-gdansk-${key.slice(0, 12)}`,
  review_note: image.marker, main_image_url: null, updated_at: "2026-10-29T20:00:00Z",
  status: "published", visibility: "public", is_cancelled: false,
  organizer_id: null, submitted_by_organizer_id: null, location: { city: { name: city } }
};
const publicId = `eventmap/events/curated-illustrations/${eventId}-${image.sha256.slice(0, 20)}`;
const secureUrl = `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.png`;
const proof = {
  event_id: eventId, key, sha256: image.sha256, prompt_sha256: image.prompt_sha256, source_url: image.source_url,
  public_id: publicId, secure_url: secureUrl, format: "png",
  image_url: secureUrl.replace("/image/upload/", "/image/upload/c_limit,w_1600,f_auto,q_auto/")
};
const config = { cloudName: "demo" };
const source = { id: "source-1", event_id: eventId, source_url: image.source_url, external_id: `curated:${key}`, source_type: "manual", is_active: true };

test("rozpoznanie obrazu bazuje na sygnaturze, nie nazwie pliku", () => {
  assert.equal(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(imageType(Buffer.from([255, 216, 255, 0])), "image/jpeg");
  assert.equal(imageType(Buffer.from("RIFF1234WEBP")), "image/webp");
  assert.throws(() => imageType(Buffer.from("<svg>not a bitmap</svg>")));
});

test("manifest odrzuca obce ścieżki, duplikaty i brak deklaracji ilustracji", () => {
  const scratch = path.resolve("scratch"); mkdirSync(scratch, { recursive: true });
  const fixtureRoot = mkdtempSync(path.join(scratch, "curated-image-test-"));
  const fixtureFile = path.join(fixtureRoot, "test.png");
  try {
    writeFileSync(fixtureFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const raw = { event_id: eventId, title, city, start_at: startAt, source_url: image.source_url,
      file: "test.png", prompt: "Original illustrated choir, no text.", generation_mode: "built-in-imagegen", illustration: true };
    const manifest = { generated_at: "2026-10-29T20:00:00Z", images: [raw] };
    assert.equal(validateManifest(manifest, fixtureRoot)[0].event_id, eventId);
    assert.throws(() => insideWorkspace("../outside.png", fixtureRoot));
    assert.throws(() => insideWorkspace(fixtureFile, fixtureRoot));
    assert.throws(() => validateManifest({ ...manifest, images: [raw, raw] }, fixtureRoot));
    assert.throws(() => validateManifest({ ...manifest, images: [{ ...raw, illustration: false }] }, fixtureRoot));
  } finally {
    rmSync(fixtureFile); rmdirSync(fixtureRoot);
  }
});

test("guard ogranicza zmiany do publicznych wydarzeń z pełnym markerem paczki", () => {
  assert.doesNotThrow(() => assertOwnedEvent(event, image));
  for (const changed of [
    { review_note: "manual" }, { status: "pending_review" }, { visibility: "private" }, { is_cancelled: true },
    { organizer_id: "someone" }, { submitted_by_organizer_id: "someone" }, { title: "Other" },
    { start_at: "2026-11-06T17:00:00Z" }, { location: { city: { name: "Gdynia" } } }, { slug: "old-import" }
  ]) assert.throws(() => assertOwnedEvent({ ...event, ...changed }, image));
});

test("checkpoint wiąże własny URL, plik, prompt, wydarzenie i źródło", () => {
  assert.equal(checkpointMatches(proof, image, "demo"), true);
  for (const changed of [
    { sha256: "c".repeat(64) }, { prompt_sha256: "c".repeat(64) }, { event_id: "other" },
    { image_url: "https://evil.example/image.png" }, { source_url: "https://example.org/other" },
    { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/other.png" }
  ]) assert.equal(checkpointMatches({ ...proof, ...changed }, image, "demo"), false);
  assert.throws(() => validCloudinaryUrl("https://res.cloudinary.com.evil.example/demo/image/upload/a.png", "demo"));
});

test("plan zachowuje cudzy obraz, a własny potwierdza tylko z checkpoint", () => {
  assert.equal(imagePlan(event, image, null, "demo"), "would_attach");
  assert.equal(imagePlan({ ...event, main_image_url: "" }, image, null, "demo"), "would_attach");
  assert.equal(imagePlan({ ...event, main_image_url: proof.image_url }, image, proof, "demo"), "already_attached");
  assert.equal(imagePlan({ ...event, main_image_url: proof.image_url }, image, null, "demo"), "preserved_existing_image");
});

test("podpis Cloudinary obejmuje parametry bez pliku i sekretu w wyniku", () => {
  const params = { timestamp: "123", folder: "eventmap/events", overwrite: "false", public_id: "illustration" };
  const expected = createHash("sha1").update("folder=eventmap/events&overwrite=false&public_id=illustration&timestamp=123secret").digest("hex");
  assert.equal(signParams(params, "secret"), expected);
});

function fakeClient({ stored = event, sourceRow = source, failMutation = false, publicUrl = proof.image_url } = {}) {
  const calls = [];
  return { calls, from(table) {
    const query = {
      mutation: false,
      select() { return this; },
      eq(field, value) { calls.push([table, this.mutation ? "mutation.eq" : "eq", field, value]); return this; },
      is(field, value) { calls.push([table, "mutation.is", field, value]); return this; },
      update(payload) { this.mutation = true; calls.push([table, "update", payload]); return this; },
      single() { return Promise.resolve({ data: this.mutation ? null : { ...stored, main_image_url: publicUrl }, error: null }); },
      maybeSingle() { return Promise.resolve(failMutation ? { data: null, error: null } : { data: { ...stored, main_image_url: proof.image_url }, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: table === "event_sources" ? [sourceRow] : stored, count: 1, error: null }).then(resolve, reject); }
    };
    // Event single() is read during upload; the public client is separate below.
    if (table === "events") query.single = () => Promise.resolve({ data: stored, error: null });
    return query;
  } };
}

function publicClient(url = proof.image_url) {
  const query = { select() { return this; }, eq() { return this; }, single() { return Promise.resolve({ data: { id: eventId, main_image_url: url }, error: null }); } };
  return { from() { return query; } };
}

test("przypisanie obrazu stosuje CAS i zmienia wyłącznie main_image_url", async () => {
  const client = fakeClient(); const saved = [];
  const result = await attachOne(client, publicClient(), image, event, proof, config, p => saved.push(p));
  assert.equal(result.outcome, "attached");
  assert.deepEqual(client.calls.find(c => c[1] === "update")[2], { main_image_url: proof.image_url });
  assert.ok(client.calls.some(c => c[1] === "mutation.is" && c[2] === "main_image_url" && c[3] === null));
  assert.ok(client.calls.some(c => c[1] === "mutation.eq" && c[2] === "updated_at" && c[3] === event.updated_at));
  assert.equal(saved.length, 1); assert.ok(saved[0].attached_at);
});

test("zmiana wydarzenia lub źródła podczas uploadu blokuje przypisanie", async () => {
  for (const client of [fakeClient({ stored: { ...event, updated_at: "changed" } }), fakeClient({ sourceRow: { ...source, is_active: false } })]) {
    await assert.rejects(() => attachOne(client, publicClient(), image, event, proof, config, () => {}));
    assert.equal(client.calls.some(c => c[1] === "update"), false);
  }
});

test("brak zmienionego wiersza i brak publicznego odczytu nie dają sukcesu", async () => {
  await assert.rejects(() => attachOne(fakeClient({ failMutation: true }), publicClient(), image, event, proof, config, () => {}), /Nie potwierdzono/);
  await assert.rejects(() => attachOne(fakeClient(), publicClient("other"), image, event, proof, config, () => {}), /anonimowego/);
});

test("checkpoint jest zachowany zaraz po uploadzie, przed zmianą rekordu", async () => {
  const client = fakeClient({ stored: { ...event, updated_at: "changed" } }); const saved = [];
  await assert.rejects(() => attachOne(client, publicClient(), image, event, null, config, p => saved.push(p), async () => proof));
  assert.equal(saved.length, 1); assert.deepEqual(saved[0], proof);
});
