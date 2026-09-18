"use client";

import { useState, useTransition, type FormEvent } from "react";
import { adminDeleteUser, adminUpdateUser } from "../actions";

type Props = {
  userId: string;
  role: string | null;
  subscriptionPlan: string | null;
  isActive: boolean;
  label: string;
  isSelf: boolean;
};
type AdminAction = typeof adminUpdateUser | typeof adminDeleteUser;

export default function UserActions({ userId, role, subscriptionPlan, isActive, label, isSelf }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const normalizedRole = role === "admin" ? "admin" : "user";
  const normalizedPlan = subscriptionPlan === "essential" || subscriptionPlan === "pro" ? subscriptionPlan : "free";
  const [selectedRole, setSelectedRole] = useState(normalizedRole);
  const [selectedPlan, setSelectedPlan] = useState(normalizedPlan);

  function run(action: AdminAction, data: Record<string, string>, success: string) {
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
    run(
      adminUpdateUser,
      {
        user_id: userId,
        role: normalizedRole,
        subscription_plan: normalizedPlan,
        is_active: isActive ? "false" : "true",
      },
      isActive ? "Acceso desactivado." : "Acceso reactivado.",
    );
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      adminUpdateUser,
      {
        user_id: userId,
        role: selectedRole,
        subscription_plan: selectedPlan,
        is_active: isActive ? "true" : "false",
      },
      "Cambios guardados.",
    );
  }

  function remove() {
    if (isSelf || !window.confirm(`¿Eliminar definitivamente la cuenta de ${label}? Se borrarán sus datos y no podrás reactivarla después.`)) return;
    run(adminDeleteUser, { user_id: userId }, "Usuario eliminado.");
  }

  return (
    <div className="user-actions" aria-live="polite">
      <button className="user-action" type="button" disabled={pending || isSelf} onClick={toggleActive}>
        {isActive ? "Desactivar" : "Reactivar"}
      </button>
      <form className="user-action-form" onSubmit={save}>
        <select
          className="user-role-select"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
          aria-label={`Rol de ${label}`}
          disabled={pending}
        >
          <option value="user">Usuario</option>
          <option value="admin">Admin</option>
        </select>
        <select
          className="user-subscription-select"
          value={selectedPlan}
          onChange={(event) => setSelectedPlan(event.target.value)}
          aria-label={`Suscripción de ${label}`}
          disabled={pending}
        >
          <option value="free">Free</option>
          <option value="essential">Esencial</option>
          <option value="pro">Pro</option>
        </select>
        <button className="user-action user-action-save" type="submit" disabled={pending}>
          Guardar
        </button>
      </form>
      <button className="user-action user-action-delete" type="button" disabled={pending || isSelf} onClick={remove}>
        Eliminar
      </button>
      {message && <span className="user-action-message">{message}</span>}
    </div>
  );
}
