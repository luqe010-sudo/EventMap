import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
  description: "Co robisz w ten weekend? Znajdź koncerty, festyny, targi, sport i wydarzenia rodzinne w swojej okolicy. Wszystkie lokalne wydarzenia w jednym miejscu.",
  metadataBase: new URL("https://mapaimprez.pl"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
    description: "Co robisz w ten weekend? Znajdź koncerty, festyny, targi, sport i wydarzenia rodzinne w swojej okolicy.",
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
    description: "Znajdź koncerty, festyny, sport i wydarzenia rodzinne w swojej okolicy.",
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
