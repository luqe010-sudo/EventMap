import type { Metadata } from "next";

export function listingMetadata(metadata: Metadata): Metadata {
  if (metadata.openGraph) return metadata;
  const title = typeof metadata.title === "string" ? metadata.title : undefined;
  const description = metadata.description ?? undefined;
  return {
    ...metadata,
    openGraph: { title, description, url: metadata.alternates?.canonical?.toString(), locale: "pl_PL", type: "website", siteName: "MapaImprez.pl", images: ["/og-default.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-default.png"] },
  };
}
