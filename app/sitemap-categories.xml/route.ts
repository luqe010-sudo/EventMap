import { listCategories } from "@/lib/events";
import { toPluralCategorySlug } from "@/lib/slugs";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await listCategories();
  
  const urlsXml = categories
    .map((cat) => {
      const slug = toPluralCategorySlug(cat.slug);
      return `  <url>
    <loc>https://mapaimprez.pl/${slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
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
      ...PUBLIC_EVENT_NO_STORE_HEADERS
    }
  });
}
