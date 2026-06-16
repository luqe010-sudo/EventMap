import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const { data: cities } = await supabase
    .from("cities")
    .select("slug, updated_at")
    .eq("is_active", true)
    .order("slug", { ascending: true });

  const xmlUrls: string[] = [];

  (cities ?? []).forEach((city) => {
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${city.slug}</loc>
    ${city.updated_at ? `<lastmod>${new Date(city.updated_at).toISOString()}</lastmod>` : ""}
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);

    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${city.slug}/dzis</loc>
    ${city.updated_at ? `<lastmod>${new Date(city.updated_at).toISOString()}</lastmod>` : ""}
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${city.slug}/weekend</loc>
    ${city.updated_at ? `<lastmod>${new Date(city.updated_at).toISOString()}</lastmod>` : ""}
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
    xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${city.slug}/ten-tydzien</loc>
    ${city.updated_at ? `<lastmod>${new Date(city.updated_at).toISOString()}</lastmod>` : ""}
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
