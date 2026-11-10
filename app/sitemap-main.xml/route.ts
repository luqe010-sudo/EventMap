import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";
import { listSeasonalEventCounts } from "@/lib/seasonal-events";
import { isSeasonIndexable } from "@/lib/seasons";

export const dynamic = "force-dynamic";

async function seasonalUrls() {
  try {
    const counts = await listSeasonalEventCounts();
    return counts
      .filter((season) => isSeasonIndexable(season.count))
      .map((season) => `
  <url>
    <loc>https://mapaimprez.pl/${season.slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`)
      .join("");
  } catch (error) {
    console.error("Failed to list seasonal pages for sitemap:", error);
    return "";
  }
}

export async function GET() {
  const seasonal = await seasonalUrls();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mapaimprez.pl/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${seasonal}
  <url>
    <loc>https://mapaimprez.pl/dla-organizatorow</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://mapaimprez.pl/regulamin</loc>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      ...PUBLIC_EVENT_NO_STORE_HEADERS
    }
  });
}
