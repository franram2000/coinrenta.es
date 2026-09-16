"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteOwnAccount, updateProfile } from "./actions";

type Props = {
  email: string;
  displayName: string | null;
  country: string;
  timezone: string;
  plan: string;
  interval: string | null;
  status: string | null;
  periodEnd: string | null;
  createdAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(parsed);
}

export default function AccountSettings({ email, displayName, country, timezone, plan, interval, status, periodEnd, createdAt }: Props) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const paid = plan === "Esencial" || plan === "Pro";

  function submitDelete() {
    setDeleteError(null);
    const data = new FormData();
    data.set("confirmation", confirmation);
    startTransition(async () => {
      try {
        await deleteOwnAccount(data);
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la cuenta.");
      }
    });
  }

  return <>
    <section className="settings-grid">
      <article className="settings-card settings-card-wide">
        <div className="settings-card-head">
          <div><span className="section-kicker">Cuenta</span><h2>Datos personales</h2><p>Actualiza la información que utilizamos para identificar y personalizar tu cuenta.</p></div>
          <span className="settings-status-pill">Cuenta activa</span>
        </div>
        <form action={async (formData) => { setSaved(false); await updateProfile(formData); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }} className="settings-form">
          <label>Nombre visible<input name="display_name" defaultValue={displayName || ""} placeholder="Tu nombre" autoComplete="name" /></label>
          <label>Email<input value={email} readOnly /></label>
          <label>País<select name="country_code" defaultValue={country}><option value="ES">España</option><option value="PT">Portugal</option><option value="FR">Francia</option><option value="DE">Alemania</option><option value="IT">Italia</option><option value="GB">Reino Unido</option><option value="NL">Países Bajos</option><option value="BE">Bélgica</option></select></label>
          <label>Zona horaria<select name="timezone" defaultValue={timezone}><option value="Europe/Madrid">Europe/Madrid</option><option value="Europe/Lisbon">Europe/Lisbon</option><option value="Europe/Paris">Europe/Paris</option><option value="Europe/Berlin">Europe/Berlin</option><option value="Europe/Rome">Europe/Rome</option><option value="Europe/London">Europe/London</option><option value="UTC">UTC</option></select></label>
          <div className="settings-form-actions"><button className="btn btn-primary" type="submit">Guardar cambios</button>{saved && <span className="settings-saved">✓ Cambios guardados</span>}</div>
        </form>
      </article>

      <article className="settings-card">
        <div className="settings-card-head"><div><span className="section-kicker">Preferencias</span><h2>Experiencia</h2><p>Ajustes locales del dispositivo para que CoinRenta se adapte a ti.</p></div></div>
        <div className="settings-list">
          <label className="settings-switch-row"><span><strong>Idioma</strong><small>Idioma de la interfaz</small></span><select defaultValue="es-ES"><option value="es-ES">Español</option><option value="en">English</option></select></label>
          <label className="settings-switch-row"><span><strong>Animaciones</strong><small>Movimientos visuales del panel</small></span><input type="checkbox" defaultChecked /></label>
          <label className="settings-switch-row"><span><strong>Avisos de revisión</strong><small>Mostrar incidencias fiscales en el panel</small></span><input type="checkbox" defaultChecked /></label>
        </div>
        <p className="settings-note">Estas preferencias se guardan en este navegador y no contienen información fiscal sensible.</p>
      </article>

      <article className="settings-card">
        <div className="settings-card-head"><div><span className="section-kicker">Seguridad</span><h2>Acceso y privacidad</h2><p>Gestiona las opciones relacionadas con el acceso a tu cuenta.</p></div></div>
        <div className="settings-action-list">
          <Link className="settings-action" href="/cambiar-contrasena"><span className="settings-action-icon">⌁</span><span><strong>Cambiar contraseña</strong><small>Actualiza la contraseña de acceso.</small></span><b>→</b></Link>
          <div className="settings-action static"><span className="settings-action-icon">◉</span><span><strong>Datos fiscales en local</strong><small>El histórico normalizado y los cálculos se mantienen en tu dispositivo.</small></span><em>Activo</em></div>
          <div className="settings-action static"><span className="settings-action-icon">✓</span><span><strong>Credenciales protegidas</strong><small>Las credenciales de conexión no se muestran en esta sección.</small></span><em>Protegido</em></div>
        </div>
      </article>

      <article className="settings-card settings-card-wide">
        <div className="settings-card-head"><div><span className="section-kicker">Suscripción</span><h2>Tu plan de CoinRenta</h2><p>Consulta el estado del plan y accede a la gestión de pagos de Stripe.</p></div><span className={`settings-plan-badge ${paid ? "paid" : ""}`}>{plan}</span></div>
        <div className="settings-subscription-grid">
          <div><span>Estado</span><strong>{status || "Activo"}</strong></div>
          <div><span>Periodicidad</span><strong>{interval === "year" ? "Anual" : interval === "month" ? "Mensual" : "Sin suscripción"}</strong></div>
          <div><span>Próximo cambio</span><strong>{paid ? formatDate(periodEnd) : "—"}</strong></div>
          <div><span>Cuenta desde</span><strong>{formatDate(createdAt)}</strong></div>
        </div>
        <div className="settings-subscription-footer"><span>{paid ? "Puedes modificar o cancelar tu suscripción desde el portal seguro de Stripe." : "Estás usando el plan gratuito."}</span><Link href="/dashboard/suscripcion" className="btn btn-outline">Gestionar suscripción →</Link></div>
      </article>

      <article className="settings-card settings-card-wide settings-danger">
        <div className="settings-card-head"><div><span className="section-kicker danger-kicker">Zona de peligro</span><h2>Eliminar cuenta</h2><p>Esta acción elimina tu cuenta y sus datos asociados. No se puede deshacer.</p></div><span className="settings-danger-mark">!</span></div>
        <div className="settings-danger-body"><div><strong>¿Quieres dejar CoinRenta?</strong><span>Antes de eliminar la cuenta se cancelará automáticamente cualquier suscripción activa en Stripe. Después se borrará el usuario de CoinRenta y se cerrará tu sesión.</span></div><button className="btn btn-danger" type="button" onClick={() => { setDeleteOpen(true); setConfirmation(""); setDeleteError(null); }}>Eliminar mi cuenta</button></div>
      </article>
    </section>

    {deleteOpen && <div className="settings-modal-backdrop" role="presentation"><div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
      <div className="settings-modal-icon">!</div><span className="section-kicker danger-kicker">Acción irreversible</span><h2 id="delete-account-title">Eliminar tu cuenta definitivamente</h2><p>Se cancelará automáticamente tu suscripción activa, si existe, y se eliminará tu cuenta de CoinRenta. Escribe <strong>ELIMINAR</strong> para confirmar.</p>
      <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="ELIMINAR" autoComplete="off" autoFocus />
      {deleteError && <div className="settings-delete-error">{deleteError}</div>}
      <div className="settings-modal-actions"><button className="btn btn-outline" type="button" disabled={isPending} onClick={() => setDeleteOpen(false)}>Cancelar</button><button className="btn btn-danger" type="button" disabled={isPending || confirmation !== "ELIMINAR"} onClick={submitDelete}>{isPending ? "Eliminando…" : "Sí, eliminar cuenta"}</button></div>
    </div></div>}
  </>;
}
