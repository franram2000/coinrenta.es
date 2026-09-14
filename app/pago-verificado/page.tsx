import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pago verificado",
  description: "El pago de CoinRenta ha sido verificado correctamente.",
  robots: { index: false, follow: false },
};

export default function PaymentVerifiedPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><Image src="/logo.png" alt="CoinRenta" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: "contain" }} /><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card auth-success-card" aria-labelledby="payment-title">
          <div className="auth-heading"><span className="section-kicker">Suscripción</span><h1 id="payment-title">Pago verificado correctamente</h1><p>Hemos recibido la confirmación del pago. Tu suscripción se actualizará de acuerdo con el plan contratado.</p></div>
          <div className="auth-success-mark" aria-hidden="true">✓</div>
          <Link className="btn btn-primary auth-success-button" href="/dashboard">Ir al dashboard</Link>
        </section>
        <p className="auth-foot">Conserva el comprobante de pago de tu entidad de cobro.</p>
      </div>
    </main>
  );
}
