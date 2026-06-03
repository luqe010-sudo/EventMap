import { listCategories } from "@/lib/events";
import { toPluralCategorySlug, toSlug } from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const [categories, { data: cityPages }, { data: locations }] = await Promise.all([
    listCategories(),
    supabase.from("city_pages").select("slug").eq("is_active", true),
    supabase.from("locations").select("city").not("city", "is", null),
  ]);

  const citySet = new Set<string>();

  (cityPages ?? []).forEach((cp) => {
    if (cp.slug) citySet.add(cp.slug.trim().toLowerCase());
  });

  (locations ?? []).forEach((loc) => {
    if (loc.city) citySet.add(toSlug(loc.city));
  });

  const citySlugs = Array.from(citySet).sort();
  const xmlUrls: string[] = [];

  categories.forEach((cat) => {
    const categorySlug = toPluralCategorySlug(cat.slug);

    citySlugs.forEach((citySlug) => {
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${citySlug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);

      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${citySlug}/dzis</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${citySlug}/weekend</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${citySlug}/ten-tydzien</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
    });
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
