import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/organizer/",
          "/login",
          "/register",
          "/api/",
          "/auth/"
        ]
      }
    ],
    sitemap: "https://mapaimprez.pl/sitemap.xml",
    host: "https://mapaimprez.pl"
  };
}
