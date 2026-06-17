import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const SITE_DESCRIPTION =
  "Znajdz koncerty, festyny, targi, wydarzenia sportowe, rodzinne i kulturalne w Polsce. Filtruj wydarzenia po dacie, miescie, kategorii, cenie i promieniu.";

export const metadata: Metadata = {
  title: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
  description: SITE_DESCRIPTION,
  metadataBase: new URL("https://mapaimprez.pl"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
    description: SITE_DESCRIPTION,
    locale: "pl_PL",
    type: "website",
    url: "https://mapaimprez.pl",
    siteName: "MapaImprez.pl",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
    description: SITE_DESCRIPTION,
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        <meta name="description" content={SITE_DESCRIPTION} />
        <link rel="preload" as="image" href="/background-mobile.webp" media="(max-width: 760px)" />
      </head>
      <body>
        <div className="siteWrapper">
          <Navbar />
          <div className="mainContent">{children}</div>
          <Footer />
          <CookieConsent />
        </div>
      </body>
    </html>
  );
}
