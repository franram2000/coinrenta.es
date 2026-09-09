import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Panel privado de CoinRenta.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: accountCount }, { count: transactionCount }, { count: importCount }] = await Promise.all([
    supabase.from("profiles").select("display_name, country_code").eq("id", user.id).maybeSingle(),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("imports").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const displayName = profile?.display_name || user.email?.split("@")[0] || "usuario";
  const year = new Date().getFullYear();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-logo" href="/dashboard" aria-label="CoinRenta, dashboard"><span className="brand-mark">₿</span><span className="brand-name">Coin<span>Renta</span></span></Link>
        <nav className="app-nav" aria-label="Panel principal">
          <Link className="app-nav-item active" href="/dashboard"><span>▦</span> Resumen</Link>
          <Link className="app-nav-item" href="/dashboard/exchanges"><span>↔</span> Exchanges</Link>
          <Link className="app-nav-item" href="/dashboard/importar"><span>⇧</span> Importar CSV</Link>
          <Link className="app-nav-item" href="/dashboard/movimientos"><span>≋</span> Movimientos</Link>
          <Link className="app-nav-item" href="/dashboard/fiscalidad"><span>€</span> Fiscalidad</Link>
        </nav>
        <div className="sidebar-bottom">
          <Link className="app-nav-item" href="/dashboard/configuracion"><span>⚙</span> Configuración</Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div><span className="topbar-kicker">Panel de control</span><h1>Hola, {displayName}</h1></div>
          <div className="topbar-actions"><span className="profile-chip">{displayName.slice(0, 1).toUpperCase()}</span></div>
        </header>

        <section className="dashboard-content">
          <div className="welcome-banner">
            <div><span className="section-kicker">Ejercicio {year}</span><h2>Prepara tu información fiscal</h2><p>Empieza conectando un exchange o importando el primer CSV. El resto lo iremos construyendo sobre tus movimientos.</p></div>
            <Link className="btn btn-primary" href="/dashboard/exchanges">Añadir un exchange →</Link>
          </div>

          <div className="stat-grid">
            <article className="stat-card"><span className="stat-label">Exchanges / cuentas</span><strong>{accountCount ?? 0}</strong><span className="stat-note">Fuentes conectadas</span></article>
            <article className="stat-card"><span className="stat-label">Movimientos</span><strong>{transactionCount ?? 0}</strong><span className="stat-note">Normalizados en CoinRenta</span></article>
            <article className="stat-card"><span className="stat-label">Importaciones</span><strong>{importCount ?? 0}</strong><span className="stat-note">Archivos procesados</span></article>
            <article className="stat-card stat-card-accent"><span className="stat-label">Estado</span><strong>Listo</strong><span className="stat-note">Tu espacio está operativo</span></article>
          </div>

          <div className="dashboard-grid">
            <section className="panel-card"><div className="panel-head"><div><span className="section-kicker">Siguiente paso</span><h3>Construye tu histórico</h3></div></div><div className="onboarding-list"><div className="onboarding-row"><span className="onboarding-num">01</span><div><strong>Conecta tu exchange</strong><p>Usa una API de solo lectura cuando esté disponible.</p></div><Link href="/dashboard/exchanges">Abrir</Link></div><div className="onboarding-row"><span className="onboarding-num">02</span><div><strong>Importa tus CSV</strong><p>Añade históricos exportados de tus plataformas.</p></div><Link href="/dashboard/importar">Abrir</Link></div><div className="onboarding-row"><span className="onboarding-num">03</span><div><strong>Revisa incidencias</strong><p>Detecta movimientos pendientes de conciliar.</p></div><Link href="/dashboard/movimientos">Abrir</Link></div></div></section>
            <section className="panel-card"><div className="panel-head"><div><span className="section-kicker">Ejercicio fiscal</span><h3>{year}</h3></div><span className="status-pill">En preparación</span></div><div className="empty-state"><span className="empty-icon">€</span><strong>Todavía no hay datos fiscales</strong><p>Cuando importes movimientos, este panel mostrará el resumen de ganancias, pérdidas y operaciones que requieren revisión.</p></div></section>
          </div>

          <p className="dashboard-disclaimer">CoinRenta es una herramienta de organización y cálculo. La revisión final de tus obligaciones fiscales corresponde al usuario y, cuando proceda, a su asesor.</p>
        </section>
      </main>
    </div>
  );
}
