import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PasswordResetForm from "@/components/password-reset-form";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Establece una nueva contraseña para tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><Image src="/logo.png" alt="CoinRenta" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: "contain" }} /><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card" aria-labelledby="reset-title">
          <div className="auth-heading"><span className="section-kicker">Seguridad de tu cuenta</span><h1 id="reset-title">Crea una nueva contraseña</h1><p>Elige una contraseña nueva para proteger tu cuenta de CoinRenta.</p></div>
          <PasswordResetForm />
          <p className="auth-switch"><Link href="/login">← Volver a iniciar sesión</Link></p>
        </section>
        <p className="auth-foot">No compartas tu contraseña ni el enlace de recuperación con nadie.</p>
      </div>
    </main>
  );
}
