"use client";

import { useState, useTransition } from "react";
import { adminDeleteUser, adminUpdateUser } from "../actions";

type Props = { userId: string; role: string | null; isActive: boolean; label: string; isSelf: boolean };

export default function UserActions({ userId, role, isActive, label, isSelf }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState(role || "free");

  function run(action: typeof adminUpdateUser | typeof adminDeleteUser, data: Record<string, string>, success: string) {
    setMessage(null);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.set(key, value));
    startTransition(async () => {
      try {
        await action(formData);
        setMessage(success);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo completar la operación.");
      }
    });
  }

  function toggleActive() {
    if (isSelf) return;
    run(adminUpdateUser, { user_id: userId, role: role || "free", is_active: isActive ? "false" : "true" }, isActive ? "Cuenta desactivada." : "Cuenta reactivada.");
  }

  function saveRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(adminUpdateUser, { user_id: userId, role: selectedRole, is_active: isActive ? "true" : "false" }, "Cambios guardados.");
  }

  function remove() {
    if (isSelf || !window.confirm(`¿Eliminar definitivamente la cuenta de ${label}? Esta acción no se puede deshacer.`)) return;
    run(adminDeleteUser, { user_id: userId }, "Usuario eliminado.");
  }

  return (
    <div className="user-actions" aria-live="polite">
      <button className="user-action" type="button" disabled={pending || isSelf} onClick={toggleActive} title={isSelf ? "No puedes desactivar tu propia cuenta" : undefined}>{isActive ? "Desactivar" : "Reactivar"}</button>
      <form onSubmit={saveRole}>
        <input type="hidden" name="user_id" value={userId} />
        <select className="user-role-select" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} aria-label={`Plan o rol de ${label}`} disabled={pending}>
          <option value="free">Free</option><option value="pro">Pro</option><option value="admin">Admin</option>
        </select>
        <button className="user-action user-action-save" type="submit" disabled={pending}>Guardar</button>
      </form>
      <button className="user-action user-action-delete" type="button" disabled={pending || isSelf} onClick={remove} title={isSelf ? "No puedes eliminar tu propia cuenta" : undefined}>Eliminar</button>
      {message && <span className="user-action-message">{message}</span>}
    </div>
  );
}
