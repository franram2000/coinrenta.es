import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><Link href="/"><Image src="/logo.png" alt="CoinRenta" width={44} height={44} priority style={{ width: 44, height: 44, objectFit: "contain" }} /><span className="brand-name">Coin<span>Renta</span></span></Link></div>
        <section className="auth-card" aria-labelledby="register-title">
          <div className="auth-heading"><span className="section-kicker">Empieza en CoinRenta</span><h1 id="register-title">Crea tu cuenta</h1><p>Centraliza tus exchanges y empieza a ordenar tus datos fiscales.</p></div>
          <AuthForm mode="register" />
          <p className="auth-switch">¿Ya tienes una cuenta? <Link href="/login">Iniciar sesión</Link></p>
        </section>
        <p className="auth-foot">Registro gratuito. Podrás añadir tus exchanges y tus CSV después.</p>
      </div>
    </main>
  );
}
