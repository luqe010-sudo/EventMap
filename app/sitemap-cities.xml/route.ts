import { listPublicEventSitemapEntries } from "@/lib/events";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";
export const dynamic = "force-dynamic";
export async function GET() {
  const entries = await listPublicEventSitemapEntries();
  const paths = new Set(entries.map(({ path }) => {
    const [, , city] = path.split("/");
    return `/${city}`;
  }));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...paths].map(path => `<url><loc>https://mapaimprez.pl${path}</loc></url>`).join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml", ...PUBLIC_EVENT_NO_STORE_HEADERS } });
}
