import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_FILE = "scraping/ebilet_muzyka_v3.json";
const DEFAULT_CHECKPOINT_FILE = "importers/ebilet/.import-state.json";
const DEFAULT_AI_DEBUG_DIR = "importers/ebilet/.ai-debug";
const DEFAULT_TIMEZONE = "Europe/Warsaw";
const DEFAULT_ORGANIZER_ID = "51206165-f555-4cc0-9f96-ba26e36f02b4";
const DEFAULT_GEOCODE_DELAY_MS = 1100;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";
const GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-flash-latest"];
const DEFAULT_AI_DELAY_MS = 4000;
const DEFAULT_AI_RETRIES = 3;
const DEFAULT_AI_RETRY_DELAY_MS = 10000;
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "MapaImprez.pl/1.0 (eventmap-ebilet-importer)";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const GEMINI_GENERATE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const ALLOWED_STATUSES = new Set(["draft", "pending_review", "published", "rejected", "archived"]);
const CATEGORY_ALIASES = new Map([
  ["koncert", "koncerty"]
]);
let lastGeocodeRequestAt = 0;
let lastAiRequestAt = 0;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
  loadEnvFile(path.join("importers", "ebilet", ".env"));

  const options = parseArgs(process.argv.slice(2));
  applyResumeCheckpoint(options);
  const inputPath = path.resolve(options.file);
  const payload = readInput(inputPath);
  const rows = payload.events.slice(options.offset, options.offset + options.limit);

  if (!rows.length) {
    throw new Error(`Brak rekordow do importu dla offset=${options.offset}, limit=${options.limit}.`);
  }

  if (!options.apply) {
    printDryRun(payload, rows, options);
    return;
  }

  assertWritableImportEnabled();
  if (options.rewriteAi) resolveAiProvider(options);
  const supabase = createSupabaseServiceClient();
  const result = {
    inserted: 0,
    skippedDuplicates: 0,
    failed: 0
  };

  for (const [localIndex, rawEvent] of rows.entries()) {
    const sourceIndex = options.offset + localIndex;

    try {
      const imported = await importEvent(supabase, rawEvent, payload.scraped_at, options);
      if (imported.skipped) {
        result.skippedDuplicates += 1;
        console.log(`[skip] #${sourceIndex} ${rawEvent.title} - duplikat source external_id=${imported.externalId}`);
      } else {
        result.inserted += 1;
        console.log(`[ok] #${sourceIndex} ${rawEvent.title} -> event_id=${imported.eventId}`);
      }
      writeCheckpoint(options.checkpointFile, {
        file: path.relative(process.cwd(), inputPath),
        next_offset: sourceIndex + 1,
        last_processed_index: sourceIndex,
        last_event_title: rawEvent.title ?? null,
        last_event_id: imported.eventId ?? null,
        last_external_id: imported.externalId,
        last_status: imported.skipped ? "skipped_duplicate" : "inserted",
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      result.failed += 1;
      console.error(`[fail] #${sourceIndex} ${rawEvent.title ?? "(bez tytulu)"}: ${error.message}`);
      if (options.stopOnError) throw error;
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(args) {
  const options = {
    file: DEFAULT_FILE,
    limit: 1,
    offset: 0,
    apply: false,
    status: "pending_review",
    sourceType: "scraped",
    timezone: DEFAULT_TIMEZONE,
    organizerId: DEFAULT_ORGANIZER_ID,
    checkpointFile: DEFAULT_CHECKPOINT_FILE,
    geocode: true,
    geocodeExisting: true,
    geocodeDelayMs: DEFAULT_GEOCODE_DELAY_MS,
    rewriteAi: false,
    rewriteAiExisting: false,
    aiProvider: process.env.EVENTMAP_AI_PROVIDER ?? "auto",
    aiModel: process.env.AI_REWRITE_MODEL
      ?? process.env.OPENROUTER_REWRITE_MODEL
      ?? process.env.OPENAI_REWRITE_MODEL
      ?? process.env.GEMINI_REWRITE_MODEL
      ?? null,
    aiDelayMs: DEFAULT_AI_DELAY_MS,
    aiRetries: DEFAULT_AI_RETRIES,
    aiRetryDelayMs: DEFAULT_AI_RETRY_DELAY_MS,
    resume: false,
    offsetWasSet: false,
    stopOnError: true
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name, inlineValue] = arg.split("=", 2);
    const nextValue = () => inlineValue ?? args[++index];

    switch (name) {
      case "--file":
        options.file = requireValue(name, nextValue());
        break;
      case "--limit":
        options.limit = parsePositiveInteger(name, nextValue());
        break;
      case "--offset":
        options.offset = parseNonNegativeInteger(name, nextValue());
        options.offsetWasSet = true;
        break;
      case "--index":
        options.offset = parseNonNegativeInteger(name, nextValue());
        options.limit = 1;
        options.offsetWasSet = true;
        break;
      case "--status": {
        const status = requireValue(name, nextValue());
        if (!ALLOWED_STATUSES.has(status)) {
          throw new Error(`Nieprawidlowy status: ${status}. Dozwolone: ${[...ALLOWED_STATUSES].join(", ")}.`);
        }
        options.status = status;
        break;
      }
      case "--source-type":
        options.sourceType = requireValue(name, nextValue());
        break;
      case "--timezone":
        options.timezone = requireValue(name, nextValue());
        break;
      case "--organizer-id":
        options.organizerId = requireValue(name, nextValue());
        break;
      case "--checkpoint-file":
        options.checkpointFile = requireValue(name, nextValue());
        break;
      case "--geocode-delay-ms":
        options.geocodeDelayMs = parseNonNegativeInteger(name, nextValue());
        break;
      case "--no-geocode":
        options.geocode = false;
        break;
      case "--no-geocode-existing":
        options.geocodeExisting = false;
        break;
      case "--rewrite-ai":
        options.rewriteAi = true;
        break;
      case "--rewrite-ai-existing":
        options.rewriteAiExisting = true;
        break;
      case "--ai-provider":
        options.aiProvider = requireValue(name, nextValue());
        break;
      case "--ai-model":
        options.aiModel = requireValue(name, nextValue());
        break;
      case "--ai-delay-ms":
        options.aiDelayMs = parseNonNegativeInteger(name, nextValue());
        break;
      case "--ai-retries":
        options.aiRetries = parseNonNegativeInteger(name, nextValue());
        break;
      case "--ai-retry-delay-ms":
        options.aiRetryDelayMs = parseNonNegativeInteger(name, nextValue());
        break;
      case "--resume":
        options.resume = true;
        break;
      case "--continue-on-error":
        options.stopOnError = false;
        break;
      case "--apply":
        options.apply = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Nieznana opcja: ${arg}. Uzyj --help.`);
    }
  }

  return options;
}

function readInput(inputPath) {
  const parsed = JSON.parse(readFileSync(inputPath, "utf8"));
  if (!Array.isArray(parsed.events)) {
    throw new Error(`Plik ${inputPath} nie zawiera tablicy events.`);
  }
  return parsed;
}

function applyResumeCheckpoint(options) {
  if (!options.resume || options.offsetWasSet) return;

  const checkpoint = readCheckpoint(options.checkpointFile);
  if (!checkpoint) return;

  const nextOffset = Number(checkpoint.next_offset);
  if (!Number.isInteger(nextOffset) || nextOffset < 0) {
    throw new Error(`Nieprawidlowy checkpoint ${options.checkpointFile}: next_offset musi byc liczba >= 0.`);
  }

  options.offset = nextOffset;
}

function readCheckpoint(checkpointFile) {
  const checkpointPath = path.resolve(checkpointFile);
  if (!existsSync(checkpointPath)) return null;
  return JSON.parse(readFileSync(checkpointPath, "utf8"));
}

function writeCheckpoint(checkpointFile, checkpoint) {
  const checkpointPath = path.resolve(checkpointFile);
  mkdirSync(path.dirname(checkpointPath), { recursive: true });
  writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

function printDryRun(payload, rows, options) {
  const preview = rows.map((rawEvent, index) => {
    const mapped = buildMappedEvent(rawEvent, payload.scraped_at, options);
    return {
      source_index: options.offset + index,
      event: mapped.event,
      location: mapped.location,
      city: mapped.city,
      source: mapped.source,
      target_organizer_id: options.organizerId,
      organizer_name: normalizeString(rawEvent.organizer),
      tags: rawEvent.tags ?? [],
      performers: rawEvent.performers ?? []
    };
  });

  console.log(JSON.stringify({
    mode: "dry-run",
    file_total_events: payload.total_events,
    selected_events: rows.length,
    offset: options.offset,
    checkpoint_file: options.checkpointFile,
    geocode_on_apply: options.geocode,
    geocode_existing_on_apply: options.geocodeExisting,
    rewrite_ai_on_apply: options.rewriteAi,
    rewrite_ai_existing_on_apply: options.rewriteAiExisting,
    ai_provider: resolveAiProviderName(options),
    ai_model: resolveAiModel(options),
    ai_retries: options.aiRetries,
    ai_retry_delay_ms: options.aiRetryDelayMs,
    resume: options.resume,
    note: "Nie zapisano nic do bazy. Dodaj --apply oraz EVENTMAP_IMPORT_WRITE=1, aby wykonac zapis.",
    preview
  }, null, 2));
}

async function importEvent(supabase, rawEvent, scrapedAt, options) {
  const mapped = buildMappedEvent(rawEvent, scrapedAt, options);
  const existing = await findExistingSource(supabase, mapped.source.external_id);

  if (existing?.id) {
    await maybeGeocodeExistingEventLocation(supabase, existing.event_id, mapped, options);
    if (options.rewriteAi && options.rewriteAiExisting) {
      await rewriteExistingEventDescriptions(supabase, existing.event_id, mapped, options);
    }
    return {
      skipped: true,
      eventId: existing.event_id,
      externalId: mapped.source.external_id
    };
  }

  const categoryId = await resolveCategoryId(supabase, mapped.categoryName);
  const rewritten = options.rewriteAi ? await rewriteEventDescriptions(mapped, options) : null;
  const cityId = await findOrCreateCity(supabase, mapped.city);
  const locationId = await findOrCreateLocation(supabase, {
    ...mapped.location,
    city_id: cityId
  }, mapped.city.name, options);
  const organizerId = await resolveOrganizerId(supabase, mapped.organizerName, options.organizerId);

  const eventPayload = {
    ...mapped.event,
    ...(rewritten ? {
      short_description: rewritten.short_description,
      description: rewritten.description
    } : {}),
    category_id: categoryId,
    location_id: locationId,
    organizer_id: organizerId,
    submitted_by_organizer_id: organizerId
  };

  const { data: insertedEvent, error: eventError } = await supabase
    .from("events")
    .insert(eventPayload)
    .select("id")
    .single();

  if (eventError) throw new Error(`Nie udalo sie zapisac events: ${eventError.message}`);

  const { error: sourceError } = await supabase.from("event_sources").insert({
    ...mapped.source,
    event_id: insertedEvent.id
  });

  if (sourceError) {
    await supabase.from("events").delete().eq("id", insertedEvent.id);
    throw new Error(`Nie udalo sie zapisac event_sources: ${sourceError.message}`);
  }

  return {
    skipped: false,
    eventId: insertedEvent.id,
    externalId: mapped.source.external_id
  };
}

function buildMappedEvent(rawEvent, scrapedAt, options) {
  assertRawEvent(rawEvent);

  const title = normalizeString(rawEvent.title);
  const description = htmlToText(rawEvent.description);
  const shortDescription = htmlToText(rawEvent.short_description);
  const cityName = normalizeString(rawEvent.location.city);
  const locationName = normalizeString(rawEvent.location.name);
  const sourceName = normalizeString(rawEvent.source_name) ?? "ebilet";
  const sourceUrl = normalizeString(rawEvent.source_url);
  const startAt = toOffsetDateTime(rawEvent.start_at, options.timezone);
  const endAt = resolveEndAt(rawEvent.start_at, rawEvent.end_at, options.timezone);
  const externalId = buildExternalId(rawEvent, sourceName);
  const slug = buildEventSlug(title, cityName, rawEvent.start_at, externalId);

  return {
    categoryName: normalizeString(rawEvent.category),
    organizerName: normalizeString(rawEvent.organizer),
    city: {
      name: cityName,
      slug: createSlug(cityName),
      is_active: true,
      latitude: nullableNumber(rawEvent.location.latitude),
      longitude: nullableNumber(rawEvent.location.longitude),
      voivodeship: normalizeString(rawEvent.location.voivodeship)
    },
    location: {
      name: locationName,
      address: normalizeString(rawEvent.location.address),
      latitude: nullableNumber(rawEvent.location.latitude),
      longitude: nullableNumber(rawEvent.location.longitude),
      postal_code: null,
      voivodeship: normalizeString(rawEvent.location.voivodeship),
      county: null,
      municipality: null,
      google_maps_url: normalizeString(rawEvent.location.google_maps_url)
    },
    event: {
      title,
      slug,
      description,
      short_description: shortDescription,
      start_at: startAt,
      end_at: endAt,
      is_all_day: Boolean(rawEvent.is_all_day),
      main_image_url: normalizeString(rawEvent.main_image_url),
      price_type: normalizeString(rawEvent.price_type) ?? inferPriceType(rawEvent),
      price_min: nullableNumber(rawEvent.price_min),
      price_max: nullableNumber(rawEvent.price_max),
      currency: normalizeString(rawEvent.currency) ?? "PLN",
      status: options.status,
      visibility: normalizeString(rawEvent.visibility) ?? "public",
      is_featured: Boolean(rawEvent.is_featured),
      is_verified: Boolean(rawEvent.is_verified),
      is_cancelled: Boolean(rawEvent.is_cancelled),
      published_at: options.status === "published" ? new Date().toISOString() : null,
      timezone: options.timezone
    },
    source: {
      source_name: sourceName,
      source_url: sourceUrl,
      source_type: options.sourceType,
      external_id: externalId,
      raw_title: title,
      raw_description: description,
      raw_date: normalizeString(rawEvent.start_at),
      raw_image_url: normalizeString(rawEvent.main_image_url),
      raw_location: [locationName, rawEvent.location.address, cityName].map(normalizeString).filter(Boolean).join(", "),
      scraped_at: scrapedAt ? new Date(scrapedAt).toISOString() : null,
      last_seen_at: new Date().toISOString(),
      is_active: true
    }
  };
}

function assertRawEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") throw new Error("Rekord wydarzenia nie jest obiektem.");
  if (!normalizeString(rawEvent.title)) throw new Error("Brak title.");
  if (!normalizeString(rawEvent.start_at)) throw new Error("Brak start_at.");
  if (!normalizeString(rawEvent.category)) throw new Error("Brak category.");
  if (!normalizeString(rawEvent.location?.city)) throw new Error("Brak location.city.");
  if (!normalizeString(rawEvent.source_url)) throw new Error("Brak source_url.");
}

async function findExistingSource(supabase, externalId) {
  const { data, error } = await supabase
    .from("event_sources")
    .select("id, event_id")
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie sprawdzic duplikatu: ${error.message}`);
  return data;
}

async function resolveCategoryId(supabase, categoryName) {
  const wantedSlug = CATEGORY_ALIASES.get(createSlug(categoryName)) ?? createSlug(categoryName);
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug");

  if (error) throw new Error(`Nie udalo sie pobrac kategorii: ${error.message}`);

  const category = data.find((row) => row.slug === wantedSlug)
    ?? data.find((row) => row.name.toLocaleLowerCase("pl-PL") === categoryName.toLocaleLowerCase("pl-PL"));

  if (!category) {
    throw new Error(`Brak kategorii "${categoryName}" w tabeli categories. Utworz ja w panelu admina albo zmien dane importu.`);
  }

  return category.id;
}

async function findOrCreateCity(supabase, city) {
  const { data: existing, error: existingError } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", city.slug)
    .maybeSingle();

  if (existingError) throw new Error(`Nie udalo sie sprawdzic miasta: ${existingError.message}`);
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await supabase
    .from("cities")
    .insert(city)
    .select("id")
    .single();

  if (insertError) throw new Error(`Nie udalo sie utworzyc miasta "${city.name}": ${insertError.message}`);
  return inserted.id;
}

async function findOrCreateLocation(supabase, location, cityName, options) {
  let query = supabase
    .from("locations")
    .select("id, name, address, latitude, longitude, postal_code, voivodeship, county, municipality, google_maps_url")
    .eq("city_id", location.city_id)
    .eq("name", location.name ?? "");

  if (location.address) {
    query = query.eq("address", location.address);
  } else {
    query = query.is("address", null);
  }

  const { data: existing, error: existingError } = await query.limit(1);
  if (existingError) throw new Error(`Nie udalo sie sprawdzic lokalizacji: ${existingError.message}`);
  if (existing?.[0]?.id) {
    await geocodeAndUpdateLocationIfNeeded(supabase, existing[0], cityName, options);
    return existing[0].id;
  }

  const locationToInsert = await enrichLocationWithGeocoding(location, cityName, options);

  const { data: inserted, error: insertError } = await supabase
    .from("locations")
    .insert(locationToInsert)
    .select("id")
    .single();

  if (insertError) throw new Error(`Nie udalo sie utworzyc lokalizacji "${location.name}": ${insertError.message}`);
  return inserted.id;
}

async function maybeGeocodeExistingEventLocation(supabase, eventId, mapped, options) {
  if (!options.geocode || !options.geocodeExisting) return;

  const { data, error } = await supabase
    .from("events")
    .select("location:locations(id, name, address, latitude, longitude, postal_code, voivodeship, county, municipality, google_maps_url, city:cities(name))")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(`Nie udalo sie pobrac lokalizacji istniejacego wydarzenia: ${error.message}`);
  const location = data?.location;
  if (!location?.id) return;

  await geocodeAndUpdateLocationIfNeeded(
    supabase,
    location,
    location.city?.name ?? mapped.city.name,
    options
  );
}

async function geocodeAndUpdateLocationIfNeeded(supabase, location, cityName, options) {
  if (!options.geocode || hasCoordinates(location)) return false;

  const enriched = await enrichLocationWithGeocoding(location, cityName, options);
  if (!hasCoordinates(enriched)) return false;

  const updatePayload = {
    latitude: enriched.latitude,
    longitude: enriched.longitude,
    postal_code: location.postal_code ?? enriched.postal_code ?? null,
    voivodeship: location.voivodeship ?? enriched.voivodeship ?? null,
    county: location.county ?? enriched.county ?? null,
    municipality: location.municipality ?? enriched.municipality ?? null,
    google_maps_url: location.google_maps_url ?? enriched.google_maps_url ?? null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("locations")
    .update(updatePayload)
    .eq("id", location.id);

  if (error) throw new Error(`Nie udalo sie zaktualizowac geokodowania lokalizacji: ${error.message}`);
  console.log(`[geo] uzupelniono lokalizacje ${formatLocationLabel(location, cityName)} -> ${enriched.latitude}, ${enriched.longitude}`);
  return true;
}

async function enrichLocationWithGeocoding(location, cityName, options) {
  if (!options.geocode || hasCoordinates(location)) return location;

  const geocoded = await geocodeLocation(location, cityName, options);
  if (!geocoded) {
    console.warn(`[geo] brak wyniku dla ${formatLocationLabel(location, cityName)}`);
    return location;
  }

  console.log(`[geo] ${formatLocationLabel(location, cityName)} -> ${geocoded.latitude}, ${geocoded.longitude}`);

  return {
    ...location,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    postal_code: location.postal_code ?? geocoded.postalCode,
    voivodeship: location.voivodeship ?? geocoded.voivodeship,
    county: location.county ?? geocoded.county,
    municipality: location.municipality ?? geocoded.municipality,
    google_maps_url: location.google_maps_url ?? buildGoogleMapsUrl(geocoded.latitude, geocoded.longitude)
  };
}

async function resolveOrganizerId(supabase, organizerName, defaultOrganizerId) {
  if (defaultOrganizerId) {
    const { data, error } = await supabase
      .from("organizers")
      .select("id")
      .eq("id", defaultOrganizerId)
      .maybeSingle();

    if (error) throw new Error(`Nie udalo sie sprawdzic domyslnego organizatora: ${error.message}`);
    if (!data?.id) {
      throw new Error(`Brak domyslnego organizatora o id ${defaultOrganizerId} w tabeli organizers.`);
    }

    return data.id;
  }

  return findOrganizerIdByName(supabase, organizerName);
}

async function findOrganizerIdByName(supabase, organizerName) {
  if (!organizerName) return null;

  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug");

  if (error) throw new Error(`Nie udalo sie pobrac organizatorow: ${error.message}`);

  const wantedSlug = createSlug(organizerName);
  const organizer = data.find((row) => row.slug === wantedSlug)
    ?? data.find((row) => row.name.toLocaleLowerCase("pl-PL") === organizerName.toLocaleLowerCase("pl-PL"));

  return organizer?.id ?? null;
}

async function rewriteExistingEventDescriptions(supabase, eventId, mapped, options) {
  const rewritten = await rewriteEventDescriptions(mapped, options);

  const { error } = await supabase
    .from("events")
    .update({
      short_description: rewritten.short_description,
      description: rewritten.description,
      updated_at: new Date().toISOString()
    })
    .eq("id", eventId);

  if (error) throw new Error(`Nie udalo sie zaktualizowac opisow AI: ${error.message}`);
  console.log(`[ai] zaktualizowano opisy istniejacego wydarzenia ${eventId}`);
}

async function rewriteEventDescriptions(mapped, options) {
  const provider = resolveAiProvider(options);
  await throttleAi(options.aiDelayMs);

  const parsed = provider.name === "gemini"
    ? await rewriteWithGemini(mapped, provider, options)
    : provider.name === "openrouter"
      ? await rewriteWithOpenRouter(mapped, provider, options)
      : await rewriteWithOpenAi(mapped, provider);

  const rewritten = {
    short_description: normalizeAiString(parsed.short_description),
    description: normalizeAiString(parsed.description)
  };

  if (!rewritten.short_description || !rewritten.description) {
    throw new Error(`${provider.label} rewrite failed: odpowiedz nie zawiera opisow.`);
  }

  console.log(`[ai:${provider.name}] przeredagowano opisy: ${mapped.event.title}`);
  return rewritten;
}

async function rewriteWithOpenAi(mapped, provider) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      instructions: buildRewriteInstructions(),
      input: JSON.stringify(buildAiRewriteInput(mapped), null, 2),
      max_output_tokens: 1100,
      text: {
        format: {
          type: "json_schema",
          name: "event_description_rewrite",
          strict: true,
          schema: buildRewriteJsonSchema()
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`OpenAI rewrite failed: ${message}`);
  }

  const text = extractResponseText(payload);
  if (!text) throw new Error("OpenAI rewrite failed: pusta odpowiedz modelu.");
  return parseAiJsonResponse(text, "OpenAI");
}

async function rewriteWithOpenRouter(mapped, provider, options) {
  let lastError = null;
  let lastText = "";
  let lastPayload = null;

  for (let retry = 0; retry <= options.aiRetries; retry += 1) {
    try {
      const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mapaimprez.pl",
          "X-Title": "EventMap eBilet Importer"
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: "system",
              content: buildRewriteInstructions()
            },
            {
              role: "user",
              content: `Dane wydarzenia JSON:\n${JSON.stringify(buildAiRewriteInput(mapped), null, 2)}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "event_description_rewrite",
              strict: true,
              schema: buildRewriteJsonSchema()
            }
          },
          temperature: 0.5,
          max_tokens: 1200
        })
      });

      const payload = await response.json().catch(() => null);
      lastPayload = payload;

      if (!response.ok) {
        const message = payload?.error?.message ?? `HTTP ${response.status}`;
        throw new Error(`OpenRouter rewrite failed: ${message}`);
      }

      const choiceError = payload?.choices?.[0]?.error;
      if (choiceError) {
        const code = choiceError.code ? `${choiceError.code} ` : "";
        throw new Error(`OpenRouter rewrite failed: ${code}${choiceError.message ?? "upstream provider error"}`);
      }

      const text = extractOpenRouterResponseText(payload);
      lastText = text;
      if (!text) throw new Error("OpenRouter rewrite failed: pusta odpowiedz modelu.");
      return parseAiJsonResponse(text, "OpenRouter");
    } catch (error) {
      lastError = error;
      if (!isRetryableAiError(error)) break;
      if (retry >= options.aiRetries) break;

      const delay = getAiRetryDelay(options.aiRetryDelayMs, retry, error);
      console.warn(`[ai:openrouter] ${formatErrorMessage(error)}. Ponawiam za ${Math.round(delay / 1000)} s (${retry + 1}/${options.aiRetries})...`);
      await wait(delay);
    }
  }

  writeAiDebugDump("openrouter", mapped, lastText, lastPayload);
  throw lastError;
}

async function rewriteWithGemini(mapped, provider, options) {
  const attempts = [
    { compact: false, maxOutputTokens: 4096 },
    { compact: true, maxOutputTokens: 4096 }
  ];
  let lastError = null;
  let lastText = "";
  let lastPayload = null;

  for (const model of getGeminiModelCandidates(provider.model)) {
    for (const attempt of attempts) {
      for (let retry = 0; retry <= options.aiRetries; retry += 1) {
        try {
          const result = await requestGeminiRewrite(mapped, { ...provider, model }, attempt);
          lastText = result.text;
          lastPayload = result.payload;
          return parseAiJsonResponse(result.text, "Gemini");
        } catch (error) {
          lastError = error;

          if (!isRetryableGeminiError(error)) break;
          if (retry >= options.aiRetries) break;

          const delay = getAiRetryDelay(options.aiRetryDelayMs, retry, error);
          console.warn(`[ai:gemini] ${formatErrorMessage(error)}. Ponawiam za ${Math.round(delay / 1000)} s (${retry + 1}/${options.aiRetries})...`);
          await wait(delay);
        }
      }
    }
  }

  writeAiDebugDump("gemini", mapped, lastText, lastPayload);
  throw lastError;
}

function getGeminiModelCandidates(primaryModel) {
  return uniqueStrings([primaryModel, ...GEMINI_FALLBACK_MODELS]);
}

function isRetryableGeminiError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("limit: 0")) return false;
  return isRetryableAiError(error)
    || message.includes("niepoprawny json");
}

function isRetryableAiError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("limit: 0")) return false;
  return message.includes("high demand")
    || message.includes("try again later")
    || message.includes("please retry in")
    || message.includes("quota exceeded")
    || message.includes("503")
    || message.includes("502")
    || message.includes("500")
    || message.includes("429")
    || message.includes("rate limit");
}

function getAiRetryDelay(baseDelayMs, retryIndex, error) {
  const suggestedDelay = getSuggestedRetryDelayMs(error);
  const exponentialDelay = Math.max(0, baseDelayMs) * (2 ** retryIndex);
  return Math.max(exponentialDelay, suggestedDelay);
}

function getSuggestedRetryDelayMs(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/retry in\s+([0-9.]+)s/i);
  if (!match) return 0;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.ceil(seconds * 1000) + 1000;
}

function formatErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/)[0];
}

async function requestGeminiRewrite(mapped, provider, attempt) {
  const url = `${GEMINI_GENERATE_BASE}/${encodeURIComponent(provider.model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": provider.apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${buildRewriteInstructions({ compact: attempt.compact })}\n\nDane wydarzenia JSON:\n${JSON.stringify(buildAiRewriteInput(mapped), null, 2)}`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: buildGeminiRewriteSchema(),
        temperature: attempt.compact ? 0.2 : 0.5,
        maxOutputTokens: attempt.maxOutputTokens
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Gemini rewrite failed: ${message}`);
  }

  const text = extractGeminiResponseText(payload);
  if (!text) throw new Error("Gemini rewrite failed: pusta odpowiedz modelu.");
  return { text, payload };
}

function buildRewriteInstructions(options = {}) {
  const base = [
    "Jestes redaktorem polskiego portalu lokalnych wydarzen.",
    "Przeredagowujesz zescrapowane opisy wydarzen tak, aby byly oryginalne, neutralne i uzyteczne dla czytelnika.",
    "Nie kopiuj zdan ani charakterystycznych fraz ze zrodla. Zachowaj fakty: tytul, artystow, miejsce, miasto, date, cene i charakter wydarzenia.",
    "Nie dopisuj informacji, ktorych nie ma w danych wejsciowych. Nie obiecuj atrakcji, jesli nie wynikaja ze zrodla.",
    "Pisz po polsku. Bez HTML, bez Markdown, bez emoji.",
    "Zwroc wylacznie JSON z polami short_description oraz description.",
    "Krotki opis: 120-220 znakow. Dlugi opis: 700-1300 znakow, 2-4 akapity.",
    "Jesli oddzielasz akapity w JSON, uzyj sekwencji \\n, nigdy surowej nowej linii wewnatrz stringa."
  ];

  if (options.compact) {
    base.push(
      "Tryb naprawczy: opis dlugi napisz jako jeden akapit 450-800 znakow.",
      "Nie uzywaj cudzyslowow w tresci wartosci JSON; zastap je apostrofami albo pomin."
    );
  }

  return base.join(" ");
}

function buildRewriteJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      short_description: {
        type: "string",
        description: "Oryginalny, krotki opis wydarzenia po polsku."
      },
      description: {
        type: "string",
        description: "Oryginalny, dlugi opis wydarzenia po polsku."
      }
    },
    required: ["short_description", "description"]
  };
}

function buildGeminiRewriteSchema() {
  return {
    type: "object",
    propertyOrdering: ["short_description", "description"],
    properties: {
      short_description: {
        type: "string"
      },
      description: {
        type: "string"
      }
    },
    required: ["short_description", "description"]
  };
}

function buildAiRewriteInput(mapped) {
  return {
    title: mapped.event.title,
    category: mapped.categoryName,
    start_at: mapped.event.start_at,
    end_at: mapped.event.end_at,
    location: {
      name: mapped.location.name,
      address: mapped.location.address,
      city: mapped.city.name
    },
    price: {
      type: mapped.event.price_type,
      min: mapped.event.price_min,
      max: mapped.event.price_max,
      currency: mapped.event.currency
    },
    organizer_name_from_source: mapped.organizerName,
    source_url: mapped.source.source_url,
    source_title: mapped.source.raw_title,
    source_short_description: mapped.event.short_description,
    source_description: mapped.source.raw_description
  };
}

function getOpenAiApiKey() {
  const apiKey = process.env.EVENTMAP_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje OPENAI_API_KEY albo EVENTMAP_OPENAI_API_KEY. Ustaw klucz lokalnie przed uzyciem --rewrite-ai.");
  }
  return apiKey;
}

function getGeminiApiKey() {
  const apiKey = process.env.EVENTMAP_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje GEMINI_API_KEY albo EVENTMAP_GEMINI_API_KEY. Ustaw klucz lokalnie przed uzyciem --rewrite-ai --ai-provider gemini.");
  }
  return apiKey;
}

function getOpenRouterApiKey() {
  const apiKey = process.env.EVENTMAP_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje OPENROUTER_API_KEY albo EVENTMAP_OPENROUTER_API_KEY. Ustaw klucz lokalnie przed uzyciem --rewrite-ai --ai-provider openrouter.");
  }
  return apiKey;
}

function resolveAiProvider(options) {
  const providerName = resolveAiProviderName(options);

  if (providerName === "openrouter") {
    return {
      name: "openrouter",
      label: "OpenRouter",
      model: resolveAiModel(options),
      apiKey: getOpenRouterApiKey()
    };
  }

  if (providerName === "gemini") {
    return {
      name: "gemini",
      label: "Gemini",
      model: resolveAiModel(options),
      apiKey: getGeminiApiKey()
    };
  }

  return {
    name: "openai",
    label: "OpenAI",
    model: resolveAiModel(options),
    apiKey: getOpenAiApiKey()
  };
}

function resolveAiProviderName(options) {
  const requested = normalizeString(options.aiProvider)?.toLowerCase() ?? "auto";

  if (requested === "openrouter" || requested === "gemini" || requested === "openai") return requested;
  if (requested !== "auto") {
    throw new Error(`Nieprawidlowy ai provider: ${options.aiProvider}. Dozwolone: auto, openrouter, openai, gemini.`);
  }

  if (process.env.EVENTMAP_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.EVENTMAP_GEMINI_API_KEY || process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.EVENTMAP_OPENAI_API_KEY || process.env.OPENAI_API_KEY) return "openai";
  return "openai";
}

function resolveAiModel(options) {
  if (options.aiModel) return options.aiModel;
  const providerName = resolveAiProviderName(options);
  if (providerName === "openrouter") return DEFAULT_OPENROUTER_MODEL;
  return providerName === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL;
}

function extractResponseText(response) {
  if (typeof response?.output_text === "string") return response.output_text;

  const chunks = [];
  for (const item of response?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("").trim();
}

function extractGeminiResponseText(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
}

function extractOpenRouterResponseText(response) {
  return response?.choices?.[0]?.message?.content?.trim() ?? "";
}

function stripJsonCodeFence(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function writeAiDebugDump(providerName, mapped, rawText, rawPayload) {
  try {
    const debugDir = path.resolve(DEFAULT_AI_DEBUG_DIR);
    mkdirSync(debugDir, { recursive: true });
    const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${providerName}-${mapped.source.external_id.slice(0, 8)}.json`;
    writeFileSync(path.join(debugDir, filename), `${JSON.stringify({
      provider: providerName,
      title: mapped.event.title,
      external_id: mapped.source.external_id,
      raw_text: rawText,
      raw_payload: rawPayload
    }, null, 2)}\n`, "utf8");
    console.warn(`[ai:${providerName}] zapisano debug odpowiedzi do ${path.join(DEFAULT_AI_DEBUG_DIR, filename)}`);
  } catch {
    // Debug dump must never block the import error path.
  }
}

function parseAiJsonResponse(text, providerLabel) {
  const jsonText = extractJsonObjectText(stripJsonCodeFence(text));

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    try {
      return JSON.parse(escapeControlCharsInsideJsonStrings(jsonText));
    } catch {
      throw new Error(`${providerLabel} rewrite failed: niepoprawny JSON odpowiedzi (${error.message}).`);
    }
  }
}

function extractJsonObjectText(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return trimmed;
  return trimmed.slice(start, end + 1);
}

function escapeControlCharsInsideJsonStrings(text) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (!inString) {
      result += char;
      if (char === "\"") inString = true;
      continue;
    }

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      result += char;
      inString = false;
      continue;
    }

    if (char === "\n") {
      result += "\\n";
      continue;
    }

    if (char === "\r") {
      result += "\\n";
      continue;
    }

    if (char === "\t") {
      result += "\\t";
      continue;
    }

    result += char;
  }

  return result;
}

async function throttleAi(delayMs) {
  const delay = Math.max(0, delayMs);
  const elapsed = Date.now() - lastAiRequestAt;
  if (elapsed < delay) {
    await wait(delay - elapsed);
  }
  lastAiRequestAt = Date.now();
}

async function geocodeLocation(location, cityName, options) {
  const queries = buildGeocodingQueries(location, cityName);

  for (const query of queries) {
    const result = await fetchNominatimGeocode(query, options);
    if (result) return result;
  }

  return null;
}

function buildGeocodingQueries(location, cityName) {
  return uniqueStrings([
    [location.name, location.address, cityName, "Polska"].filter(Boolean).join(", "),
    [location.address, cityName, "Polska"].filter(Boolean).join(", "),
    [location.name, cityName, "Polska"].filter(Boolean).join(", ")
  ]).filter((query) => query.length >= 3);
}

async function fetchNominatimGeocode(query, options) {
  await throttleGeocoding(options.geocodeDelayMs);

  const params = new URLSearchParams({
    q: query,
    format: "json",
    countrycodes: "pl",
    addressdetails: "1",
    limit: "1",
    dedupe: "1",
    "accept-language": "pl"
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT
      }
    });

    if (!response.ok) {
      console.warn(`[geo] Nominatim ${response.status} dla "${query}"`);
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || !results[0]) return null;
    return mapNominatimGeocodingResult(results[0]);
  } catch (error) {
    console.warn(`[geo] blad geokodowania "${query}": ${error.message}`);
    return null;
  }
}

function mapNominatimGeocodingResult(result) {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = result.address ?? {};
  return {
    latitude,
    longitude,
    postalCode: normalizeString(address.postcode),
    voivodeship: formatAdministrativeName(address.state),
    county: formatAdministrativeName(address.county),
    municipality: formatAdministrativeName(address.municipality)
  };
}

async function throttleGeocoding(delayMs) {
  const delay = Math.max(0, delayMs);
  const elapsed = Date.now() - lastGeocodeRequestAt;
  if (elapsed < delay) {
    await wait(delay - elapsed);
  }
  lastGeocodeRequestAt = Date.now();
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasCoordinates(location) {
  return location.latitude != null && location.longitude != null;
}

function formatLocationLabel(location, cityName) {
  return [location.name, location.address, cityName].filter(Boolean).join(", ");
}

function buildGoogleMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(normalizeString).filter(Boolean)));
}

function formatAdministrativeName(value) {
  const text = normalizeString(value);
  if (!text) return null;
  return text
    .replace(/^wojew[oó]dztwo\s+/i, "")
    .replace(/\s+voivodeship$/i, "")
    .replace(/\s+county$/i, "")
    .replace(/^county\s+/i, "")
    .trim();
}

function createSupabaseServiceClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.EVENTMAP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Brakuje NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) {
    throw new Error("Brakuje SUPABASE_SERVICE_ROLE_KEY albo EVENTMAP_SUPABASE_SERVICE_ROLE_KEY. Nie uzywaj do importu kluczy NEXT_PUBLIC_*.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function assertWritableImportEnabled() {
  if (process.env.EVENTMAP_IMPORT_WRITE !== "1") {
    throw new Error("Zapis zablokowany. Ustaw EVENTMAP_IMPORT_WRITE=1 oraz dodaj --apply.");
  }
}

function loadEnvFile(relativePath) {
  const envPath = path.resolve(relativePath);
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = unquote(trimmed.slice(separator + 1).trim());
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeSupabaseUrl(value) {
  if (!value) return undefined;

  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

function unquote(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeAiString(value) {
  const text = normalizeString(value);
  if (!text) return null;

  return normalizeString(
    repairUtf8Mojibake(
      decodeHtmlEntities(
        decodeEscapedUnicodeSequences(text)
      )
    )
  );
}

function decodeEscapedUnicodeSequences(value) {
  return value
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function repairUtf8Mojibake(value) {
  const replacements = [
    ["\u00c4\u2026", "\u0105"],
    ["\u00c4\u2021", "\u0107"],
    ["\u00c4\u2122", "\u0119"],
    ["\u00c5\u201a", "\u0142"],
    ["\u00c5\u201e", "\u0144"],
    ["\u00c5\u203a", "\u015b"],
    ["\u00c5\u015f", "\u017a"],
    ["\u00c5\u00bc", "\u017c"],
    ["\u00c4\u201e", "\u0104"],
    ["\u00c4\u2020", "\u0106"],
    ["\u00c4\u02dc", "\u0118"],
    ["\u00c5\u0081", "\u0141"],
    ["\u00c5\u0192", "\u0143"],
    ["\u00c5\u0161", "\u015a"],
    ["\u00c5\u0105", "\u0179"],
    ["\u00c5\u00bb", "\u017b"],
    ["\u00c5\u201e", "\u0144"],
    ["\u00c5\u201d", "\u0143"],
    ["\u00c5\u00ba", "\u017a"],
    ["\u00c5\u017c", "\u0179"],
    ["\u00c5\u017e", "\u017e"],
    ["\u00c3\u00b3", "\u00f3"],
    ["\u0102\u0142", "\u00f3"],
    ["\u00c3\u201c", "\u00d3"],
    ["\u0102\u201c", "\u00d3"],
    ["\u00c2\u00a0", " "],
    ["\u00e2\u20ac\u201d", "-"],
    ["\u00e2\u20ac\u201c", "-"],
    ["\u00e2\u20ac\u2122", "'"],
    ["\u00e2\u20ac\u017e", "\""],
    ["\u00e2\u20ac\u015d", "\""],
    ["\u00e2\u20ac\u00a6", "..."]
  ];

  let repaired = value;
  for (const [broken, fixed] of replacements) {
    repaired = repaired.split(broken).join(fixed);
  }
  return repaired;
}

function htmlToText(value) {
  const text = normalizeString(value);
  if (!text) return null;

  return decodeHtmlEntities(
    text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/[ \t]{2,}/g, " ");
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferPriceType(rawEvent) {
  const min = nullableNumber(rawEvent.price_min);
  const max = nullableNumber(rawEvent.price_max);
  if (min === 0 && (max === null || max === 0)) return "free";
  if (min !== null || max !== null) return "paid";
  return null;
}

function createSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildExternalId(rawEvent, sourceName) {
  const source = [
    sourceName,
    rawEvent.source_url,
    rawEvent.start_at,
    rawEvent.location?.city,
    rawEvent.location?.name,
    rawEvent.title
  ].filter(Boolean).join("|");

  return createHash("sha1").update(source).digest("hex");
}

function buildEventSlug(title, cityName, startAt, externalId) {
  const date = normalizeString(startAt)?.slice(0, 10) ?? "bez-daty";
  const base = createSlug(`${title}-${cityName}-${date}`).slice(0, 170).replace(/-+$/g, "");
  return `${base}-${externalId.slice(0, 8)}`;
}

function resolveEndAt(startValue, endValue, timeZone) {
  const startText = normalizeString(startValue);
  const endText = normalizeString(endValue);
  if (!endText) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(endText)) {
    if (startText?.slice(0, 10) === endText) {
      return null;
    }

    return toOffsetDateTime(`${endText}T23:59:00`, timeZone);
  }

  return toOffsetDateTime(endText, timeZone);
}

function toOffsetDateTime(value, timeZone) {
  const text = normalizeString(value);
  if (!text) return null;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Nieprawidlowa data: ${text}`);
    return parsed.toISOString();
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${formatTimeZoneOffset(offset)}`;
}

function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

function formatTimeZoneOffset(offsetMs) {
  const sign = offsetMs >= 0 ? "+" : "-";
  const totalMinutes = Math.abs(Math.round(offsetMs / 60000));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function parsePositiveInteger(name, value) {
  const parsed = parseNonNegativeInteger(name, value);
  if (parsed < 1) throw new Error(`${name} musi byc wieksze od 0.`);
  return parsed;
}

function parseNonNegativeInteger(name, value) {
  const parsed = Number(requireValue(name, value));
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} musi byc liczba calkowita >= 0.`);
  }
  return parsed;
}

function requireValue(name, value) {
  if (value === undefined || value === "") {
    throw new Error(`Brak wartosci dla ${name}.`);
  }
  return value;
}

function printHelp() {
  console.log(`
Uzycie:
  node importers/ebilet/import-ebilet.mjs [opcje]

Opcje:
  --file <path>          Plik JSON. Domyslnie ${DEFAULT_FILE}
  --limit <n>            Liczba rekordow. Domyslnie 1
  --offset <n>           Offset w tablicy events. Domyslnie 0
  --index <n>            Skrot dla --offset n --limit 1
  --status <status>      draft | pending_review | published | rejected | archived
  --source-type <type>   Domyslnie scraped
  --timezone <tz>        Domyslnie ${DEFAULT_TIMEZONE}
  --organizer-id <uuid>  Domyslnie ${DEFAULT_ORGANIZER_ID}
  --checkpoint-file <p>  Domyslnie ${DEFAULT_CHECKPOINT_FILE}
  --geocode-delay-ms <n> Domyslnie ${DEFAULT_GEOCODE_DELAY_MS}
  --no-geocode           Nie uzupelniaj wspolrzednych lokalizacji
  --no-geocode-existing  Nie uzupelniaj lokalizacji przy duplikatach
  --rewrite-ai           Przeredaguj krotki i dlugi opis przez OpenRouter/Gemini/OpenAI przed zapisem
  --rewrite-ai-existing  Przy duplikacie zaktualizuj opisy istniejacego eventu
  --ai-provider <name>   auto | openrouter | openai | gemini. Domyslnie auto
  --ai-model <model>     Domyslnie ${DEFAULT_OPENROUTER_MODEL} dla OpenRouter, ${DEFAULT_OPENAI_MODEL} dla OpenAI albo ${DEFAULT_GEMINI_MODEL} dla Gemini
  --ai-delay-ms <n>      Domyslnie ${DEFAULT_AI_DELAY_MS}
  --ai-retries <n>       Domyslnie ${DEFAULT_AI_RETRIES}
  --ai-retry-delay-ms <n> Domyslnie ${DEFAULT_AI_RETRY_DELAY_MS}
  --resume               Zacznij od next_offset z checkpointu
  --continue-on-error    Nie przerywaj po pierwszym bledzie
  --apply                Zapisz do bazy; wymaga EVENTMAP_IMPORT_WRITE=1
`);
}
