"use client";

import { useState, useTransition, type FormEvent } from "react";
import { adminDeleteUser, adminUpdateUser } from "../actions";

type Props = { userId: string; role: string | null; isActive: boolean; label: string; isSelf: boolean };
type AdminAction = typeof adminUpdateUser | typeof adminDeleteUser;

export default function UserActions({ userId, role, isActive, label, isSelf }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const normalizedRole = role === "pro" || role === "admin" ? role : "free";
  const [selectedRole, setSelectedRole] = useState(normalizedRole);

  function run(action: AdminAction, data: Record<string, string>, success: string) {
    setMessage(null);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.set(key, value));
    startTransition(async () => {
      try { await action(formData); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar la operación."); }
    });
  }

  function toggleActive() {
    if (isSelf) return;
    run(adminUpdateUser, { user_id: userId, role: normalizedRole, is_active: isActive ? "false" : "true" }, isActive ? "Acceso desactivado." : "Acceso reactivado.");
  }

  function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(adminUpdateUser, { user_id: userId, role: selectedRole, is_active: isActive ? "true" : "false" }, "Cambios guardados.");
  }

  function remove() {
    if (isSelf || !window.confirm(`¿Eliminar definitivamente la cuenta de ${label}? Se borrarán sus datos y no podrás reactivarla después.`)) return;
    run(adminDeleteUser, { user_id: userId }, "Usuario eliminado.");
  }

  return (
    <div className="user-actions" aria-live="polite">
      <button className="user-action" type="button" disabled={pending || isSelf} onClick={toggleActive}>{isActive ? "Desactivar" : "Reactivar"}</button>
      <form onSubmit={saveRole}>
        <select className="user-role-select" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} aria-label={`Plan o rol de ${label}`} disabled={pending}>
          <option value="free">Free</option><option value="pro">Pro</option><option value="admin">Admin</option>
        </select>
        <button className="user-action user-action-save" type="submit" disabled={pending}>Guardar</button>
      </form>
      <button className="user-action user-action-delete" type="button" disabled={pending || isSelf} onClick={remove}>Eliminar</button>
      {message && <span className="user-action-message">{message}</span>}
    </div>
  );
}
