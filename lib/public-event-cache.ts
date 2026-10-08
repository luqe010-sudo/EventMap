import { revalidatePath } from "next/cache";

// Discovery responses must read current publication state on every request.
// A CDN cache here would survive revalidatePath and could retain withdrawn events.
export const PUBLIC_EVENT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0"
};

/** Call after any successful event write, including a recovered partial write. */
export function revalidatePublicEventCache(): void {
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
