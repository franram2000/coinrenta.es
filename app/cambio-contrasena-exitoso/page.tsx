import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contraseña actualizada",
  description: "Tu contraseña de CoinRenta ha sido actualizada correctamente.",
  robots: { index: false, follow: false },
};

export default function PasswordChangedPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><Image src="/logo.png" alt="CoinRenta" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: "contain" }} /><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card auth-success-card" aria-labelledby="password-title">
          <div className="auth-heading"><span className="section-kicker">Seguridad actualizada</span><h1 id="password-title">Contraseña cambiada correctamente</h1><p>Tu nueva contraseña ya está activa. Puedes iniciar sesión con ella desde este momento.</p></div>
          <div className="auth-success-mark" aria-hidden="true">✓</div>
          <Link className="btn btn-primary auth-success-button" href="/login">Iniciar sesión</Link>
        </section>
        <p className="auth-foot">No compartas tu contraseña con nadie.</p>
      </div>
    </main>
  );
}
