import { revalidatePath, revalidateTag } from "next/cache";

// Browsers and CDNs cannot observe the app's publication invalidation.
export const PUBLIC_EVENT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0"
};

export const PUBLIC_MAP_MARKER_CACHE_TAG = "public-map-markers";

export function getPublicMapCacheSecret(): string | undefined {
  return process.env.EVENTMAP_MAP_CACHE_SECRET?.trim() || undefined;
}

export function revalidatePublicMapMarkerCache(): void {
  if (getPublicMapCacheSecret()) revalidateTag(PUBLIC_MAP_MARKER_CACHE_TAG);
}

/** Call after any successful event write, including a recovered partial write. */
export function revalidatePublicEventCache(): void {
  revalidatePublicMapMarkerCache();
  revalidatePath("/", "page");
  revalidatePath("/lokalizacja", "page");

  // Templates invalidate both previous and new slugs/category/city placements,
  // plus city-only and date listings handled by these same pages.
  revalidatePath("/[category]", "page");
  revalidatePath("/[category]/[city]", "page");
  revalidatePath("/[category]/[city]/[event]", "page");

  // Route handlers carry /route implicit tags, not /page tags. Scoped layout
  // invalidation covers every dynamic ID/slug without invalidating Auth pages.
  revalidatePath("/api/events", "layout");
  revalidatePath("/wydarzenie", "layout");
  revalidatePath("/wydarzenia", "layout");

  revalidatePath("/sitemap.xml");
  revalidatePath("/sitemap-main.xml");
  revalidatePath("/sitemap-events.xml");
  revalidatePath("/sitemap-cities.xml");
  revalidatePath("/sitemap-category-cities.xml");
  revalidatePath("/sitemap-categories.xml");
}
