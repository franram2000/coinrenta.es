"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import UiIcon from "@/components/ui-icon";
import { deleteOwnAccount, updateProfile } from "./profile-actions";

type Props = {
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  country: string;
  timezone: string;
  role: string;
  plan: string;
  interval: string | null;
  status: string | null;
  periodEnd: string | null;
  createdAt: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(d);
}

function planLabel(plan: string) {
  if (plan === "pro") return "Pro";
  if (plan === "essential") return "Esencial";
  if (plan === "admin") return "Administrador";
  return "Free";
}

function statusLabel(status: string | null) {
  if (status === "active") return "Activa";
  if (status === "trialing") return "Prueba activa";
  if (status === "past_due") return "Pago pendiente";
  if (status === "paused") return "Pausada";
  if (status === "canceled") return "Cancelada";
  return "Sin suscripción";
}

export default function ProfilePanel({ email, emailVerified, displayName, country, timezone, role, plan, interval, status, periodEnd, createdAt }: Props) {
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const currentPlan = planLabel(plan);
  const initials = (displayName || email).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "CR";
  const paid = plan === "pro" || plan === "essential";

  function removeAccount() {
    setDeleteError(null);
    const form = new FormData();
    form.set("confirmation", confirmation);
    startTransition(async () => {
      try { await deleteOwnAccount(form); }
      catch (error) { setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la cuenta."); }
    });
  }

  return <div className="profile-page">
    <section className="profile-hero panel-card">
      <div className="profile-hero-main">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div className="profile-hero-copy"><span className="section-kicker">Mi Perfil</span><h2>{displayName || "Tu cuenta CoinRenta"}</h2><p>{email}</p><div className="profile-badges"><span className="profile-badge"><UiIcon name="shield" size={14}/> {role === "admin" ? "Administrador" : "Cuenta personal"}</span><span className={`profile-badge ${paid ? "accent" : ""}`}><UiIcon name="credit-card" size={14}/> Plan {currentPlan}</span></div></div>
      </div>
      <div className="profile-hero-status"><span className="profile-status-dot"/><strong>Cuenta activa</strong><small>Miembro desde {formatDate(createdAt)}</small></div>
    </section>

    <div className="profile-stat-grid">
      <article className="profile-stat"><span>Plan actual</span><strong>{currentPlan}</strong><small>{paid ? `${interval === "year" ? "Anual" : "Mensual"} · ${statusLabel(status)}` : "Acceso gratuito"}</small></article>
      <article className="profile-stat"><span>Correo</span><strong>{emailVerified ? "Verificado" : "Pendiente"}</strong><small>{email}</small></article>
      <article className="profile-stat"><span>Periodo actual</span><strong>{paid ? formatDate(periodEnd) : "—"}</strong><small>{paid ? "Próxima renovación según tu plan" : "No aplica"}</small></article>
      <article className="profile-stat"><span>Zona horaria</span><strong>{timezone.replace("Europe/", "").replace("_", " ")}</strong><small>{country === "ES" ? "España" : country}</small></article>
    </div>

    <div className="profile-grid">
      <section className="profile-card panel-card profile-card-wide">
        <div className="profile-card-head"><div><span className="section-kicker">Información personal</span><h3>Datos de tu perfil</h3><p>Mantenlos actualizados para que la experiencia y las comunicaciones de CoinRenta sean correctas.</p></div><UiIcon name="profile" size={22}/></div>
        <form action={async (form) => { setSaved(false); await updateProfile(form); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }} className="profile-form">
          <label>Nombre visible<input name="display_name" defaultValue={displayName || ""} placeholder="Tu nombre" autoComplete="name" /></label>
          <label>Correo electrónico<div className="profile-readonly"><UiIcon name="lock" size={16}/><span>{email}</span><em>{emailVerified ? "Verificado" : "Pendiente"}</em></div></label>
          <label>País<select name="country_code" defaultValue={country}><option value="ES">España</option><option value="PT">Portugal</option><option value="FR">Francia</option><option value="DE">Alemania</option><option value="IT">Italia</option><option value="GB">Reino Unido</option><option value="NL">Países Bajos</option><option value="BE">Bélgica</option></select></label>
          <label>Zona horaria<select name="timezone" defaultValue={timezone}><option value="Europe/Madrid">Europe/Madrid</option><option value="Europe/Lisbon">Europe/Lisbon</option><option value="Europe/Paris">Europe/Paris</option><option value="Europe/Berlin">Europe/Berlin</option><option value="Europe/Rome">Europe/Rome</option><option value="Europe/London">Europe/London</option><option value="UTC">UTC</option></select></label>
          <div className="profile-form-actions"><button className="btn btn-primary" type="submit">Guardar cambios</button>{saved && <span className="profile-saved"><UiIcon name="check" size={16}/> Cambios guardados</span>}</div>
        </form>
      </section>

      <section className="profile-card panel-card">
        <div className="profile-card-head"><div><span className="section-kicker">Seguridad</span><h3>Acceso protegido</h3><p>Gestiona las credenciales y comprueba el estado de tu acceso.</p></div><UiIcon name="lock" size={22}/></div>
        <div className="profile-action-stack">
          <Link href="/recuperar" className="profile-action"><span className="profile-action-icon"><UiIcon name="lock" size={18}/></span><span><strong>Cambiar contraseña</strong><small>Inicia el proceso seguro de recuperación y establece una nueva contraseña.</small></span><UiIcon name="arrow-right" size={17}/></Link>
          <div className="profile-action static"><span className="profile-action-icon"><UiIcon name="shield" size={18}/></span><span><strong>Estado de la cuenta</strong><small>Tu cuenta está habilitada para usar CoinRenta.</small></span><em>Activa</em></div>
        </div>
      </section>

      <section className="profile-card panel-card profile-billing-card">
        <div className="profile-card-head"><div><span className="section-kicker">Suscripción y facturación</span><h3>Tu plan CoinRenta</h3><p>Consulta el estado de tu suscripción y gestiona el pago desde el portal seguro de Paddle.</p></div><UiIcon name="credit-card" size={22}/></div>
        <div className="profile-billing-summary"><div className="profile-plan-icon"><UiIcon name="credit-card" size={22}/></div><div><strong>Plan {currentPlan}</strong><span>{paid ? `${interval === "year" ? "Facturación anual" : "Facturación mensual"} · ${statusLabel(status)}` : "Sin suscripción de pago"}</span></div><span className={`profile-plan-status ${paid ? "active" : "free"}`}>{paid ? "ACTIVA" : "FREE"}</span></div>
        <div className="profile-billing-grid"><div><span>Periodo</span><strong>{paid ? formatDate(periodEnd) : "No aplica"}</strong></div><div><span>Gestión</span><strong>{paid ? "Portal de Paddle" : "Planes disponibles"}</strong></div></div>
        <div className="profile-card-footer"><span>{paid ? "Desde aquí puedes revisar cambios, datos de pago y cancelación." : "Puedes actualizar tu plan cuando lo necesites."}</span><Link className="btn btn-primary" href="/dashboard/suscripcion">{paid ? "Gestionar suscripción" : "Ver planes"} <UiIcon name="arrow-right" size={16}/></Link></div>
      </section>

      <section className="profile-card panel-card">
        <div className="profile-card-head"><div><span className="section-kicker">Privacidad</span><h3>Datos y control</h3><p>La configuración fiscal y las conexiones de exchanges se mantienen separadas de tu información de perfil.</p></div><UiIcon name="shield" size={22}/></div>
        <div className="profile-info-list"><div><UiIcon name="globe" size={17}/><span><strong>Preferencia regional</strong><small>{country === "ES" ? "España" : country} · {timezone}</small></span></div><div><UiIcon name="shield" size={17}/><span><strong>Credenciales</strong><small>Las claves de conexión no se muestran en tu perfil.</small></span></div></div>
      </section>

      <section className="profile-card panel-card profile-danger profile-card-wide">
        <div className="profile-card-head"><div><span className="section-kicker danger-kicker">Zona de peligro</span><h3>Eliminar cuenta</h3><p>Elimina tu cuenta de CoinRenta y los datos asociados. Esta acción es permanente.</p></div><span className="profile-danger-icon"><UiIcon name="trash" size={19}/></span></div>
        <div className="profile-danger-body"><div><strong>¿Seguro que quieres eliminar tu cuenta?</strong><span>Antes de borrar la cuenta se gestionará la cancelación de las suscripciones que estén asociadas y después se cerrará tu sesión.</span></div><button className="btn btn-danger" type="button" onClick={() => { setDeleteOpen(true); setConfirmation(""); setDeleteError(null); }}>Eliminar mi cuenta</button></div>
      </section>
    </div>

    {deleteOpen && <div className="profile-modal-backdrop"><div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-delete-title"><span className="profile-modal-icon"><UiIcon name="trash" size={20}/></span><span className="section-kicker danger-kicker">Acción irreversible</span><h3 id="profile-delete-title">Eliminar cuenta definitivamente</h3><p>Escribe <strong>ELIMINAR</strong> para confirmar. Esta acción no se puede deshacer.</p><input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="ELIMINAR" autoComplete="off" autoFocus />{deleteError && <div className="profile-delete-error">{deleteError}</div>}<div className="profile-modal-actions"><button className="btn btn-secondary" type="button" disabled={pending} onClick={() => setDeleteOpen(false)}>Cancelar</button><button className="btn btn-danger" type="button" disabled={pending || confirmation !== "ELIMINAR"} onClick={removeAccount}>{pending ? "Eliminando…" : "Sí, eliminar cuenta"}</button></div></div></div>}
  </div>;
}
