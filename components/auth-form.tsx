"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import CoinRentaLoader from "@/components/coinrenta-loader";
import AuthBrandPanel from "@/components/auth-brand-panel";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";
const SITE_URL = "https://coinrenta.es";

export default function AuthForm({ mode }: { mode: Mode }) {
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage(null); setError(null);
    try {
      const supabase = createClient();
      if (isRegister) {
        const { data, error: signupError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() || null }, emailRedirectTo: `${SITE_URL}/verificar-correo` } });
        if (signupError) setError(signupError.message || "No hemos podido crear la cuenta.");
        else if (data.session) {
          window.location.assign("/dashboard?intro=1"); return;
        } else setMessage("Cuenta creada. Revisa tu correo para confirmar la dirección antes de entrar.");
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) { setError("Correo o contraseña incorrectos."); return; }
        window.location.assign("/dashboard?intro=1"); return;
      }
    } catch { setError(isRegister ? "No hemos podido crear la cuenta. Comprueba tu conexión e inténtalo de nuevo." : "No hemos podido iniciar sesión. Comprueba tu conexión e inténtalo de nuevo."); }
    finally { setPending(false); }
  }

  return (
    <main className="auth-page">
      {pending && <CoinRentaLoader duration={20000} />}
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <section className="auth-layout">
        <AuthBrandPanel variant={isRegister ? "register" : "login"} />
        <div className="auth-card">
          <div className="auth-card-head"><div><span className="auth-card-kicker">CoinRenta</span><h2>{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h2><p>{isRegister ? "Crea tu cuenta para empezar." : "Introduce tus credenciales para continuar."}</p></div><span className="auth-secure" aria-label="Conexión segura">⌁</span></div>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isRegister && <label className="field"><span>Nombre</span><input name="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" /></label>}
            <label className="field"><span>Correo electrónico</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></label>
            <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
            {!isRegister && <div className="auth-forgot"><Link href="/recuperar">¿Has olvidado tu contraseña?</Link></div>}
            {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}{message && <p className="form-alert form-alert-success" role="status">{message}</p>}
            <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>{pending ? "Preparando CoinRenta…" : isRegister ? "Crear cuenta" : "Iniciar sesión"}</button>
            {isRegister && <p className="form-note">Al crear la cuenta aceptas utilizar CoinRenta bajo tu propia responsabilidad fiscal. La aplicación no sustituye el asesoramiento de un profesional.</p>}
          </form>
          <div className="auth-switch"><span>{isRegister ? "¿Ya tienes una cuenta?" : "¿Todavía no tienes una cuenta?"}</span><Link href={isRegister ? "/login" : "/registro"}>{isRegister ? "Iniciar sesión" : "Crear cuenta"}</Link></div>
        </div>
      </section>
    </main>
  );
}
