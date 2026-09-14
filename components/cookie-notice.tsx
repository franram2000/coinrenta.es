"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "coinrenta_cookie_notice_v1";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "informed");
    } catch {
      // The notice still works when storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="cookie-notice" role="region" aria-label="Aviso de cookies">
      <div className="cookie-notice-copy">
        <span className="cookie-notice-badge">COOKIES</span>
        <div>
          <h2>Usamos cookies necesarias</h2>
          <p>
            CoinRenta utiliza únicamente cookies y tecnologías similares estrictamente necesarias
            para mantener la sesión, proteger la cuenta y prestar las funciones solicitadas. No
            utilizamos cookies publicitarias ni cookies analíticas opcionales en este momento.
          </p>
          <Link href="/legal/cookies">Ver política de cookies</Link>
        </div>
      </div>
      <button type="button" className="cookie-notice-button" onClick={dismiss}>
        Entendido
      </button>
    </aside>
  );
}
