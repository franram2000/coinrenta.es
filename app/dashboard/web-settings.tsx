"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UiIcon from "@/components/ui-icon";

type Preferences = { animations: boolean; reviewAlerts: boolean; confirmations: boolean; density: "comfortable" | "compact" };
const KEY = "coinrenta-web-settings";
const defaults: Preferences = { animations: true, reviewAlerts: true, confirmations: true, density: "comfortable" };

function readPreferences(): Preferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    return { ...defaults, ...(parsed || {}) };
  } catch { return defaults; }
}

export default function WebSettings() {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPrefs(readPreferences()); }, []);
  useEffect(() => {
    document.documentElement.dataset.uiAnimations = prefs.animations ? "on" : "off";
    document.documentElement.dataset.uiDensity = prefs.density;
    localStorage.setItem(KEY, JSON.stringify(prefs));
  }, [prefs]);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function reset() {
    setPrefs(defaults);
    localStorage.setItem(KEY, JSON.stringify(defaults));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return <div className="web-settings-page">
    <section className="settings-hero panel-card">
      <div className="settings-hero-icon"><UiIcon name="settings" size={26}/></div>
      <div><span className="section-kicker">Configuración de CoinRenta</span><h2>Adapta la experiencia a tu forma de trabajar</h2><p>Esta sección contiene únicamente preferencias de funcionamiento y presentación de la aplicación. Tus datos personales, seguridad y suscripción están en <Link href="/dashboard/perfil">Mi Perfil</Link>.</p></div>
      {saved && <span className="settings-saved-badge"><UiIcon name="check" size={15}/> Guardado</span>}
    </section>

    <div className="settings-columns">
      <section className="settings-card panel-card">
        <div className="settings-card-head"><div><span className="section-kicker">Interfaz</span><h3>Apariencia y lectura</h3><p>Preferencias pensadas para que el panel sea cómodo de consultar.</p></div><UiIcon name="monitor" size={22}/></div>
        <div className="settings-option-list">
          <label className="settings-option"><span><strong>Densidad de interfaz</strong><small>Controla cuánto espacio ocupan tarjetas, tablas y bloques de información.</small></span><select value={prefs.density} onChange={(e) => update("density", e.target.value as Preferences["density"])}><option value="comfortable">Cómoda</option><option value="compact">Compacta</option></select></label>
          <label className="settings-option"><span><strong>Animaciones</strong><small>Movimientos y transiciones suaves en menús y acciones.</small></span><input type="checkbox" checked={prefs.animations} onChange={(e) => update("animations", e.target.checked)} /></label>
        </div>
      </section>

      <section className="settings-card panel-card">
        <div className="settings-card-head"><div><span className="section-kicker">Flujo de trabajo</span><h3>Confirmaciones y avisos</h3><p>Controles de comportamiento que se guardan en este navegador.</p></div><UiIcon name="bell" size={22}/></div>
        <div className="settings-option-list">
          <label className="settings-option"><span><strong>Avisos de revisión</strong><small>Mostrar indicadores cuando haya información que conviene revisar antes de cerrar un ejercicio.</small></span><input type="checkbox" checked={prefs.reviewAlerts} onChange={(e) => update("reviewAlerts", e.target.checked)} /></label>
          <label className="settings-option"><span><strong>Confirmar acciones sensibles</strong><small>Pedir confirmación adicional antes de acciones potencialmente destructivas o irreversibles.</small></span><input type="checkbox" checked={prefs.confirmations} onChange={(e) => update("confirmations", e.target.checked)} /></label>
        </div>
      </section>

      <section className="settings-card panel-card settings-card-wide">
        <div className="settings-card-head"><div><span className="section-kicker">Privacidad del dispositivo</span><h3>Cómo se guardan estas preferencias</h3><p>Estas cuatro opciones son preferencias locales de interfaz. CoinRenta no las utiliza para identificarte ni sustituyen la información guardada en tu cuenta.</p></div><UiIcon name="shield" size={22}/></div>
        <div className="settings-info-grid"><div><span className="settings-info-icon"><UiIcon name="monitor" size={17}/></span><div><strong>Solo este navegador</strong><p>Las preferencias se guardan en el almacenamiento local del navegador que estás utilizando.</p></div></div><div><span className="settings-info-icon"><UiIcon name="globe" size={17}/></span><div><strong>Sincronización fiscal separada</strong><p>Los datos de tu cuenta y las conexiones de exchanges no dependen de estas preferencias visuales.</p></div></div><div><span className="settings-info-icon"><UiIcon name="shield" size={17}/></span><div><strong>Control directo</strong><p>Puedes restablecer cualquier preferencia a sus valores iniciales desde este mismo panel.</p></div></div></div>
      </section>

      <section className="settings-card panel-card settings-card-wide settings-help-card">
        <div className="settings-card-head"><div><span className="section-kicker">Accesos rápidos</span><h3>Gestiona lo importante desde el lugar correcto</h3><p>Hemos separado la configuración de la aplicación de la información de tu cuenta para que cada sección tenga un objetivo claro.</p></div></div>
        <div className="settings-shortcuts"><Link href="/dashboard/perfil" className="settings-shortcut"><span><UiIcon name="profile" size={19}/></span><div><strong>Mi Perfil</strong><small>Nombre, correo, seguridad, suscripción y cuenta.</small></div><UiIcon name="arrow-right" size={17}/></Link><Link href="/dashboard/exchanges" className="settings-shortcut"><span><UiIcon name="connections" size={19}/></span><div><strong>Conexiones</strong><small>Exchanges e importaciones CSV.</small></div><UiIcon name="arrow-right" size={17}/></Link><Link href="/dashboard/renta" className="settings-shortcut"><span><UiIcon name="renta" size={19}/></span><div><strong>Renta</strong><small>Información y cálculos fiscales del ejercicio.</small></div><UiIcon name="arrow-right" size={17}/></Link></div>
        <button className="btn btn-secondary settings-reset" type="button" onClick={reset}>Restablecer preferencias</button>
      </section>
    </div>
  </div>;
}
