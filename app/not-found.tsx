import Link from "next/link";

export default function NotFound() {
  return (
    <main className="cr-system-page" aria-labelledby="not-found-title">
      <div className="cr-system-shell">
        <Link href="/" className="cr-system-brand" aria-label="Volver a CoinRenta">
          <img src="/logo.png" alt="" />
          <span>Coin<b>Renta</b></span>
        </Link>

        <section className="cr-system-card">
          <div className="cr-system-icon" aria-hidden="true">404</div>
          <p className="cr-system-code">Página no encontrada</p>
          <h1 id="not-found-title">Aquí no hay nada que ver.</h1>
          <p>
            La página que buscas no existe, se ha movido o la dirección no es correcta.
            Puedes volver al inicio y continuar desde ahí.
          </p>
          <div className="cr-system-actions">
            <Link href="/" className="cr-system-btn cr-system-btn-primary">Volver al inicio</Link>
            <Link href="/login" className="cr-system-btn cr-system-btn-secondary">Acceder a mi cuenta</Link>
          </div>
        </section>

        <p className="cr-system-footer">CoinRenta · Control y fiscalidad de criptomonedas</p>
      </div>
    </main>
  );
}
