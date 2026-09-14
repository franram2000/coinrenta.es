"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "coinrenta_cookie_consent_v2";
const CONSENT_VERSION = "2026-09-14-v1";
const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

type Consent = {
  analytics: boolean;
  savedAt: number;
  version: string;
};

function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.savedAt !== "number" || parsed.version !== CONSENT_VERSION) return null;
    if (Date.now() - parsed.savedAt > CONSENT_MAX_AGE_MS) {
      window.localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return { analytics: parsed.analytics, savedAt: parsed.savedAt, version: parsed.version };
  } catch {
    return null;
  }
}

function clearAnalyticsCookies() {
  if (typeof document === "undefined") return;
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  const domains = [window.location.hostname, `.${window.location.hostname}`];
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
    }
  }
}

function saveConsent(analytics: boolean) {
  const consent: Consent = { analytics, savedAt: Date.now(), version: CONSENT_VERSION };
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent("coinrenta-cookie-consent", { detail: consent }));
  if (!analytics) clearAnalyticsCookies();
}

function ConsentCategories({ analyticsChoice, setAnalyticsChoice }: { analyticsChoice: boolean; setAnalyticsChoice: (value: boolean) => void }) {
  return (
    <div className="cr-cookie-categories">
      <section className="cr-cookie-category">
        <div className="cr-cookie-category-copy">
          <div className="cr-cookie-category-title">
            <strong>Necesarias</strong>
            <span className="cr-cookie-status cr-cookie-status-required">Siempre activas</span>
          </div>
          <p>Autenticación, seguridad, sesión y funcionamiento esencial del servicio. No se utilizan para publicidad ni analítica opcional.</p>
        </div>
      </section>

      <section className="cr-cookie-category">
        <div className="cr-cookie-category-copy">
          <div className="cr-cookie-category-title">
            <strong>Analítica</strong>
            <span className={`cr-cookie-status ${analyticsChoice ? "cr-cookie-status-on" : "cr-cookie-status-off"}`}>
              {analyticsChoice ? "Activada" : "Desactivada"}
            </span>
          </div>
          <p>Google Analytics para medir visitas y uso del sitio. Esta categoría solo se activa mediante una acción afirmativa.</p>
        </div>
        <label className="cr-cookie-toggle" aria-label="Activar cookies de analítica">
          <input type="checkbox" checked={analyticsChoice} onChange={(event) => setAnalyticsChoice(event.target.checked)} />
          <span aria-hidden="true" />
        </label>
      </section>
    </div>
  );
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);

  useEffect(() => {
    const current = readConsent();
    if (!current) {
      window.localStorage.removeItem(CONSENT_KEY);
    }
    setConsent(current);
    setAnalyticsChoice(current?.analytics ?? false);
  }, []);

  function apply(analytics: boolean) {
    const savedAt = Date.now();
    saveConsent(analytics);
    setConsent({ analytics, savedAt, version: CONSENT_VERSION });
    setAnalyticsChoice(analytics);
    setSettingsOpen(false);
  }

  function manage() {
    setAnalyticsChoice(consent?.analytics ?? false);
    setSettingsOpen(true);
  }

  const firstVisit = !consent;
  const showDialog = firstVisit || settingsOpen;
  const detailed = settingsOpen;

  return (
    <>
      {!firstVisit && !settingsOpen && (
        <button type="button" className="cr-cookie-manage" onClick={manage} aria-label="Gestionar preferencias de cookies">
          Privacidad · Cookies
        </button>
      )}

      {firstVisit && <div className="cr-cookie-backdrop" aria-hidden="true" />}

      {showDialog && (
        <div className="cr-cookie-layer" role="dialog" aria-modal="true" aria-labelledby="cr-cookie-title">
          <div className={`cr-cookie-panel ${detailed ? "cr-cookie-panel-detailed" : ""}`}>
            <div className="cr-cookie-header">
              <div>
                <span className="cr-cookie-kicker">Privacidad</span>
                <h2 id="cr-cookie-title">{firstVisit ? "Cookies de CoinRenta" : "Preferencias de cookies"}</h2>
              </div>
              {!firstVisit && (
                <button type="button" className="cr-cookie-close" onClick={() => setSettingsOpen(false)} aria-label="Cerrar preferencias">×</button>
              )}
            </div>

            {firstVisit && (
              <p className="cr-cookie-intro">
                Utilizamos tecnologías estrictamente necesarias para que CoinRenta funcione y, solo si lo autorizas, Google Analytics para obtener estadísticas de uso. Puedes aceptar, rechazar o configurar las cookies. Consulta la <Link href="/legal/cookies">Política de cookies</Link>.
              </p>
            )}

            {detailed && <ConsentCategories analyticsChoice={analyticsChoice} setAnalyticsChoice={setAnalyticsChoice} />}

            <div className="cr-cookie-actions">
              <button type="button" className="cr-cookie-btn cr-cookie-btn-secondary" onClick={() => apply(false)}>Rechazar no necesarias</button>
              {!detailed && firstVisit && (
                <button type="button" className="cr-cookie-btn cr-cookie-btn-ghost" onClick={() => setSettingsOpen(true)}>Configurar</button>
              )}
              {detailed && (
                <button type="button" className="cr-cookie-btn cr-cookie-btn-ghost" onClick={() => apply(analyticsChoice)}>Guardar preferencias</button>
              )}
              <button type="button" className="cr-cookie-btn cr-cookie-btn-primary" onClick={() => apply(true)}>Aceptar todas</button>
            </div>

            <p className="cr-cookie-footnote">
              {firstVisit ? "Puedes cambiar o retirar tu consentimiento en cualquier momento desde " : "Puedes volver a modificar o retirar tu consentimiento en cualquier momento desde "}
              <button type="button" onClick={manage}>Privacidad · Cookies</button>. La preferencia se conserva temporalmente y se volverá a solicitar cuando corresponda.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
