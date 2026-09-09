"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

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
    setPending(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const origin = window.location.origin;

    if (isRegister) {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() || null },
          emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
        },
      });

      if (signupError) {
        setError(signupError.message);
      } else if (data.session) {
        window.location.assign("/dashboard");
        return;
      } else {
        setMessage("Cuenta creada. Revisa tu correo para confirmar la dirección antes de entrar.");
      }
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError("Correo o contraseña incorrectos.");
      } else {
        window.location.assign("/dashboard");
        return;
      }
    }

    setPending(false);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {isRegister && (
        <label className="field">
          <span>Nombre</span>
          <input name="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" />
        </label>
      )}
      <label className="field">
        <span>Correo electrónico</span>
        <input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </label>

      {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}
      {message && <p className="form-alert form-alert-success" role="status">{message}</p>}

      <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? "Procesando…" : isRegister ? "Crear cuenta" : "Iniciar sesión"}
      </button>

      {isRegister && <p className="form-note">Al crear la cuenta aceptas utilizar CoinRenta bajo tu propia responsabilidad fiscal. La aplicación no sustituye el asesoramiento de un profesional.</p>}
    </form>
  );
}
