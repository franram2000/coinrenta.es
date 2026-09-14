import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Correo verificado",
  description: "Tu dirección de correo ha sido verificada correctamente.",
  robots: { index: false, follow: false },
};

export default function EmailVerifiedPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><Image src="/logo.png" alt="CoinRenta" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: "contain" }} /><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card auth-success-card" aria-labelledby="verified-title">
          <div className="auth-heading"><span className="section-kicker">Cuenta verificada</span><h1 id="verified-title">Correo verificado correctamente</h1><p>Tu dirección de correo electrónico ya está verificada y tu cuenta está lista para utilizar CoinRenta.</p></div>
          <div className="auth-success-mark" aria-hidden="true">✓</div>
          <Link className="btn btn-primary auth-success-button" href="/dashboard">Entrar en CoinRenta</Link>
        </section>
        <p className="auth-foot">Si no esperabas esta verificación, revisa la seguridad de tu cuenta.</p>
      </div>
    </main>
  );
}
