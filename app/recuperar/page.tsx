import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PasswordRecoveryForm from "@/components/password-recovery-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Solicita un enlace para restablecer tu contraseña de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function RecoverPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><Image src="/logo.png" alt="CoinRenta" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: "contain" }} /><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card" aria-labelledby="recover-title">
          <div className="auth-heading"><span className="section-kicker">Seguridad de tu cuenta</span><h1 id="recover-title">Recupera tu contraseña</h1><p>Introduce el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p></div>
          <PasswordRecoveryForm />
          <p className="auth-switch"><Link href="/login">← Volver a iniciar sesión</Link></p>
        </section>
        <p className="auth-foot">El enlace de recuperación es personal y solo debe utilizarse desde tu propia cuenta.</p>
      </div>
    </main>
  );
}
