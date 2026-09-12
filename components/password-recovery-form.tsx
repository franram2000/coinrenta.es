"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/restablecer`,
      });

      // Deliberadamente no revelamos si el correo existe para evitar enumeración de cuentas.
      if (recoveryError) {
        setError("No hemos podido procesar la solicitud. Comprueba el correo e inténtalo de nuevo.");
      } else {
        setMessage("Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.");
        setEmail("");
      }
    } catch {
      setError("No hemos podido procesar la solicitud. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span>Correo electrónico</span>
        <input name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" />
      </label>
      {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}
      {message && <p className="form-alert form-alert-success" role="status">{message}</p>}
      <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
