"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("same password")) return "La nueva contraseña debe ser distinta de la actual.";
  if (normalized.includes("password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (normalized.includes("weak password")) return "La contraseña es demasiado débil. Utiliza una combinación más segura.";
  return "No hemos podido cambiar la contraseña. Inténtalo de nuevo.";
}

export default function PasswordManager() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== repeatPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) {
        setError("No se ha podido verificar tu sesión. Vuelve a iniciar sesión.");
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setError("La contraseña actual no es correcta.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(friendlyAuthError(updateError.message));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setMessage("Contraseña actualizada correctamente.");
    } catch {
      setError("No hemos podido completar el cambio de contraseña. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action="#" className="form-grid password-manager" onSubmit={handleSubmit} noValidate>
      <label>
        Contraseña actual
        <input
          type="password"
          name="current_password"
          autoComplete="current-password"
          required
          minLength={6}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="••••••••"
        />
      </label>
      <label>
        Nueva contraseña
        <input
          type="password"
          name="new_password"
          autoComplete="new-password"
          required
          minLength={6}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="••••••••"
        />
      </label>
      <label>
        Repite la nueva contraseña
        <input
          type="password"
          name="repeat_password"
          autoComplete="new-password"
          required
          minLength={6}
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          placeholder="••••••••"
        />
      </label>
      {error && <p className="form-alert form-alert-error" role="alert">{error}</p>}
      {message && <p className="form-alert form-alert-success" role="status">{message}</p>}
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Actualizando…" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}
