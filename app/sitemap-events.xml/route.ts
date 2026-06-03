import { listEvents } from "@/lib/events";
import { eventPath } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await listEvents({ limit: 10000 });

  const urlsXml = events
    .map((event) => {
      const path = eventPath(event);
      return `  <url>
    <loc>https://mapaimprez.pl${path}</loc>
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
