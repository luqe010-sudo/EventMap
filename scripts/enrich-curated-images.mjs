import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { assertOwnedSource, canonicalSourceUrl, eventKey, normalizeText } from "./import-curated-events.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 5 * 1024 * 1024;
const EVENT_SELECT = "id,title,slug,start_at,status,visibility,is_cancelled,organizer_id,submitted_by_organizer_id,main_image_url,review_note,updated_at,location:locations(city:cities(name))";
const SOURCE_SELECT = "id,event_id,source_url,external_id,source_type,is_active";

function text(value, field, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Nieprawidłowe ${field}.`);
  return value.trim();
}

export function insideWorkspace(file, root = ROOT) {
  if (path.isAbsolute(file)) throw new Error("Ścieżka obrazu musi być względna do repozytorium.");
  const resolved = path.resolve(root, file);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error("Plik obrazu wychodzi poza workspace.");
  const actual = realpathSync(resolved);
  const actualRelative = path.relative(realpathSync(root), actual);
  if (actualRelative === ".." || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) throw new Error("Dowiązanie obrazu wychodzi poza workspace.");
  return actual;
}

export function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  throw new Error("Obsługiwane obrazy: PNG, JPG i WebP; rozszerzenie pliku nie wystarcza.");
}

export function validateManifest(manifest, root = ROOT) {
  if (!manifest || !Number.isFinite(Date.parse(manifest.generated_at))) throw new Error("Manifest wymaga generated_at.");
  if (!Array.isArray(manifest.images) || manifest.images.length < 1 || manifest.images.length > 50) throw new Error("Manifest musi zawierać 1–50 obrazów.");
  const ids = new Set();
  return manifest.images.map((raw, index) => {
    const eventId = text(raw.event_id, `images[${index}].event_id`, 36);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId) || ids.has(eventId)) throw new Error("Nieprawidłowy lub powtórzony event_id.");
    ids.add(eventId);
    if (raw.generation_mode !== "built-in-imagegen" || raw.illustration !== true) throw new Error("Manifest wymaga autorskiej ilustracji i generation_mode=built-in-imagegen.");
    const title = text(raw.title, "title", 300);
    const city = text(raw.city, "city", 200);
    const startAt = text(raw.start_at, "start_at", 40);
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(startAt) || !Number.isFinite(Date.parse(startAt))) throw new Error("start_at wymaga daty z offsetem.");
    const sourceUrl = canonicalSourceUrl(text(raw.source_url, "source_url"));
    const prompt = text(raw.prompt, "prompt", 30000);
    const file = text(raw.file, "file", 1000);
    const absoluteFile = insideWorkspace(file, root);
    const stat = statSync(absoluteFile);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_BYTES) throw new Error("Obraz musi być niepustym plikiem do 5 MB.");
    const bytes = readFileSync(absoluteFile);
    const mime = imageType(bytes);
    const key = eventKey(title, city, startAt);
    return {
      event_id: eventId, title, city, start_at: new Date(startAt).toISOString(), source_url: sourceUrl, prompt,
      file, absolute_file: absoluteFile, bytes, mime, key,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      prompt_sha256: createHash("sha256").update(prompt).digest("hex"),
      marker: `EventMap curated import v1; key=${key}; source=${sourceUrl}`
    };
  });
}

function one(value) { return Array.isArray(value) ? value[0] : value; }

export function assertOwnedEvent(event, image) {
  const city = one(one(event?.location)?.city)?.name;
  if (!event || event.id !== image.event_id || event.review_note !== image.marker || !event.slug?.startsWith("curated-")
    || !event.slug.endsWith(image.key.slice(0, 12)) || normalizeText(event.title) !== normalizeText(image.title)
    || new Date(event.start_at).toISOString() !== image.start_at || normalizeText(city) !== normalizeText(image.city)
    || event.status !== "published" || event.visibility !== "public" || event.is_cancelled !== false
    || event.organizer_id !== null || event.submitted_by_organizer_id !== null) {
    throw new Error("Wydarzenie nie jest własnym publicznym rekordem z tej paczki; obrazu nie zmieniono.");
  }
}

export function validCloudinaryUrl(value, cloudName) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password
    || !url.pathname.startsWith(`/${cloudName}/image/upload/`) || url.search || url.hash) throw new Error("Nieprawidłowy URL obrazu Cloudinary.");
  return url.toString();
}

export function checkpointMatches(checkpoint, image, cloudName) {
  try {
    return checkpoint?.event_id === image.event_id && checkpoint.key === image.key && checkpoint.sha256 === image.sha256
      && checkpoint.prompt_sha256 === image.prompt_sha256 && checkpoint.source_url === image.source_url
      && typeof checkpoint.public_id === "string" && checkpoint.public_id.endsWith(`${image.event_id}-${image.sha256.slice(0, 20)}`)
      && validCloudinaryUrl(checkpoint.image_url, cloudName) === checkpoint.image_url
      && validCloudinaryUrl(checkpoint.secure_url, cloudName) === checkpoint.secure_url
      && ["png", "jpg", "webp"].includes(checkpoint.format)
      && decodeURIComponent(new URL(checkpoint.secure_url).pathname).endsWith(`/${checkpoint.public_id}.${checkpoint.format}`)
      && checkpoint.image_url === checkpoint.secure_url.replace("/image/upload/", "/image/upload/c_limit,w_1600,f_auto,q_auto/");
  } catch { return false; }
}

export function imagePlan(event, image, checkpoint, cloudName) {
  assertOwnedEvent(event, image);
  if (event.main_image_url === null || event.main_image_url === "") return "would_attach";
  return checkpointMatches(checkpoint, image, cloudName) && event.main_image_url === checkpoint.image_url
    ? "already_attached" : "preserved_existing_image";
}

function cloudinaryConfig(env = process.env) {
  let cloudName = env.CLOUDINARY_CLOUD_NAME;
  let apiKey = env.CLOUDINARY_API_KEY;
  let apiSecret = env.CLOUDINARY_API_SECRET;
  if (env.CLOUDINARY_URL) {
    const url = new URL(env.CLOUDINARY_URL);
    if (url.protocol !== "cloudinary:") throw new Error("Nieprawidłowy protokół CLOUDINARY_URL.");
    cloudName = url.hostname; apiKey = decodeURIComponent(url.username); apiSecret = decodeURIComponent(url.password);
  }
  const clean = value => value?.trim().replace(/^<|>$/g, "");
  cloudName = clean(cloudName); apiKey = clean(apiKey); apiSecret = clean(apiSecret);
  if (!cloudName || !apiKey || !apiSecret || !/^[a-z0-9_-]+$/i.test(cloudName)) throw new Error("Brak poprawnej serwerowej konfiguracji Cloudinary.");
  const base = (env.CLOUDINARY_EVENT_FOLDER || "eventmap/events").replace(/\/+$/, "");
  if (!/^[a-z0-9/_-]+$/i.test(base)) throw new Error("Nieprawidłowy CLOUDINARY_EVENT_FOLDER.");
  return { cloudName, apiKey, apiSecret, folder: `${base}/curated-illustrations` };
}

export function signParams(params, secret) {
  const payload = Object.entries(params).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("&");
  return createHash("sha1").update(`${payload}${secret}`).digest("hex");
}

async function upload(image, config) {
  const params = {
    folder: config.folder, overwrite: "false", public_id: `${image.event_id}-${image.sha256.slice(0, 20)}`,
    timestamp: Math.floor(Date.now() / 1000).toString()
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  form.set("api_key", config.apiKey); form.set("signature", signParams(params, config.apiSecret));
  form.set("file", new Blob([image.bytes], { type: image.mime }), path.basename(image.file));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST", body: form, signal: AbortSignal.timeout(90000)
  });
  // Never print the provider's complete error body: it may echo signed parameters.
  if (!response.ok) throw new Error(`Upload Cloudinary HTTP ${response.status}; żaden URL nie został przypisany.`);
  const body = await response.json();
  const secureUrl = validCloudinaryUrl(body.secure_url, config.cloudName);
  if (body.public_id !== `${config.folder}/${params.public_id}` || !Number.isInteger(body.width) || body.width < 200
    || !Number.isInteger(body.height) || body.height < 200 || !["png", "jpg", "webp"].includes(body.format)) throw new Error("Nie potwierdzono identyfikatora lub wymiarów uploadu.");
  return {
    event_id: image.event_id, key: image.key, sha256: image.sha256, prompt_sha256: image.prompt_sha256,
    source_url: image.source_url, public_id: body.public_id, secure_url: secureUrl,
    image_url: secureUrl.replace("/image/upload/", "/image/upload/c_limit,w_1600,f_auto,q_auto/"),
    width: body.width, height: body.height, bytes: body.bytes, format: body.format,
    generation_mode: "built-in-imagegen", uploaded_at: new Date().toISOString()
  };
}

async function readState(client, image) {
  const [eventResult, sourceResult] = await Promise.all([
    client.from("events").select(EVENT_SELECT).eq("id", image.event_id).single(),
    client.from("event_sources").select(SOURCE_SELECT, { count: "exact" }).eq("event_id", image.event_id)
  ]);
  if (eventResult.error || sourceResult.error) throw new Error("Nie udało się odczytać wydarzenia i jego źródła.");
  if (sourceResult.count !== sourceResult.data.length) throw new Error("Niepełny odczyt źródeł wydarzenia.");
  assertOwnedEvent(eventResult.data, image);
  const owned = sourceResult.data.filter(source => source.external_id === `curated:${image.key}`);
  if (owned.length !== 1) throw new Error("Brak jednoznacznego źródła redakcyjnego.");
  assertOwnedSource(owned[0], image, image.event_id);
  return eventResult.data;
}

function saveJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const pending = `${file}.writing-${process.pid}`;
  writeFileSync(pending, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(pending, file);
}

export async function attachOne(client, anonymous, image, initial, proof, config, saveProof, uploadImage = upload) {
  const outcome = imagePlan(initial, image, proof, config.cloudName);
  if (outcome === "already_attached") {
    await assertPublicImage(anonymous, image.event_id, proof.image_url);
    return { outcome, image_url: proof.image_url, public_read_confirmed: true };
  }
  if (outcome === "preserved_existing_image") return { outcome, image_url: initial.main_image_url };
  if (proof && !checkpointMatches(proof, image, config.cloudName)) throw new Error("Checkpoint nie pasuje do ilustracji; nie wykonano uploadu.");
  if (!proof) { proof = await uploadImage(image, config); saveProof(proof); }
  const fresh = await readState(client, image);
  if (fresh.main_image_url !== initial.main_image_url || fresh.updated_at !== initial.updated_at) throw new Error("Wydarzenie zmieniło się podczas uploadu; obraz zachowano w checkpoint, bez podmiany rekordu.");
  let mutation = client.from("events").update({ main_image_url: proof.image_url })
    .eq("id", image.event_id).eq("review_note", image.marker).eq("slug", initial.slug)
    .eq("status", "published").eq("visibility", "public").eq("is_cancelled", false)
    .is("organizer_id", null).is("submitted_by_organizer_id", null);
  mutation = initial.main_image_url === null ? mutation.is("main_image_url", null) : mutation.eq("main_image_url", "");
  mutation = initial.updated_at === null ? mutation.is("updated_at", null) : mutation.eq("updated_at", initial.updated_at);
  const written = await mutation.select("id,main_image_url,status,visibility,is_cancelled").maybeSingle();
  if (written.error || written.data?.main_image_url !== proof.image_url || written.data?.status !== "published") throw new Error("Nie potwierdzono przypisania obrazu; sprawdź stan rekordu i checkpoint.");
  await assertPublicImage(anonymous, image.event_id, proof.image_url);
  saveProof({ ...proof, attached_at: new Date().toISOString() });
  return { outcome: "attached", image_url: proof.image_url, public_read_confirmed: true };
}

async function assertPublicImage(anonymous, eventId, imageUrl) {
  const publicRead = await anonymous.from("events").select("id,main_image_url,status,visibility,is_cancelled")
    .eq("id", eventId).eq("status", "published").eq("visibility", "public").eq("is_cancelled", false).single();
  if (publicRead.error || publicRead.data?.main_image_url !== imageUrl) throw new Error("Obraz zapisano, lecz nie potwierdzono anonimowego odczytu.");
}

async function main() {
  let file; let apply = false;
  for (let index = 2; index < process.argv.length; index++) {
    if (process.argv[index] === "--file") file = process.argv[++index];
    else if (process.argv[index] === "--apply") apply = true;
    else throw new Error("Użycie: --file <manifest.json> [--apply].");
  }
  if (!file) throw new Error("Wymagany --file <manifest.json>.");
  if (apply && process.env.EVENTMAP_IMPORT_WRITE !== "1") throw new Error("Zapis wymaga EVENTMAP_IMPORT_WRITE=1 i --apply.");
  const images = validateManifest(JSON.parse(readFileSync(path.resolve(ROOT, file), "utf8")));
  const config = cloudinaryConfig();
  const serviceKey = process.env.EVENTMAP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceKey || !publicKey) throw new Error("Brak serwerowej/publicznej konfiguracji Supabase.");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(url, serviceKey, clientOptions); const anonymous = createClient(url, publicKey, clientOptions);
  const stateDir = path.join(ROOT, "scratch", "curated-images"); mkdirSync(stateDir, { recursive: true });
  const lockFile = path.join(ROOT, "scratch", "curated-import.lock");
  let lock;
  try { lock = openSync(lockFile, "wx"); }
  catch (error) { if (error.code === "EEXIST") throw new Error("Aktywny import lub wzbogacanie obrazów: sprawdź scratch/curated-import.lock."); throw error; }
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString(), mode: "images" }));
    // Validate ownership/source of the entire batch before any external write.
    const initial = [];
    for (const image of images) initial.push(await readState(client, image));
    const report = { mode: apply ? "apply" : "dry-run", results: [] };
    for (const [index, image] of images.entries()) {
      const proofFile = path.join(stateDir, `${image.event_id}.json`);
      const proof = existsSync(proofFile) ? JSON.parse(readFileSync(proofFile, "utf8")) : null;
      try {
        const result = apply ? await attachOne(client, anonymous, image, initial[index], proof, config, value => saveJson(proofFile, value))
          : { outcome: imagePlan(initial[index], image, proof, config.cloudName), checkpoint_reusable: checkpointMatches(proof, image, config.cloudName) };
        report.results.push({ event_id: image.event_id, title: image.title, file: image.file, sha256: image.sha256, ...result });
      } catch (error) {
        report.results.push({ event_id: image.event_id, title: image.title, outcome: "failed", error: error.message });
        process.exitCode = 1; break;
      }
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { closeSync(lock); rmSync(lockFile); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
