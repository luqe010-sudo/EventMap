import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapaImprez.pl — Odkryj lokalne wydarzenia w swojej okolicy",
  description: "Co robisz w ten weekend? Znajdź koncerty, festyny, targi, sport i wydarzenia rodzinne w swojej okolicy. Wszystkie lokalne wydarzenia w jednym miejscu.",
  metadataBase: new URL("https://mapaimprez.pl"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MapaImprez.pl — Odkryj lokalne wydarzenia w swojej okolicy",
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
        alt: "MapaImprez.pl — Odkryj lokalne wydarzenia w swojej okolicy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MapaImprez.pl — Odkryj lokalne wydarzenia w swojej okolicy",
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
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-60019N4V87"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-60019N4V87');
`
          }}
        />
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
