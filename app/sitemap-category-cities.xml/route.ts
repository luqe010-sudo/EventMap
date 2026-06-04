import { listCategories } from "@/lib/events";
import { toPluralCategorySlug } from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const [categories, { data: cities }] = await Promise.all([
    listCategories(),
    supabase
      .from("cities")
      .select("slug")
      .eq("is_active", true)
      .order("slug", { ascending: true })
  ]);

  const xmlUrls: string[] = [];

  categories.forEach((cat) => {
    const categorySlug = toPluralCategorySlug(cat.slug);

    (cities ?? []).forEach((city) => {
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${city.slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);

      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${city.slug}/dzis</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${city.slug}/weekend</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${categorySlug}/${city.slug}/ten-tydzien</loc>
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
