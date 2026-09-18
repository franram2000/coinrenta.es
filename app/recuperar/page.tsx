import type { Metadata } from "next";
import Link from "next/link";
import PasswordRecoveryForm from "@/components/password-recovery-form";
import AuthBrandPanel from "@/components/auth-brand-panel";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Solicita un enlace para restablecer tu contraseña de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function RecoverPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <section className="auth-layout auth-layout-recovery" aria-label="Recuperación de cuenta">
        <AuthBrandPanel variant="recovery" />
        <div className="auth-form-column">
          <section className="auth-card" aria-labelledby="recover-title">
            <div className="auth-card-head">
              <div>
                <span className="auth-card-kicker">Recuperación de acceso</span>
                <h2 id="recover-title">Recupera tu contraseña</h2>
                <p>Te enviaremos un enlace para crear una nueva contraseña.</p>
              </div>
              <span className="auth-secure" aria-label="Proceso seguro">✓</span>
            </div>
            <PasswordRecoveryForm />
            <div className="auth-switch">
              <span>¿Ya recuerdas tu contraseña?</span>
              <Link href="/login">Volver a iniciar sesión</Link>
            </div>
          </section>
          <p className="auth-foot">El enlace de recuperación es personal y solo debe utilizarse desde tu propia cuenta.</p>
        </div>
      </section>
    </main>
  );
}
