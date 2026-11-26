// Shared services handed to agents: Supabase clients, cached catalog,
// notifications and the rate-limited, cached geocoder.

import type { Services } from "./agents/types.ts";
import { recordCost } from "./budget.ts";
import type { EngineConfig } from "./config.ts";
import { type Db, nowIso } from "./db.ts";
import type { Fetcher } from "./net/fetcher.ts";
import { log, recall, remember } from "./store.ts";
import { type Catalog, loadCatalog, publicClient, serviceClient } from "./supabase.ts";

export function createServices(db: Db, config: EngineConfig, fetcher: Fetcher, options: { withServiceKey: boolean }): Services {
  const publicDb = publicClient(config);
  // Only the publisher role receives the service key, even if it is present in the environment.
  const serviceDb = options.withServiceKey ? serviceClient(config) : null;
  let catalog: Catalog | null = null;
  let catalogPromise: Promise<Catalog | null> | null = null;
  let geocodeChain: Promise<unknown> = Promise.resolve();

  async function notify(title: string, message: string, severity: "info" | "warning" | "critical" = "info"): Promise<void> {
    log(db, severity === "critical" ? "error" : severity === "warning" ? "warn" : "info", "notify", `${title}: ${message}`);
    if (!config.notifyWebhookUrl) return;
    // Rate-limit identical titles to once per hour.
    const last = recall<number>(db, "notify", title, 0);
    if (Date.now() - last < 3600_000 && severity !== "critical") return;
    remember(db, "notify", title, Date.now());
    const text = `${title}\n${message}`.slice(0, 1900);
    const body = config.notifyWebhookKind === "discord" ? JSON.stringify({ content: text })
      : config.notifyWebhookKind === "slack" ? JSON.stringify({ text })
      : config.notifyWebhookKind === "ntfy" ? message.slice(0, 1900)
      : JSON.stringify({ title, message, severity, at: nowIso(), env: config.env });
    const headers: Record<string, string> = config.notifyWebhookKind === "ntfy"
      ? { "content-type": "text/plain; charset=utf-8", title: encodeURIComponent(title).slice(0, 200), priority: severity === "critical" ? "5" : severity === "warning" ? "4" : "3" }
      : { "content-type": "application/json" };
    try {
      const response = await fetch(config.notifyWebhookUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
      if (!response.ok) log(db, "warn", "notify", `Webhook zwrócił ${response.status}`);
    } catch (error) {
      log(db, "warn", "notify", `Webhook niedostępny: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function geocode(query: { venue: string | null; street: string | null; city: string; postalCode: string | null }) {
    if (!config.nominatimUrl) return null;
    const attempts: Array<Record<string, string>> = [];
    if (query.street) attempts.push({ street: query.street, city: query.city, ...(query.postalCode ? { postalcode: query.postalCode } : {}) });
    if (query.venue) attempts.push({ q: `${query.venue}, ${query.city}` });
    for (const params of attempts) {
      const key = JSON.stringify(params).toLowerCase();
      const cached = db.prepare("SELECT latitude, longitude, display_name FROM geocode_cache WHERE query = ?").get(key) as { latitude: number | null; longitude: number | null; display_name: string | null } | undefined;
      if (cached) {
        if (cached.latitude != null && cached.longitude != null) return { lat: cached.latitude, lon: cached.longitude, display: cached.display_name ?? "" };
        continue;
      }
      // Serialise all geocoding calls in this process: public Nominatim allows at most 1 req/s.
      const run = geocodeChain.then(async () => {
        const url = new URL("/search", config.nominatimUrl as string);
        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
        url.searchParams.set("countrycodes", "pl");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "1");
        const response = await fetcher.get(url.toString(), { accept: "application/json", skipRobots: true });
        await new Promise(done => setTimeout(done, config.nominatimMinIntervalMs));
        if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
        return JSON.parse(response.body) as Array<{ lat: string; lon: string; display_name: string }>;
      });
      geocodeChain = run.catch(() => undefined);
      const results = await run;
      recordCost(db, { agent: "geo", category: "geocode", provider: new URL(config.nominatimUrl).host, amountPln: 0, units: 1 });
      const hit = results[0];
      const lat = hit ? Number(hit.lat) : null;
      const lon = hit ? Number(hit.lon) : null;
      db.prepare("INSERT OR REPLACE INTO geocode_cache (query, latitude, longitude, display_name, provider, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(key, lat, lon, hit?.display_name ?? null, "nominatim", nowIso());
      if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, display: hit.display_name };
    }
    return null;
  }

  return {
    publicDb,
    serviceDb,
    async catalog() {
      if (catalog && Date.now() - catalog.loadedAt < 6 * 3600_000) return catalog;
      const client = publicDb ?? serviceDb;
      if (!client) return null;
      catalogPromise ??= loadCatalog(client).then(result => { catalog = result; return result; })
        .catch(error => { log(db, "warn", "services", `Katalog Supabase niedostępny: ${error instanceof Error ? error.message : String(error)}`); return catalog; })
        .finally(() => { catalogPromise = null; });
      return catalogPromise;
    },
    notify,
    geocode
  };
}
