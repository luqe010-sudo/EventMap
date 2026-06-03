export const dynamic = "force-dynamic";

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://mapaimprez.pl/sitemap-main.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://mapaimprez.pl/sitemap-categories.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://mapaimprez.pl/sitemap-cities.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://mapaimprez.pl/sitemap-category-cities.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://mapaimprez.pl/sitemap-events.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=59"
    }
  });
}
