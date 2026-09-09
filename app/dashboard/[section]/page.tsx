import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { addExchangeConnection, createImportRecord, updateProfile } from "../actions";

const sections: Record<string, { title: string; description: string }> = {
  exchanges: { title: "Exchanges", description: "Gestiona las fuentes de datos y sus cuentas." },
  importar: { title: "Importar CSV", description: "Registra y controla tus importaciones históricas." },
  movimientos: { title: "Movimientos", description: "Consulta los movimientos normalizados de tus cuentas." },
  fiscalidad: { title: "Fiscalidad", description: "Revisa ejercicios, lotes fiscales y resultados." },
  configuracion: { title: "Configuración", description: "Gestiona tu perfil y preferencias." },
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  if (!sections[section]) return { title: "No encontrado", robots: { index: false, follow: false } };
  return { title: sections[section].title, description: sections[section].description, robots: { index: false, follow: false } };
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default async function DashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = sections[section];
  if (!item) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (section === "exchanges") {
    const [{ data: exchanges }, { data: connections }] = await Promise.all([
      supabase.from("exchanges").select("id, code, name, website").eq("is_active", true).order("name"),
      supabase.from("exchange_connections").select("id, exchange_id, label, status, last_sync_at, last_sync_status, exchanges(name, code)").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    return <Page title={item.title} description={item.description}>
      <div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Nueva conexión</span><h3>Añadir exchange</h3></div></div>
        <form action={addExchangeConnection} className="form-grid">
          <label>Exchange<select name="exchange_id" required><option value="">Selecciona un exchange</option>{exchanges?.map((exchange) => <option value={exchange.id} key={exchange.id}>{exchange.name} ({exchange.code})</option>)}</select></label>
          <label>Nombre de la cuenta<input name="label" placeholder="Ej. Binance principal" /></label>
          <div><button className="btn btn-primary" type="submit">Guardar conexión</button></div>
        </form>
      </div>
      <div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Tus conexiones</span><h3>{connections?.length ?? 0} conexiones</h3></div></div>
        {connections?.length ? <div className="data-list">{connections.map((connection) => <div className="data-row" key={connection.id}><div><strong>{(connection.exchanges as { name?: string } | null)?.name || "Exchange"}</strong><span>{connection.label || "Sin nombre"}</span></div><span className="status-pill">{connection.status}</span><span>{date(connection.last_sync_at)}</span></div>)}</div> : <Empty text="Todavía no tienes exchanges conectados." />}
      </div>
    </Page>;
  }

  if (section === "importar") {
    const [{ data: accounts }, { data: imports }] = await Promise.all([
      supabase.from("accounts").select("id, name, connection_id").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("imports").select("id, file_name, source_type, status, rows_total, rows_processed, rows_failed, created_at, imported_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    return <Page title={item.title} description={item.description}>
      <div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Preparar importación</span><h3>Registrar un CSV</h3></div></div>
        <form action={createImportRecord} className="form-grid">
          <label>Nombre del archivo<input name="file_name" type="text" placeholder="binance-2025.csv" required /></label>
          <label>Cuenta<select name="account_id"><option value="">Sin cuenta</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
          <div><button className="btn btn-primary" type="submit">Registrar CSV</button></div>
        </form>
        <p className="form-help">El registro queda asociado a tu usuario. El parser de CSV y la normalización serán la siguiente capa del módulo.</p>
      </div>
      <div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Histórico</span><h3>Últimas importaciones</h3></div></div>
        {imports?.length ? <div className="data-list">{imports.map((entry) => <div className="data-row" key={entry.id}><div><strong>{entry.file_name || "CSV"}</strong><span>{entry.source_type}</span></div><span className="status-pill">{entry.status}</span><span>{entry.rows_processed}/{entry.rows_total}</span><span>{date(entry.created_at)}</span></div>)}</div> : <Empty text="Todavía no hay importaciones." />}
      </div>
    </Page>;
  }

  if (section === "movimientos") {
    const { data: transactions } = await supabase.from("transactions").select("id, occurred_at, transaction_type, base_amount, quote_amount, price_currency, source, external_id, accounts(name)").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(100);
    return <Page title={item.title} description={item.description}><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Últimos movimientos</span><h3>{transactions?.length ?? 0} registros mostrados</h3></div></div>
      {transactions?.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cuenta</th><th>Base</th><th>Quote</th><th>Origen</th></tr></thead><tbody>{transactions.map((tx) => <tr key={tx.id}><td>{date(tx.occurred_at)}</td><td>{tx.transaction_type}</td><td>{(tx.accounts as { name?: string } | null)?.name || "—"}</td><td>{tx.base_amount ?? "—"}</td><td>{tx.quote_amount ?? "—"} {tx.price_currency || ""}</td><td>{tx.source}</td></tr>)}</tbody></table></div> : <Empty text="Todavía no hay movimientos. Importa un CSV o conecta un exchange." />}
    </div></Page>;
  }

  if (section === "fiscalidad") {
    const [{ data: years }, { data: disposals }] = await Promise.all([
      supabase.from("tax_years").select("id, year, status, created_at, updated_at").eq("user_id", user.id).order("year", { ascending: false }),
      supabase.from("tax_disposals").select("id, tax_year_id, quantity, proceeds_eur, cost_basis_eur, gain_loss_eur, assets(symbol)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    const gain = (disposals || []).reduce((sum, row) => sum + Number(row.gain_loss_eur || 0), 0);
    return <Page title={item.title} description={item.description}><div className="stat-grid"><article className="stat-card"><span className="stat-label">Ejercicios</span><strong>{years?.length ?? 0}</strong><span className="stat-note">Configurados</span></article><article className="stat-card stat-card-accent"><span className="stat-label">Resultado registrado</span><strong>{gain.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</strong><span className="stat-note">Ganancias/pérdidas</span></article></div>
      <div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Ejercicios</span><h3>Histórico fiscal</h3></div></div>{years?.length ? <div className="data-list">{years.map((year) => <div className="data-row" key={year.id}><div><strong>Ejercicio {year.year}</strong><span>{date(year.updated_at)}</span></div><span className="status-pill">{year.status}</span></div>)}</div> : <Empty text="Todavía no hay ejercicios fiscales creados." />}</div>
      <div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Disposiciones</span><h3>Resultados calculados</h3></div></div>{disposals?.length ? <div className="table-wrap"><table><thead><tr><th>Activo</th><th>Cantidad</th><th>Venta EUR</th><th>Coste EUR</th><th>Resultado</th></tr></thead><tbody>{disposals.map((row) => <tr key={row.id}><td>{(row.assets as { symbol?: string } | null)?.symbol || "—"}</td><td>{row.quantity}</td><td>{Number(row.proceeds_eur).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td><td>{Number(row.cost_basis_eur).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td><td>{Number(row.gain_loss_eur).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td></tr>)}</tbody></table></div> : <Empty text="Todavía no hay disposiciones calculadas." />}</div>
    </Page>;
  }

  const { data: profile } = await supabase.from("profiles").select("display_name, country_code, timezone").eq("id", user.id).maybeSingle();
  return <Page title={item.title} description={item.description}><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Perfil</span><h3>Datos de tu cuenta</h3></div></div><form action={updateProfile} className="form-grid"><label>Nombre visible<input name="display_name" defaultValue={profile?.display_name || ""} placeholder="Tu nombre" /></label><label>País<input value={profile?.country_code || "ES"} readOnly /></label><label>Zona horaria<input value={profile?.timezone || "Europe/Madrid"} readOnly /></label><div><button className="btn btn-primary" type="submit">Guardar cambios</button></div></form></div><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Cuenta</span><h3>{user.email}</h3></div></div><p className="section-lead">La cuenta está autenticada con Supabase. Tus consultas están aisladas por usuario mediante las políticas RLS de la base de datos.</p></div></Page>;
}

function Page({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="app-shell"><aside className="app-sidebar"><Link className="app-logo" href="/dashboard"><span className="brand-mark">₿</span><span className="brand-name">Coin<span>Renta</span></span></Link><nav className="app-nav"><Link className="app-nav-item" href="/dashboard">▦ Resumen</Link><Link className="app-nav-item" href="/dashboard/exchanges">↔ Exchanges</Link><Link className="app-nav-item" href="/dashboard/importar">⇧ Importar CSV</Link><Link className="app-nav-item" href="/dashboard/movimientos">≋ Movimientos</Link><Link className="app-nav-item" href="/dashboard/fiscalidad">€ Fiscalidad</Link><Link className="app-nav-item" href="/dashboard/configuracion">⚙ Configuración</Link></nav></aside><main className="app-main"><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>{title}</h1><p>{description}</p></div></header><section className="dashboard-content">{children}</section></main></div>;
}

function Empty({ text }: { text: string }) { return <div className="empty-state"><strong>{text}</strong><p>Cuando añadas datos, aparecerán aquí automáticamente.</p></div>; }
