"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "eventmap.cookieConsent";
const GA_MEASUREMENT_ID = "G-60019N4V87";

type CookieConsentValue = "accepted" | "rejected";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function loadStoredConsent(): CookieConsentValue | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<CookieConsentValue | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setConsent(loadStoredConsent());
    setReady(true);
  }, []);

  function saveConsent(value: CookieConsentValue) {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    } catch {
      // If storage is unavailable, keep the choice for the current render only.
    }

    setConsent(value);
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
              Używamy niezbędnych cookies do działania serwisu. Google
              Analytics uruchomimy tylko po Twojej zgodzie. Szczegóły opisuje{" "}
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
