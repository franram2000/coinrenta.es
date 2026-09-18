import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordResetForm from "@/components/password-reset-form";
import AuthStatusLayout from "@/components/auth-status-layout";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Establece una nueva contraseña para tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const recoveryCookie = cookieStore.get("coinrenta_password_recovery")?.value;
  if (recoveryCookie !== "1") notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  return (
    <main className="auth-page auth-status-page auth-reset-page">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <section className="auth-layout auth-status-layout" aria-label="Restablecimiento de contraseña">
        <div className="auth-brand-panel auth-brand-panel-recovery">
          <div className="auth-brand-copy auth-reset-brand-copy">
            <span className="auth-eyebrow">Seguridad de tu cuenta</span>
            <h1>Crea una nueva contraseña.</h1>
            <p>Elige una contraseña nueva y vuelve a tener tu cuenta protegida.</p>
          </div>
        </div>
        <div className="auth-form-column">
          <section className="auth-card" aria-labelledby="reset-title">
            <div className="auth-card-head">
              <div>
                <span className="auth-card-kicker">Nueva contraseña</span>
                <h2 id="reset-title">Protege tu cuenta</h2>
                <p>Introduce y confirma tu nueva contraseña.</p>
              </div>
              <span className="auth-secure" aria-hidden="true">✓</span>
            </div>
            <PasswordResetForm />
          </section>
          <p className="auth-foot">No compartas tu contraseña ni el enlace de recuperación con nadie.</p>
        </div>
      </section>
    </main>
  );
}
