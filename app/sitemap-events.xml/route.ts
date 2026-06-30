import { listPublicEventSitemapEntries } from "@/lib/events";

export const revalidate = 3600;

export async function GET() {
  const events = await listPublicEventSitemapEntries(10000);

  const urlsXml = events
    .map((event) => {
      return `  <url>
    <loc>https://mapaimprez.pl${event.path}</loc>
    <lastmod>${new Date(event.lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=59"
    }
  });
}
