"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "coinrenta_cookie_consent_v2";
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

type Consent = { analytics: boolean; savedAt: number };

function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Consent>;
    if (typeof value.analytics !== "boolean" || typeof value.savedAt !== "number") return null;
    if (Date.now() - value.savedAt > MAX_AGE_MS) return null;
    return { analytics: value.analytics, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

function persist(analytics: boolean) {
  const consent = { analytics, savedAt: Date.now() } satisfies Consent;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch { /* best effort */ }
  window.dispatchEvent(new CustomEvent("coinrenta-cookie-consent", { detail: consent }));
  return consent;
}

export default function CookieNotice() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const current = readConsent();
    setConsent(current);
    setAnalytics(current?.analytics ?? false);
  }, []);

  function save(value: boolean) {
    const next = persist(value);
    setConsent(next);
    setAnalytics(value);
    setSettingsOpen(false);
  }

  if (consent) return null;

  return (
    <aside className="cookie-notice" role="dialog" aria-modal="false" aria-labelledby="cookie-notice-title">
      <div className="cookie-notice-copy">
        <span className="cookie-notice-badge">COOKIES</span>
        <div>
          <h2 id="cookie-notice-title">Tu privacidad importa</h2>
          <p>
            Usamos cookies estrictamente necesarias para que CoinRenta funcione. Las cookies de analítica,
            como Google Analytics, solo se activarán si las aceptas. Puedes aceptar, rechazar o configurar tus preferencias.
          </p>
          <Link href="/legal/cookies">Ver política de cookies</Link>
        </div>
      </div>
      <div className="cookie-notice-actions">
        <button type="button" className="cookie-notice-button secondary" onClick={() => save(false)}>Rechazar</button>
        <button type="button" className="cookie-notice-button secondary" onClick={() => setSettingsOpen((open) => !open)}>Configurar</button>
        <button type="button" className="cookie-notice-button primary" onClick={() => save(true)}>Aceptar</button>
      </div>
      {settingsOpen && (
        <div className="cookie-settings" aria-label="Configuración de cookies">
          <div className="cookie-setting-row">
            <div><strong>Necesarias</strong><span>Autenticación, seguridad y funcionamiento esencial.</span></div>
            <span className="cookie-required">Siempre activas</span>
          </div>
          <div className="cookie-setting-row">
            <div><strong>Analítica</strong><span>Google Analytics para obtener estadísticas de uso y mejorar CoinRenta.</span></div>
            <label className="cookie-switch">
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} aria-label="Activar cookies analíticas" />
              <span aria-hidden="true" />
            </label>
          </div>
          <div className="cookie-settings-actions">
            <button type="button" className="cookie-notice-button secondary" onClick={() => save(false)}>Rechazar analítica</button>
            <button type="button" className="cookie-notice-button primary" onClick={() => save(analytics)}>Guardar preferencias</button>
          </div>
        </div>
      )}
    </aside>
  );
}
