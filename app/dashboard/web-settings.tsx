"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UiIcon from "@/components/ui-icon";

type Preferences = { animations: boolean; largeText: boolean; density: "comfortable" | "compact" };
const KEY = "coinrenta-web-settings";
const defaults: Preferences = { animations: true, largeText: false, density: "comfortable" };

function readPreferences(): Preferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    return {
      animations: typeof parsed?.animations === "boolean" ? parsed.animations : defaults.animations,
      largeText: typeof parsed?.largeText === "boolean" ? parsed.largeText : defaults.largeText,
      density: parsed?.density === "compact" ? "compact" : "comfortable",
    };
  } catch { return defaults; }
}

export default function WebSettings() {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPrefs(readPreferences()); }, []);
  useEffect(() => {
    document.documentElement.dataset.uiAnimations = prefs.animations ? "on" : "off";
    document.documentElement.dataset.uiDensity = prefs.density;
    document.documentElement.dataset.uiLargeText = prefs.largeText ? "on" : "off";
    localStorage.setItem(KEY, JSON.stringify(prefs));
  }, [prefs]);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function reset() {
    setPrefs(defaults);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return <div className="web-settings-page">
    <section className="settings-hero panel-card">
      <div className="settings-hero-icon"><UiIcon name="settings" size={26}/></div>
      <div><span className="section-kicker">Configuración de CoinRenta</span><h2>Adapta la experiencia a tu forma de trabajar</h2><p>Esta sección contiene únicamente preferencias de funcionamiento y presentación. Tus datos personales, seguridad y suscripción están en <Link href="/dashboard/perfil">Mi Perfil</Link>.</p></div>
      {saved && <span className="settings-saved-badge"><UiIcon name="check" size={15}/> Guardado</span>}
    </section>

    <div className="settings-columns">
      <section className="settings-card panel-card">
        <div className="settings-card-head"><div><span className="section-kicker">Interfaz</span><h3>Apariencia y lectura</h3><p>Preferencias pensadas para que el panel sea cómodo de consultar.</p></div><UiIcon name="monitor" size={22}/></div>
        <div className="settings-option-list">
          <label className="settings-option"><span><strong>Densidad de interfaz</strong><small>Controla cuánto espacio ocupan tarjetas, tablas y bloques de información.</small></span><select value={prefs.density} onChange={(e) => update("density", e.target.value as Preferences["density"])}><option value="comfortable">Cómoda</option><option value="compact">Compacta</option></select></label>
          <label className="settings-option"><span><strong>Texto ampliado</strong><small>Aumenta la escala de los textos secundarios, tablas y ayudas para mejorar la lectura.</small></span><input type="checkbox" checked={prefs.largeText} onChange={(e) => update("largeText", e.target.checked)} /></label>
          <label className="settings-option"><span><strong>Animaciones</strong><small>Movimientos y transiciones suaves en menús y acciones.</small></span><input type="checkbox" checked={prefs.animations} onChange={(e) => update("animations", e.target.checked)} /></label>
        </div>
      </section>

      <section className="settings-card panel-card">
        <div className="settings-card-head"><div><span className="section-kicker">Accesibilidad</span><h3>Lectura más cómoda</h3><p>La interfaz mantiene jerarquías claras y evita textos pequeños en las áreas de trabajo.</p></div><UiIcon name="shield" size={22}/></div>
        <div className="settings-access-list"><div><span className="settings-access-check"><UiIcon name="check" size={15}/></span><div><strong>Contraste y jerarquía</strong><small>Encabezados, etiquetas y valores principales utilizan escalas diferentes.</small></div></div><div><span className="settings-access-check"><UiIcon name="check" size={15}/></span><div><strong>Controles visibles</strong><small>Botones y campos mantienen áreas de interacción amplias en escritorio y móvil.</small></div></div><div><span className="settings-access-check"><UiIcon name="check" size={15}/></span><div><strong>Preferencia persistente</strong><small>Tus ajustes visuales se conservan en este navegador.</small></div></div></div>
      </section>

      <section className="settings-card panel-card settings-card-wide">
        <div className="settings-card-head"><div><span className="section-kicker">Privacidad del dispositivo</span><h3>Cómo se guardan estas preferencias</h3><p>Son preferencias locales de interfaz. No modifican tus movimientos, cálculos fiscales, conexiones ni la información de tu cuenta.</p></div><UiIcon name="monitor" size={22}/></div>
        <div className="settings-info-grid"><div><span className="settings-info-icon"><UiIcon name="monitor" size={17}/></span><div><strong>Solo este navegador</strong><p>Las preferencias se guardan en el almacenamiento local del navegador que estás utilizando.</p></div></div><div><span className="settings-info-icon"><UiIcon name="globe" size={17}/></span><div><strong>Sincronización separada</strong><p>Tu configuración visual no interviene en datos fiscales ni en la información almacenada en tu cuenta.</p></div></div><div><span className="settings-info-icon"><UiIcon name="shield" size={17}/></span><div><strong>Restablecimiento inmediato</strong><p>Puedes volver a los valores iniciales con un solo botón.</p></div></div></div>
      </section>

      <section className="settings-card panel-card settings-card-wide settings-help-card">
        <div className="settings-card-head"><div><span className="section-kicker">Accesos rápidos</span><h3>Gestiona cada apartado desde su lugar</h3><p>La organización queda separada: configuración de la aplicación aquí; identidad, seguridad y facturación en Mi Perfil.</p></div></div>
        <div className="settings-shortcuts"><Link href="/dashboard/perfil" className="settings-shortcut"><span><UiIcon name="profile" size={19}/></span><div><strong>Mi Perfil</strong><small>Nombre, correo, seguridad, suscripción y cuenta.</small></div><UiIcon name="arrow-right" size={17}/></Link><Link href="/dashboard/exchanges" className="settings-shortcut"><span><UiIcon name="connections" size={19}/></span><div><strong>Conexiones</strong><small>Exchanges e importaciones CSV.</small></div><UiIcon name="arrow-right" size={17}/></Link><Link href="/dashboard/renta" className="settings-shortcut"><span><UiIcon name="renta" size={19}/></span><div><strong>Renta</strong><small>Información y cálculos fiscales del ejercicio.</small></div><UiIcon name="arrow-right" size={17}/></Link></div>
        <button className="btn btn-secondary settings-reset" type="button" onClick={reset}>Restablecer preferencias</button>
      </section>
    </div>
  </div>;
}
