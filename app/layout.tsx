import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventMap Polska — Odkryj lokalne wydarzenia w swojej okolicy",
  description: "Co robisz w ten weekend? Znajdź koncerty, festyny, targi, sport i wydarzenia rodzinne w swojej okolicy. Wszystkie lokalne wydarzenia w jednym miejscu.",
  metadataBase: new URL("https://eventmap.pl"),
  openGraph: {
    title: "EventMap Polska — Odkryj lokalne wydarzenia w swojej okolicy",
    description: "Co robisz w ten weekend? Znajdź koncerty, festyny, targi, sport i wydarzenia rodzinne w swojej okolicy.",
    locale: "pl_PL",
    type: "website",
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="siteWrapper">
          <Navbar />
          <div className="mainContent">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
