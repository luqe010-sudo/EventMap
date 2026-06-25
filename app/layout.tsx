import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const SITE_DESCRIPTION =
  "Znajdz koncerty, festyny, targi, wydarzenia sportowe, rodzinne i kulturalne w Polsce. Filtruj wydarzenia po dacie, miescie, kategorii, cenie i promieniu.";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var key = "eventmap-theme";
    var storedTheme = window.localStorage.getItem(key);
    var systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isMobileViewport = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
    var theme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : isMobileViewport || systemPrefersDark
        ? "dark"
        : "light";

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export const metadata: Metadata = {
  title: "MapaImprez.pl - Odkryj lokalne wydarzenia w swojej okolicy",
  description: SITE_DESCRIPTION,
  metadataBase: new URL("https://mapaimprez.pl"),
  icons: {
    icon: [
      {
        url: "/icon.svg?v=20260622",
        type: "image/svg+xml",
        sizes: "any"
      }
    ],
    shortcut: "/icon.svg?v=20260622",
    apple: "/icon.svg?v=20260622"
  },
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
    <html lang="pl" suppressHydrationWarning>
      <head>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta name="color-scheme" content="light dark" />
        <link rel="preload" as="image" href="/background-mobile.webp" media="(max-width: 760px)" />
        <link rel="preload" as="image" href="/background-dark-mobile.webp" media="(max-width: 760px)" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
