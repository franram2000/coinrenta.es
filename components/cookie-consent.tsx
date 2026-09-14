"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

const CONSENT_KEY = "coinrenta_cookie_consent_v1";
const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

type Consent = {
  analytics: boolean;
  savedAt: number;
};

function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > CONSENT_MAX_AGE_MS) return null;
    return { analytics: parsed.analytics, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function saveConsent(analytics: boolean) {
  const consent = { analytics, savedAt: Date.now() } satisfies Consent;
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent("coinrenta-cookie-consent", { detail: consent }));
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);

  useEffect(() => {
    const current = readConsent();
    setConsent(current);
    setAnalyticsChoice(current?.analytics ?? false);
  }, []);

  function apply(analytics: boolean) {
    saveConsent(analytics);
    setConsent({ analytics, savedAt: Date.now() });
    setAnalyticsChoice(analytics);
    setSettingsOpen(false);
  }

  if (consent) return null;

  return (
    <>
      <div className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
        <div className="cookie-consent-inner">
          <div className="cookie-copy">
            <span className="cookie-kicker">Privacidad</span>
            <h2 id="cookie-title">Usamos cookies necesarias y, con tu permiso, analítica.</h2>
            <p>
              Las cookies técnicas son necesarias para que CoinRenta funcione y mantener tu sesión. Google Analytics solo se activará si lo autorizas. Puedes aceptar, rechazar o configurar las cookies desde este aviso. Consulta la <Link href="/legal/cookies">Política de cookies</Link>.
            </p>
          </div>
          <div className="cookie-actions" aria-label="Preferencias de cookies">
            <button type="button" className="cookie-btn cookie-btn-secondary" onClick={() => apply(false)}>Rechazar no necesarias</button>
            <button type="button" className="cookie-btn cookie-btn-secondary" onClick={() => setSettingsOpen((value) => !value)}>Configurar</button>
            <button type="button" className="cookie-btn cookie-btn-primary" onClick={() => apply(true)}>Aceptar todas</button>
          </div>
          {settingsOpen && (
            <div className="cookie-settings" aria-label="Configuración detallada de cookies">
              <div className="cookie-setting-row">
                <div><strong>Necesarias</strong><span>Autenticación, seguridad y funcionamiento esencial. Siempre activas.</span></div>
                <span className="cookie-required">Siempre activas</span>
              </div>
              <div className="cookie-setting-row">
                <div><strong>Analítica</strong><span>Google Analytics para medir el uso de la web y mejorar el servicio. Se carga solo con tu consentimiento.</span></div>
                <label className="cookie-toggle"><input type="checkbox" checked={analyticsChoice} onChange={(event) => setAnalyticsChoice(event.target.checked)} /><span aria-hidden="true" /></label>
              </div>
              <div className="cookie-settings-actions">
                <button type="button" className="cookie-btn cookie-btn-secondary" onClick={() => apply(false)}>Guardar y rechazar</button>
                <button type="button" className="cookie-btn cookie-btn-primary" onClick={() => apply(analyticsChoice)}>Guardar preferencias</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {consent?.analytics && null}
    </>
  );
}
