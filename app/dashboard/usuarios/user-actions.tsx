"use client";

import { useState } from "react";
import { adminDeleteUser, adminUpdateUser } from "../actions";

type Props = {
  userId: string;
  role: string | null;
  isActive: boolean;
  label: string;
  isSelf: boolean;
};

export default function UserActions({ userId, role, isActive, label, isSelf }: Props) {
  const [pending, setPending] = useState(false);

  function confirmDelete() {
    return window.confirm(
      `¿Eliminar definitivamente la cuenta de ${label}? Esta acción cerrará su acceso y no se puede deshacer.`,
    );
  }

  return (
    <div className="user-actions">
      <form action={adminUpdateUser} onSubmit={() => setPending(true)}>
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="role" value={role || "free"} />
        <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
        <button className="user-action" type="submit" disabled={pending || isSelf} title={isSelf ? "No puedes desactivar tu propia cuenta" : undefined}>
          {isActive ? "Desactivar" : "Reactivar"}
        </button>
      </form>
      <form action={adminUpdateUser} onSubmit={() => setPending(true)}>
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
        <select className="user-role-select" name="role" defaultValue={role || "free"} aria-label={`Plan o rol de ${label}`} disabled={pending}>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="admin">Admin</option>
        </select>
        <button className="user-action user-action-save" type="submit" disabled={pending}>Guardar</button>
      </form>
      <form
        action={adminDeleteUser}
        onSubmit={(event) => {
          if (!confirmDelete()) {
            event.preventDefault();
            return;
          }
          setPending(true);
        }}
      >
        <input type="hidden" name="user_id" value={userId} />
        <button className="user-action user-action-delete" type="submit" disabled={pending || isSelf} title={isSelf ? "No puedes eliminar tu propia cuenta" : undefined}>
          Eliminar
        </button>
      </form>
    </div>
  );
}
