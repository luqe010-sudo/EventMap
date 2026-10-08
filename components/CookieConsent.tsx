"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { clearAnalyticsSession, readAnalyticsConsent, saveAnalyticsConsent, subscribeAnalyticsConsent, type AnalyticsConsentValue } from "@/lib/analytics-consent";

const GA_MEASUREMENT_ID = "G-60019N4V87";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<AnalyticsConsentValue | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const updateConsent = () => {
      const value = readAnalyticsConsent();
      if (value !== "accepted") clearAnalyticsSession();
      setConsent(value);
      // Disabling GA also stops a script already loaded before revocation.
      (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = value !== "accepted";
    };
    updateConsent();
    setReady(true);
    return subscribeAnalyticsConsent(updateConsent);
  }, []);

  function saveConsent(value: AnalyticsConsentValue) {
    setConsent(saveAnalyticsConsent(value));
    setSettingsOpen(false);
  }

  const shouldLoadAnalytics = consent === "accepted";
  const showBanner = ready && (consent === null || settingsOpen);

  return (
    <>
      {shouldLoadAnalytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-consented" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {showBanner && (
        <section className="cookieBanner" aria-label="Zgoda na cookies">
          <div className="cookieBannerText">
            <strong>Cookies i analityka</strong>
            <p>
              Używamy niezbędnych cookies do działania serwisu. Statystyki
              wydarzeń i Google Analytics uruchomimy po Twojej zgodzie. Szczegóły opisuje{" "}
              <Link href="/regulamin#polityka-cookies">polityka cookies</Link>.
            </p>
          </div>
          <div className="cookieBannerActions">
            <button
              type="button"
              className="secondaryButton"
              onClick={() => saveConsent("rejected")}
            >
              Odrzuć analitykę
            </button>
            <button
              type="button"
              className="primaryButton"
              onClick={() => saveConsent("accepted")}
            >
              Akceptuję
            </button>
          </div>
        </section>
      )}

      {ready && consent !== null && !settingsOpen && (
        <button
          type="button"
          className="cookieSettingsButton"
          onClick={() => setSettingsOpen(true)}
        >
          Cookies
        </button>
      )}
    </>
  );
}
