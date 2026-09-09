import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumen", description: "Resumen patrimonial y fiscal de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Snapshot = any;

function Stat({ icon, label, value, note, accent = false }: { icon: string; label: string; value: string; note: string; accent?: boolean }) {
  return <article className={`stat-card ${accent ? "stat-card-accent" : ""}`}><span className="stat-icon">{icon}</span><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className="stat-note">{note}</small></div></article>;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: transactionCount }, { count: activeCsvCount }, { count: connectionCount }, { data: snapshots }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("provider_type", "csv").eq("status", "active"),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
    supabase.from("balance_snapshots").select("id,captured_at,value_eur,quantity,price_eur,source,asset:assets(symbol,name),account:accounts(id,name,connection:exchange_connections(id,label,provider_type,exchange:exchanges(name,code)))").eq("user_id", user.id).order("captured_at", { ascending: true }).limit(10000),
  ]);

  const name = profile?.display_name || user.email?.split("@")[0] || "usuario";
  const initials = name.slice(0, 1).toUpperCase();
  const latest = latestPositions(snapshots || []);
  const currentRows = [...latest.values()].filter((row: Snapshot) => {
    const quantity = Number(row.quantity);
    const symbol = String(one(row.asset)?.symbol || "").trim();
    return Number.isFinite(quantity) && quantity > 1e-12 && symbol && symbol !== "-";
  });
  const valuedRows = currentRows.filter((row: Snapshot) => Number.isFinite(Number(row.value_eur)) && Number(row.value_eur) >= 0);
  const total = valuedRows.reduce((sum: number, row: Snapshot) => sum + Number(row.value_eur), 0);
  const unvalued = currentRows.filter((row: Snapshot) => !Number.isFinite(Number(row.value_eur))).length;
  const exchangeRows = buildExchangeRows(currentRows);

  return <>
    <header className="app-topbar dashboard-topbar-modern"><div className="dashboard-search">⌕ <span>Buscar por activo, exchange, transacción...</span></div><div className="topbar-actions"><span className="notification">♧<i /></span><span className="profile-chip">{initials}</span><div className="profile-summary"><strong>{name}</strong></div><span className="profile-chevron">⌄</span></div></header>
    <section className="dashboard-content dashboard-modern-content">
      <div className="dashboard-heading-row"><div><h1>Hola, {name} 👋</h1><p>Aquí tienes un resumen real de tu cartera, conexiones e importaciones.</p></div></div>
      <div className="dashboard-layout-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}><div className="dashboard-main-column" style={{ width: "100%" }}>
        <div className="stat-grid stat-grid-modern"><Stat icon="◎" label="Saldo actual de la cartera" value={eur(total)} note={unvalued ? `${unvalued} posiciones sin valoración EUR` : "Valoración actual disponible"} accent={unvalued > 0}/><Stat icon="▤" label="Movimientos" value={String(transactionCount || 0)} note="Registros normalizados"/><Stat icon="⇧" label="Importaciones" value={String(activeCsvCount || 0)} note="Importaciones CSV activas"/><Stat icon="✓" label="Posiciones" value={String(currentRows.length)} note={`${connectionCount || 0} conexiones activas`}/></div>

        <section className="panel-card exchange-holdings-card">
          <div className="panel-head"><div><h3>Activos por exchange</h3><p>Desglose de todos los activos que tienen saldo positivo en cada conexión.</p></div><Link className="panel-link" href="/dashboard/exchanges">Gestionar conexiones</Link></div>
          {exchangeRows.length ? <div className="exchange-table">
            <div className="exchange-table-head"><span>Exchange</span><span>Activo</span><span>Saldo</span><span>Valor EUR</span><span>% cartera</span></div>
            {exchangeRows.map((ex: any) => ex.assets.map((asset: any, index: number) => <div className="exchange-table-row" key={`${ex.key}:${asset.symbol}`}>
              {index === 0 ? <div className="exchange-name"><span className="exchange-logo">{ex.code.slice(0, 1).toUpperCase()}</span><div><strong>{ex.name}</strong><small>{ex.assets.length} activos con saldo</small><span className="dashboard-summary-exchange-source">{ex.source}</span></div></div> : <div className="exchange-name exchange-name-continuation"><span></span><div><strong>{ex.name}</strong></div></div>}
              <div><strong>{asset.symbol}</strong><small className="dashboard-summary-exchange-asset-name">{asset.name || asset.symbol}</small></div>
              <span className="exchange-balance">{formatQuantity(asset.quantity)}</span>
              <strong>{Number.isFinite(asset.value) ? eur(asset.value) : "Sin valoración"}</strong>
              <span>{total > 0 && Number.isFinite(asset.value) ? `${((asset.value / total) * 100).toFixed(1)}%` : "—"}</span>
            </div>))}
          </div> : <div className="dashboard-summary-empty"><strong>Aún no hay activos con saldo</strong><span>Conecta un exchange o importa un CSV para que aparezcan aquí únicamente las posiciones con saldo positivo.</span></div>}
        </section>
      </div></div>
      <div className="dashboard-footer-trust"><span>◈ <strong>Seguro y confiable</strong><small>Tus datos y claves siempre protegidos</small></span><span>▣ <strong>Cumplimiento fiscal</strong><small>Datos preparados para tus cálculos</small></span><span>⟳ <strong>Conexiones automáticas</strong><small>{connectionCount || 0} conexiones activas</small></span><span>◉ <strong>Soporte en español</strong><small>Estamos aquí para ayudarte</small></span></div>
    </section>
  </>;
}

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function eur(value: number) { return Number.isFinite(value) ? value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }) : "—"; }
function formatQuantity(value: number) { return Number.isFinite(value) ? value.toLocaleString("es-ES", { maximumFractionDigits: 8 }) : "—"; }

function positionKey(row: Snapshot) {
  const account = one(row.account);
  const asset = one(row.asset);
  return `${account?.id || account?.name || "account"}:${String(asset?.symbol || "asset").toUpperCase()}`;
}

function latestPositions(rows: Snapshot[]) {
  const result = new Map<string, Snapshot>();
  for (const row of rows) {
    const timestamp = new Date(row.captured_at).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const key = positionKey(row);
    const existing = result.get(key);
    if (!existing || timestamp > new Date(existing.captured_at).getTime()) result.set(key, { ...row, account: one(row.account), asset: one(row.asset) });
  }
  return result;
}

function buildExchangeRows(current: Snapshot[]) {
  const rows = new Map<string, any>();
  for (const item of current) {
    const account = one(item.account);
    const connection = one(account?.connection);
    const exchange = one(connection?.exchange);
    const key = connection?.id || `${exchange?.code || "other"}:${account?.name || "account"}`;
    const symbol = String(one(item.asset)?.symbol || "").trim().toUpperCase();
    if (!symbol || symbol === "-") continue;
    const row = rows.get(key) || {
      key,
      name: exchange?.name || connection?.label || "Sin exchange",
      code: exchange?.code || "—",
      source: connection?.provider_type === "csv" || item.source === "calculated" ? "CSV" : "API",
      assets: [],
    };
    const quantity = Number(item.quantity);
    const value = Number(item.value_eur);
    row.assets.push({ symbol, name: one(item.asset)?.name || symbol, quantity, value: Number.isFinite(value) ? value : null });
    rows.set(key, row);
  }
  for (const row of rows.values()) row.assets.sort((a: any, b: any) => b.quantity - a.quantity || a.symbol.localeCompare(b.symbol));
  return [...rows.values()].sort((a, b) => {
    const av = a.assets.reduce((sum: number, asset: any) => sum + (Number.isFinite(asset.value) ? asset.value : 0), 0);
    const bv = b.assets.reduce((sum: number, asset: any) => sum + (Number.isFinite(asset.value) ? asset.value : 0), 0);
    return bv - av || a.name.localeCompare(b.name);
  });
}
