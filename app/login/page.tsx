import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede a tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><span className="brand-mark">₿</span><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-heading"><span className="section-kicker">Bienvenido de nuevo</span><h1 id="login-title">Inicia sesión</h1><p>Entra para revisar tus ejercicios fiscales y tus movimientos.</p></div>
          <AuthForm mode="login" />
          <p className="auth-switch">¿Todavía no tienes cuenta? <Link href="/registro">Crear cuenta</Link></p>
        </section>
        <p className="auth-foot">Datos fiscales y financieros. Diseñado para mantener el control en tus manos.</p>
      </div>
    </main>
  );
}
