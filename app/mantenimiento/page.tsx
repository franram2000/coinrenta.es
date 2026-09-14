import Link from "next/link";

export const metadata = {
  title: "Estamos mejorando CoinRenta",
  description: "CoinRenta está realizando tareas de mantenimiento. Volveremos a estar disponibles en breve.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="cr-system-page cr-maintenance" aria-labelledby="maintenance-title">
      <div className="cr-system-shell">
        <Link href="/" className="cr-system-brand" aria-label="Volver a CoinRenta">
          <img src="/logo.png" alt="" />
          <span>Coin<b>Renta</b></span>
        </Link>

        <section className="cr-system-card">
          <div className="cr-system-icon" aria-hidden="true">✦</div>
          <p className="cr-system-code">Mantenimiento en curso</p>
          <h1 id="maintenance-title">Estamos mejorando CoinRenta.</h1>
          <p>
            Estamos realizando una actualización para seguir ofreciendo una experiencia
            más rápida, segura y fiable. El servicio volverá a estar disponible en breve.
          </p>
          <div className="cr-system-status" aria-label="Mantenimiento activo">
            <i aria-hidden="true" /> Estamos trabajando en ello
          </div>
          <div className="cr-system-actions">
            <Link href="/" className="cr-system-btn cr-system-btn-secondary">Volver al inicio</Link>
          </div>
        </section>

        <p className="cr-system-footer">CoinRenta · Control y fiscalidad de criptomonedas</p>
      </div>
    </main>
  );
}
