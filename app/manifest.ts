import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MapaImprez.pl",
    short_name: "MapaImprez",
    description: "Lokalne wydarzenia w Polsce.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fc3200",
    icons: [
      {
        src: "/icon.svg?v=20260622",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
