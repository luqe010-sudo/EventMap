import { unstable_cache } from "next/cache";
import { readPublicMarkerInventory, type PublicMarkerInventory } from "@/lib/events";
import { getPublicMapCacheSecret, PUBLIC_MAP_MARKER_CACHE_TAG } from "@/lib/public-event-cache";
import { supabaseUrl } from "@/lib/supabase-config";

const MAX_AGE_SECONDS = 300;
const MAX_CACHE_BYTES = 2_000_000;

const getCachedInventory = unstable_cache(async () => {
  const startedAt = Date.now();
  // The triggering request may resolve its date filter just before this read.
  const dateFrom = new Date(startedAt - MAX_AGE_SECONDS * 1000).toISOString();
  const inventory = await readPublicMarkerInventory(dateFrom);
  const snapshot = { inventory, expiresAt: startedAt + MAX_AGE_SECONDS * 1000 };
  // Next stores this JSON as a string inside its own cache envelope.
  return Buffer.byteLength(JSON.stringify(JSON.stringify(snapshot))) <= MAX_CACHE_BYTES ? snapshot : null;
}, ["public-map-markers-v1", supabaseUrl ?? ""], {
  tags: [PUBLIC_MAP_MARKER_CACHE_TAG],
  revalidate: MAX_AGE_SECONDS
});

export async function readCachedPublicMarkerInventory(): Promise<PublicMarkerInventory | null> {
  if (!getPublicMapCacheSecret()) return null;

  try {
    const snapshot = await getCachedInventory();
    // Next may return an expired value while refreshing it in the background.
    return snapshot && Date.now() < snapshot.expiresAt ? snapshot.inventory : null;
  } catch (error) {
    console.warn("[events-markers] Marker inventory unavailable; using live search", error);
    return null;
  }
}
