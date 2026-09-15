"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import CoinRentaLogo from "@/components/coinrenta-logo";
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
        else if (data.session) { window.location.assign("/dashboard"); return; }
        else setMessage("Cuenta creada. Revisa tu correo para confirmar la dirección antes de entrar.");
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) { setError("Correo o contraseña incorrectos."); return; }
        window.location.assign("/dashboard"); return;
      }
    } catch { setError(isRegister ? "No hemos podido crear la cuenta. Comprueba tu conexión e inténtalo de nuevo." : "No hemos podido iniciar sesión. Comprueba tu conexión e inténtalo de nuevo."); }
    finally { setPending(false); }
  }

  return (
    <main className="auth-page">
      <style>{`
        .auth-page{min-height:100dvh;width:100%;overflow-x:hidden}.auth-layout{width:min(1120px,calc(100% - 48px));min-height:100dvh;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(390px,470px);align-items:center;gap:72px;padding:44px 0}.auth-brand-panel{min-width:0}.auth-brand-copy{max-width:600px}.auth-brand-copy h1{max-width:560px}.auth-brand-copy p{max-width:520px}.auth-trust-row{display:flex;flex-wrap:wrap;gap:9px 18px}.auth-card{width:100%;min-width:0}.auth-form{width:100%}.field{min-width:0}.field input{width:100%;min-width:0}.auth-card-head h2{overflow-wrap:anywhere}.form-alert,.form-note{overflow-wrap:anywhere}.auth-switch{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;text-align:center}.auth-submit{width:100%}.auth-brand-panel .coinrenta-logo-compact .coinrenta-logo-mark img{width:44px;height:44px;object-fit:contain;object-position:center;display:block}
        @media(max-width:920px){.auth-layout{grid-template-columns:1fr;gap:28px;max-width:620px;padding:32px 0 42px}.auth-brand-panel{text-align:center}.auth-brand-panel>.auth-brand-copy{margin:24px auto 0}.auth-trust-row{justify-content:center}.auth-card{max-width:520px;margin:0 auto}.auth-glow-one,.auth-glow-two{opacity:.65}}
        @media(max-width:560px){.auth-layout{width:min(100% - 28px,520px);padding:22px 0 30px;gap:22px}.auth-brand-copy h1{font-size:clamp(30px,9vw,42px);line-height:1.02}.auth-brand-copy p{font-size:13px;line-height:1.55}.auth-trust-row{display:grid;grid-template-columns:1fr;gap:7px;font-size:10px}.auth-card{padding:20px!important;border-radius:18px!important}.auth-card-head{gap:10px!important}.auth-card-head h2{font-size:25px!important}.auth-card-head p{font-size:11px!important}.auth-form{gap:13px!important}.field input{height:46px!important}.auth-submit{min-height:46px!important}.form-note{font-size:9px!important;line-height:1.45!important}.auth-switch{font-size:10px!important}}
      `}</style>
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <section className="auth-layout">
        <div className="auth-brand-panel">
          <CoinRentaLogo compact />
          <div className="auth-brand-copy"><span className="auth-eyebrow">Gestión cripto para España</span><h1>{isRegister ? "Empieza a controlar tu cartera." : "Vuelve a tenerlo todo bajo control."}</h1><p>{isRegister ? "Centraliza tus exchanges, movimientos y datos fiscales en un único espacio." : "Accede a CoinRenta para consultar tus activos, operaciones y preparación de Renta."}</p></div>
          <div className="auth-trust-row"><span>✓ Datos centralizados</span><span>✓ Enfoque fiscal español</span><span>✓ Acceso seguro</span></div>
        </div>
        <div className="auth-card">
          <div className="auth-card-head"><div><span className="auth-card-kicker">CoinRenta</span><h2>{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h2><p>{isRegister ? "Crea tu cuenta para empezar." : "Introduce tus credenciales para continuar."}</p></div><span className="auth-secure" aria-label="Conexión segura">⌁</span></div>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isRegister && <label className="field"><span>Nombre</span><input name="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" /></label>}
            <label className="field"><span>Correo electrónico</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></label>
            <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
            {!isRegister && <div className="auth-forgot"><Link href="/recuperar">¿Has olvidado tu contraseña?</Link></div>}
            {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}{message && <p className="form-alert form-alert-success" role="status">{message}</p>}
            <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>{pending ? "Procesando…" : isRegister ? "Crear cuenta" : "Iniciar sesión"}</button>
            {isRegister && <p className="form-note">Al crear la cuenta aceptas utilizar CoinRenta bajo tu propia responsabilidad fiscal. La aplicación no sustituye el asesoramiento de un profesional.</p>}
          </form>
          <div className="auth-switch"><span>{isRegister ? "¿Ya tienes una cuenta?" : "¿Todavía no tienes una cuenta?"}</span><Link href={isRegister ? "/login" : "/registro"}>{isRegister ? "Iniciar sesión" : "Crear cuenta"}</Link></div>
        </div>
      </section>
    </main>
  );
}
