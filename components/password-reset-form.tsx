"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (normalized.includes("weak password")) return "La contraseña es demasiado débil. Utiliza una combinación más segura.";
  return "No hemos podido actualizar la contraseña. Solicita un nuevo enlace e inténtalo de nuevo.";
}

export default function PasswordResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (password.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(friendlyError(updateError.message));
        return;
      }
      router.replace("/login?password=updated");
    } catch {
      setError("No hemos podido actualizar la contraseña. Solicita un nuevo enlace e inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span>Nueva contraseña</span>
        <input type="password" name="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
      </label>
      <label className="field">
        <span>Repite la nueva contraseña</span>
        <input type="password" name="repeat_password" autoComplete="new-password" required minLength={6} value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} placeholder="••••••••" />
      </label>
      {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}
      <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? "Actualizando…" : "Establecer nueva contraseña"}
      </button>
    </form>
  );
}
