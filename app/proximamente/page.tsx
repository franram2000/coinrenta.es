import type { Metadata } from "next";
import Link from "next/link";
import "../error-pages.css";

export const metadata: Metadata = {
  title: "Próximamente",
  description:
    "Algo grande está tomando forma en CoinRenta. Control, organización y fiscalidad cripto en un solo lugar.",
  robots: { index: false, follow: false },
};

export default function ProximamentePage() {
  return (
    <main className="cr-status-page cr-coming-soon-page">
      <div className="cr-status-grid" aria-hidden="true" />
      <div className="cr-status-orb cr-status-orb-a" aria-hidden="true" />
      <div className="cr-status-orb cr-status-orb-b" aria-hidden="true" />
      <div className="cr-status-noise" aria-hidden="true" />

      <div className="cr-status-shell cr-coming-soon-shell">
        <Link href="/" className="cr-status-brand" aria-label="Volver a CoinRenta">
          <img src="/logo.png" alt="CoinRenta" />
          <span>Coin<span>Renta</span></span>
        </Link>

        <section className="cr-coming-soon-content" aria-labelledby="coming-soon-title">
          <div className="cr-coming-soon-badge">
            <span className="cr-pulse-dot" aria-hidden="true" />
            ALGO GRANDE SE ESTÁ PREPARANDO
          </div>

          <div className="cr-coming-soon-mark" aria-hidden="true">
            <div className="cr-coming-soon-ring cr-coming-soon-ring-1" />
            <div className="cr-coming-soon-ring cr-coming-soon-ring-2" />
            <img src="/logo.png" alt="" />
          </div>

          <p className="cr-status-code">PRÓXIMAMENTE</p>
          <h1 id="coming-soon-title">
            El próximo nivel de tu
            <br />
            <em>Renta cripto.</em>
          </h1>
          <p className="cr-status-copy">
            Estamos construyendo algo pensado para que tus operaciones cripto
            dejen de ser un caos de exchanges, CSV y movimientos dispersos.
            <strong> Todo en un solo lugar.</strong>
          </p>

          <div className="cr-coming-soon-features" aria-label="Lo que estamos preparando">
            <span><b>01</b> Más control</span>
            <span><b>02</b> Más claridad</span>
            <span><b>03</b> Menos líos</span>
          </div>

          <div className="cr-status-actions">
            <Link href="/" className="cr-status-btn cr-status-btn-primary">
              Descubrir CoinRenta
            </Link>
          </div>

          <p className="cr-coming-soon-note">
            Estamos afinando cada detalle antes de abrir las puertas.
          </p>
        </section>

        <footer className="cr-status-footer">
          <span>© {new Date().getFullYear()} CoinRenta</span>
          <span className="cr-footer-dot" aria-hidden="true" />
          <span>Controla. Ordena. Prepara.</span>
        </footer>
      </div>
    </main>
  );
}
