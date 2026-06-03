import { createSupabaseServerClient } from "@/lib/supabase";
import { toSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();

  // Fetch active city pages
  const { data: cityPages } = await supabase
    .from("city_pages")
    .select("city, slug")
    .eq("is_active", true);

  // Fetch cities from locations table
  const { data: locations } = await supabase
    .from("locations")
    .select("city")
    .not("city", "is", null);

  const citySet = new Set<string>();
  const citySlugToLabel: Record<string, string> = {};

  (cityPages ?? []).forEach((cp) => {
    if (cp.city && cp.slug) {
      const slug = cp.slug.trim().toLowerCase();
      citySet.add(slug);
      citySlugToLabel[slug] = cp.city;
    }
  });

  (locations ?? []).forEach((loc) => {
    if (loc.city) {
      const slug = toSlug(loc.city);
      citySet.add(slug);
      if (!citySlugToLabel[slug]) {
        citySlugToLabel[slug] = loc.city;
      }
    }
  });

  const citySlugs = Array.from(citySet).sort();

  const xmlUrls: string[] = [];

  citySlugs.forEach((slug) => {
    // Base city page
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/miasto/${slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);

    // Time variants
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/miasto/${slug}/dzis</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/miasto/${slug}/weekend</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/miasto/${slug}/ten-tydzien</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=59"
    }
  });
}
