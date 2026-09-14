import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, deleteExchangeConnection } from "../actions";
import ExchangeManager from "../exchange-manager";

const sections: Record<string, { title: string; description: string }> = {
  exchanges: { title: "Conexiones", description: "Gestiona tus exchanges e importa sus movimientos mediante CSV." },
  movimientos: { title: "Movimientos", description: "Consulta todos los movimientos normalizados de tus cuentas." },
  fiscalidad: { title: "Fiscalidad", description: "Revisa los datos que CoinRenta ha podido computar para tu actividad." },
  configuracion: { title: "Configuración", description: "Gestiona tu perfil y tu suscripción." },
};
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params; const item = sections[section];
  return item ? { title: item.title, description: item.description, robots: { index: false, follow: false } } : { title: "No encontrado", robots: { index: false, follow: false } };
}
function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"; }
function eur(value: number | string | null) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }) : "—"; }
function status(value: string | null) { if (value === "error") return "Error"; if (value === "pending") return "Pendiente"; if (value === "active") return "Conectado"; return "Desactivado"; }

export default async function DashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const item = sections[section]; if (!item) notFound();
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;

  if (section === "exchanges") {
    const [{ data: exchanges }, { data: connections }] = await Promise.all([
      supabase.from("exchanges").select("id,code,name,website").eq("is_active", true).order("name"),
      supabase.from("exchange_connections").select("id,exchange_id,label,status,last_sync_at,last_sync_status,last_sync_error,provider_type,exchanges(name,code)").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    return <><SectionHeader item={item}/><section className="dashboard-content connections-page">
      <div className="exchange-hero panel-card"><div className="exchange-hero-copy"><span className="section-kicker">Conexiones</span><h3>Importa tus exchanges por CSV</h3><p>No se solicitan claves API. Puedes importar uno o varios informes oficiales del mismo exchange y CoinRenta conservará cada movimiento original.</p></div><ExchangeManager exchanges={(exchanges || []) as Exchange[]} connections={(connections || []) as unknown[]}/></div>
      <div className="panel-card connections-panel"><div className="panel-head"><div><span className="section-kicker">TUS CONEXIONES</span><h3>{connections?.length || 0} {(connections?.length || 0) === 1 ? "conexión" : "conexiones"}</h3></div></div>
        {connections?.length ? <div className="connected-exchanges">{connections.map((connection: any) => { const exchange = one(connection.exchanges); return <article className={`connected-exchange-card connected-exchange-${String(exchange?.code || "exchange").toLowerCase()}`} key={connection.id}><div className="connected-exchange-head"><div className="connected-exchange-brand"><span className="connected-exchange-logo">{String(exchange?.name || "E").slice(0, 1).toUpperCase()}</span><div><strong>{exchange?.name || "Exchange"}</strong><span>{connection.label || "Cuenta principal"}</span></div></div><span className={`connection-status connection-status-${status(connection.status).toLowerCase()}`}><i/>{connection.provider_type === "api" ? "API desactivada" : status(connection.status)}</span></div>
          {connection.provider_type === "api" && <div className="connected-exchange-api"><small>API</small><strong>Integración desactivada</strong></div>}
          <div className="connected-exchange-info"><div><small>Método</small><strong>{connection.provider_type === "csv" ? "Importación CSV" : "API · desactivada"}</strong></div><div><small>Última importación</small><strong>{date(connection.last_sync_at)}</strong></div></div>
          {connection.last_sync_error && <div className="connection-error">{connection.last_sync_error}</div>}
          <div className="connected-exchange-footer"><span>{connection.provider_type === "csv" ? "Histórico CSV almacenado" : "Credenciales API no utilizables"}</span><form action={deleteExchangeConnection}><input type="hidden" name="connection_id" value={connection.id}/><button className="connection-delete" type="submit">Eliminar conexión</button></form></div></article>; })}</div> : <div className="connected-exchanges-empty"><strong>Aún no tienes conexiones.</strong><span>Añade un exchange e importa sus archivos CSV.</span></div>}
      </div>
      <div className="panel-card connections-panel"><div className="panel-head"><div><span className="section-kicker">CSV y cobertura</span><h3>Qué debes exportar</h3></div></div><div className="info-grid"><div><strong>Bitpanda</strong><span>Historial de transacciones CSV con compras, ventas, movimientos cripto y fiat.</span></div><div><strong>Binance</strong><span>Transacciones, depósitos y retiradas; también se admite el histórico de operaciones para completar los trades.</span></div><div><strong>Kraken y otros</strong><span>Trades, ledgers y registros de cuenta según el formato que entregue cada exchange.</span></div></div></div>
    </section></>;
  }

  if (section === "movimientos") {
    const [{ data: transactions, error }, { data: profile }] = await Promise.all([
      supabase.from("transactions").select("id,occurred_at,transaction_type,base_amount,quote_amount,fee_amount,price_currency,source,external_id,raw_data,accounts(name),base:assets!transactions_base_asset_id_fkey(symbol),quote:assets!transactions_quote_asset_id_fkey(symbol),fee:assets!transactions_fee_asset_id_fkey(symbol)").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (error) return <><SectionHeader item={item}/><section className="dashboard-content"><div className="panel-card"><div className="connection-error">No se pudieron cargar los movimientos: {error.message}</div></div></section></>;
    const isPro = profile?.role === "pro" || profile?.role === "admin";
    const locked = "***";
    return <><SectionHeader item={item}/><section className="dashboard-content"><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Histórico</span><h3>{transactions?.length || 0} movimientos mostrados</h3></div><span className="summary-data-note">Se conservan movimientos no clasificables para revisión</span></div>{transactions?.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th>Cantidad</th><th>Contrapartida</th><th>Fee</th><th>Cuenta</th></tr></thead><tbody>{transactions.map((tx: any) => { const base = one(tx.base); const quote = one(tx.quote); const fee = one(tx.fee); const raw = tx.raw_data || {}; return <tr key={tx.id}><td>{date(tx.occurred_at)}</td><td><strong>{tx.transaction_type}</strong>{raw.original_type && <small className="table-subtext">{raw.original_type}</small>}{raw.classification === "needs_review" && <small className="table-warning">Revisión</small>}</td><td>{base?.symbol || "—"}</td><td>{isPro ? (tx.base_amount ?? "—") : locked}</td><td>{isPro ? `${tx.quote_amount ?? "—"} ${quote?.symbol || tx.price_currency || ""}` : locked}</td><td>{isPro ? `${tx.fee_amount ?? "—"} ${fee?.symbol || ""}` : locked}</td><td>{tx.accounts?.name || "—"}</td></tr>; })}</tbody></table></div> : <Empty text="Todavía no hay movimientos."/>}</div></section></>;
  }

  if (section === "fiscalidad") {
    const [{ data: years }, { data: disposals }, { data: lots }] = await Promise.all([
      supabase.from("tax_years").select("id,year,status,updated_at").eq("user_id", user.id).order("year", { ascending: false }),
      supabase.from("tax_disposals").select("id,quantity,proceeds_eur,cost_basis_eur,gain_loss_eur,assets(symbol)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("tax_lots").select("id,quantity,remaining_quantity,acquisition_cost_eur,acquired_at,assets(symbol)").eq("user_id", user.id).order("acquired_at", { ascending: false }).limit(500),
    ]);
    const gain = (disposals || []).reduce((s: number, r: any) => s + Number(r.gain_loss_eur || 0), 0); const cost = (disposals || []).reduce((s: number, r: any) => s + Number(r.cost_basis_eur || 0), 0); const proceeds = (disposals || []).reduce((s: number, r: any) => s + Number(r.proceeds_eur || 0), 0);
    return <><SectionHeader item={item}/><section className="dashboard-content fiscality-page"><div className="stat-grid fiscality-stat-grid"><article className="stat-card"><span className="stat-label">Ejercicios</span><strong>{years?.length || 0}</strong><span className="stat-note">Configurados</span></article><article className="stat-card stat-card-accent"><span className="stat-label">Resultado registrado</span><strong>{eur(gain)}</strong><span className="stat-note">Ganancias/pérdidas</span></article><article className="stat-card"><span className="stat-label">Coste computado</span><strong>{eur(cost)}</strong><span className="stat-note">Base de coste</span></article><article className="stat-card"><span className="stat-label">Disposiciones</span><strong>{eur(proceeds)}</strong><span className="stat-note">Importe registrado</span></article></div>
      <div className="panel-card fiscality-section"><div className="panel-head"><div><span className="section-kicker">Ejercicios</span><h3>Histórico fiscal</h3></div></div>{years?.length ? <div className="data-list">{years.map((y: any) => <div className="data-row" key={y.id}><div><strong>Ejercicio {y.year}</strong><span>{date(y.updated_at)}</span></div><span className="status-pill">{y.status}</span></div>)}</div> : <Empty text="Todavía no hay ejercicios fiscales creados."/>}</div>
      <div className="panel-card fiscality-section"><div className="panel-head"><div><span className="section-kicker">Disposiciones</span><h3>Resultados calculados</h3></div></div>{disposals?.length ? <div className="table-wrap"><table><thead><tr><th>Activo</th><th>Cantidad</th><th>Venta EUR</th><th>Coste EUR</th><th>Resultado</th></tr></thead><tbody>{disposals.map((r: any) => <tr key={r.id}><td>{one(r.assets)?.symbol || "—"}</td><td>{r.quantity}</td><td>{eur(r.proceeds_eur)}</td><td>{eur(r.cost_basis_eur)}</td><td>{eur(r.gain_loss_eur)}</td></tr>)}</tbody></table></div> : <Empty text="Todavía no hay disposiciones calculadas."/>}</div>
      <div className="panel-card fiscality-section"><div className="panel-head"><div><span className="section-kicker">Lotes fiscales</span><h3>Inventario de coste</h3></div></div>{lots?.length ? <div className="table-wrap"><table><thead><tr><th>Activo</th><th>Adquisición</th><th>Cantidad</th><th>Restante</th><th>Coste</th></tr></thead><tbody>{lots.map((r: any) => <tr key={r.id}><td>{one(r.assets)?.symbol || "—"}</td><td>{date(r.acquired_at)}</td><td>{r.quantity}</td><td>{r.remaining_quantity}</td><td>{eur(r.acquisition_cost_eur)}</td></tr>)}</tbody></table></div> : <Empty text="Todavía no hay lotes fiscales calculados."/>}</div>
    </section></>;
  }

  const { data: profile } = await supabase.from("profiles").select("display_name,country_code,timezone,role").eq("id", user.id).maybeSingle(); const role = profile?.role || "free"; const plan = role === "admin" ? "Admin" : role === "pro" ? "Pro" : "Free"; const isPro = role !== "free";
  return <><SectionHeader item={item}/><section className="dashboard-content"><div className={`subscription-card ${isPro ? "subscription-pro" : "subscription-free"}`}><div className="subscription-glow"/><div className="subscription-main"><div className="subscription-icon">♛</div><div><span className="section-kicker">Tu suscripción</span><h2>Plan {plan}</h2><p>{isPro ? "Tienes acceso completo a las funcionalidades de CoinRenta." : "Estás en el plan gratuito con las funciones esenciales."}</p></div></div><div className="subscription-meta"><span><strong>Estado</strong><b>● Activo</b></span><span><strong>Cuenta</strong><b>{user.email || "Usuario"}</b></span><Link className="btn btn-primary" href="/dashboard/configuracion">Gestionar plan</Link></div></div><div className="subscription-features"><div><span>✓</span><strong>Importación CSV</strong><small>Importa históricos de exchanges compatibles.</small></div><div><span>✓</span><strong>Histórico normalizado</strong><small>Conserva cada movimiento y su origen.</small></div><div><span>✓</span><strong>Herramientas fiscales</strong><small>{isPro ? "Herramientas fiscales avanzadas incluidas." : "Disponible al pasar a Pro."}</small></div><div><span>✓</span><strong>Seguridad</strong><small>Sin claves API para las conexiones CSV.</small></div></div><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Perfil</span><h3>Datos de tu cuenta</h3></div></div><form action={updateProfile} className="form-grid"><label>Nombre visible<input name="display_name" defaultValue={profile?.display_name || ""} placeholder="Tu nombre"/></label><label>País<input value={profile?.country_code || "ES"} readOnly/></label><label>Zona horaria<input value={profile?.timezone || "Europe/Madrid"} readOnly/></label><div><button className="btn btn-primary" type="submit">Guardar cambios</button></div></form></div></section></>;
}
function SectionHeader({ item }: { item: { title: string; description: string } }) { return <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>{item.title}</h1><p>{item.description}</p></div></header>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><strong>{text}</strong><p>Cuando añadas datos, aparecerán aquí automáticamente.</p></div>; }
type Exchange = { id: string; code: string; name: string; website: string | null };
