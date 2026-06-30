import { listPublicCategoryCityRoutes } from "@/lib/events";

export const revalidate = 3600;

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const routes = await listPublicCategoryCityRoutes({ dateFrom: today.toISOString(), limit: 10000 });

  const xmlUrls: string[] = [];

  routes.forEach((route) => {
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${route.categorySlug}/${route.citySlug}</loc>
    <lastmod>${new Date(route.lastmod).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`);

      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${route.categorySlug}/${route.citySlug}/dzis</loc>
    <lastmod>${new Date(route.lastmod).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${route.categorySlug}/${route.citySlug}/weekend</loc>
    <lastmod>${new Date(route.lastmod).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
      xmlUrls.push(`  <url>
    <loc>https://mapaimprez.pl/${route.categorySlug}/${route.citySlug}/ten-tydzien</loc>
    <lastmod>${new Date(route.lastmod).toISOString()}</lastmod>
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
