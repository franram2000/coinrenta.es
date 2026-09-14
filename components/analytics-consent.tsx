"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const STORAGE_KEY = "coinrenta_cookie_consent_v2";

export default function AnalyticsConsent() {
  const [enabled, setEnabled] = useState(false);
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!measurementId) return;

    const read = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { analytics?: boolean };
        setEnabled(parsed.analytics === true);
      } catch {
        setEnabled(false);
      }
    };

    read();
    const onConsent = (event: Event) => {
      const custom = event as CustomEvent<{ analytics?: boolean }>;
      setEnabled(custom.detail?.analytics === true);
    };
    window.addEventListener("coinrenta-cookie-consent", onConsent);
    return () => window.removeEventListener("coinrenta-cookie-consent", onConsent);
  }, [measurementId]);

  if (!measurementId || !enabled) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="coinrenta-google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${measurementId}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
