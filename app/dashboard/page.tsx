import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumen", description: "Resumen patrimonial de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "3m" | "1y" | "all";
type Asset = { symbol?: string | null; name?: string | null };
type Exchange = { name?: string | null; code?: string | null };
type Connection = {
  id?: string;
  label?: string | null;
  provider_type?: string | null;
  exchange?: Exchange | Exchange[] | null;
};
type Account = {
  id?: string;
  name?: string | null;
  connection?: Connection | Connection[] | null;
};
type Snapshot = {
  id?: string;
  captured_at: string;
  value_eur: number | string | null;
  quantity: number | string | null;
  price_eur?: number | string | null;
  source?: string | null;
  asset?: Asset | Asset[] | null;
  account?: Account | Account[] | null;
};
type ExchangeAsset = { symbol: string; value: number };
type ExchangeBreakdown = { key: string; name: string; code: string; value: number; assets: ExchangeAsset[] };

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function eur(value: number) { return Number.isFinite(value) ? value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }) : "—"; }
function Stat({ icon, label, value, note, accent = false }: { icon: string; label: string; value: string; note: string; accent?: boolean }) {
  return <article className={`stat-card ${accent ? "stat-card-accent" : ""}`}><span className="stat-icon">{icon}</span><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className="stat-note">{note}</small></div></article>;
}

const palette = ["#20C9BF", "#6366F1", "#F59E0B", "#EF6B73", "#8B5CF6", "#3B82F6", "#22C55E", "#EC4899"];

function positionKey(row: Snapshot) {
  const account = one(row.account); const asset = one(row.asset);
  return `${account?.id || account?.name || "account"}:${String(asset?.symbol || "asset").toUpperCase()}`;
}
function latestPositions(rows: Snapshot[]) {
  const result = new Map<string, Snapshot>();
  for (const row of rows) {
    const timestamp = new Date(row.captured_at).getTime(); if (!Number.isFinite(timestamp)) continue;
    const key = positionKey(row); const existing = result.get(key);
    if (!existing || timestamp > new Date(existing.captured_at).getTime()) result.set(key, { ...row, account: one(row.account), asset: one(row.asset) });
  }
  return result;
}
function buildExchanges(current: Snapshot[]): ExchangeBreakdown[] {
  const exchanges = new Map<string, { key: string; name: string; code: string; value: number; assets: Map<string, number> }>();
  for (const item of current) {
    const account = one(item.account); const connection = one(account?.connection); const exchange = one(connection?.exchange);
    const key = connection?.id || `${exchange?.code || "other"}:${account?.name || "account"}`;
    const symbol = String(one(item.asset)?.symbol || "").trim().toUpperCase();
    const value = Number(item.value_eur);
    if (!symbol || symbol === "-" || !Number.isFinite(value)) continue;
    const row = exchanges.get(key) || { key, name: exchange?.name || connection?.label || "Sin exchange", code: exchange?.code || "—", value: 0, assets: new Map<string, number>() };
    row.value += value; row.assets.set(symbol, (row.assets.get(symbol) || 0) + value); exchanges.set(key, row);
  }
  return [...exchanges.values()].map((exchange): ExchangeBreakdown => ({ ...exchange, assets: [...exchange.assets.entries()].map(([symbol, value]) => ({ symbol, value })).sort((a, b) => b.value - a.value) })).sort((a, b) => b.value - a.value);
}
function donutStyle(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return "conic-gradient(rgba(255,255,255,.08) 0 100%)";
  let cursor = 0;
  const stops = values.map((value, index) => { const start = cursor; cursor += (value / total) * 100; return `${palette[index % palette.length]} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`; });
  return `conic-gradient(${stops.join(", ")})`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string; exchange?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const period: Period = ["7d", "30d", "3m", "1y", "all"].includes(params.period || "") ? params.period as Period : "1y";

  const [{ data: profile }, { count: transactionCount }, { count: activeCsvCount }, { count: connectionCount }, { data: snapshots }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("provider_type", "csv").eq("status", "active"),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
    supabase.from("balance_snapshots").select("id,captured_at,value_eur,quantity,price_eur,source,asset:assets(symbol,name),account:accounts(id,name,connection:exchange_connections(id,label,provider_type,exchange:exchanges(name,code)))").eq("user_id", user.id).order("captured_at", { ascending: true }).limit(10000),
  ]);

  const name = profile?.display_name || user.email?.split("@")[0] || "usuario";
  const initials = name.slice(0, 1).toUpperCase();
  const latest = latestPositions((snapshots || []) as Snapshot[]);
  const currentRows = [...latest.values()].filter((row: Snapshot) => { const q = Number(row.quantity); const symbol = String(one(row.asset)?.symbol || "").trim(); return Number.isFinite(q) && Math.abs(q) > 1e-12 && symbol && symbol !== "-"; });
  const valuedRows = currentRows.filter((row: Snapshot) => Number.isFinite(Number(row.value_eur)));
  const total = valuedRows.reduce((sum, row) => sum + Number(row.value_eur), 0);
  const unvalued = currentRows.length - valuedRows.length;
  const exchanges = buildExchanges(currentRows);
  const selectedKey = params.exchange && exchanges.some((item) => item.key === params.exchange) ? params.exchange : exchanges[0]?.key || "";
  const selected = exchanges.find((item) => item.key === selectedKey) || null;
  const periodHref = (value: Period) => value === "1y" ? "/dashboard" : `/dashboard?period=${value}`;

  return <>
    <style>{`
      .summary-exchange-breakdowns{display:grid;gap:14px}.summary-exchange-card{padding:22px 24px;border:1px solid var(--cr-border);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.018));box-shadow:var(--cr-shadow-sm)}.summary-exchange-card-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.summary-exchange-title{display:flex;align-items:center;gap:12px}.summary-exchange-badge{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:rgba(15,167,160,.13);color:#70D8D1;font-weight:900}.summary-exchange-title strong{display:block;font-size:16px}.summary-exchange-title small{display:block;color:var(--cr-text-muted);font-size:12px;margin-top:2px}.summary-exchange-total{text-align:right}.summary-exchange-total strong{display:block;font-size:18px}.summary-exchange-total small{color:var(--cr-text-muted);font-size:11px}.summary-asset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.summary-asset-row{display:flex;align-items:center;gap:11px;padding:12px 13px;border:1px solid var(--cr-border);border-radius:12px;background:rgba(255,255,255,.022)}.summary-asset-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}.summary-asset-info{min-width:0;flex:1}.summary-asset-info strong{display:block;font-size:13px}.summary-asset-info small{display:block;color:var(--cr-text-muted);font-size:11px;margin-top:2px}.summary-asset-value{text-align:right;font-size:12px;font-weight:800}.summary-donuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}.summary-donut-card{min-width:0}.summary-donut-wrap{display:flex;align-items:center;justify-content:center;gap:24px;padding:12px 4px 6px}.summary-donut{width:214px;height:214px;flex:0 0 214px;border-radius:50%;position:relative;display:grid;place-items:center;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 18px 45px rgba(0,0,0,.25);animation:summaryDonutIn .75s cubic-bezier(.2,.8,.2,1) both;transition:transform .25s ease,filter .25s ease}.summary-donut:hover{transform:scale(1.035) rotate(1deg);filter:brightness(1.08)}.summary-donut:after{content:"";position:absolute;inset:13px;border-radius:50%;background:var(--cr-surface);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}.summary-donut-center{position:relative;z-index:1;text-align:center;padding:20px;max-width:160px}.summary-donut-center strong{display:block;font-size:19px;letter-spacing:-.04em}.summary-donut-center span{display:block;margin-top:4px;color:var(--cr-text-muted);font-size:11px}.summary-donut-legend{display:grid;gap:9px;min-width:180px;max-height:214px;overflow:auto;padding-right:3px}.summary-donut-legend-row{display:flex;align-items:center;gap:9px}.summary-donut-legend-row .summary-asset-dot{width:8px;height:8px}.summary-donut-legend-row div{min-width:0}.summary-donut-legend-row strong{display:block;font-size:12px}.summary-donut-legend-row small{display:block;color:var(--cr-text-muted);font-size:10px;margin-top:1px}.summary-donut-select{display:flex;align-items:center;gap:9px;margin:0 0 12px}.summary-donut-select label{color:var(--cr-text-muted);font-size:12px;font-weight:700}.summary-donut-select select{flex:1;min-height:38px;padding:0 11px;border:1px solid var(--cr-border-strong);border-radius:10px;background:var(--cr-surface-2);color:var(--cr-text);outline:none}.summary-donut-select button{min-height:38px;padding:0 13px;border:0;border-radius:10px;background:var(--cr-primary);color:#fff;font-weight:800;cursor:pointer}.summary-empty{padding:26px;border:1px dashed var(--cr-border-strong);border-radius:14px;text-align:center;color:var(--cr-text-muted)}@keyframes summaryDonutIn{from{opacity:0;transform:scale(.78) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(0)}}@media(max-width:900px){.summary-donuts{grid-template-columns:1fr}.summary-asset-grid{grid-template-columns:1fr}}@media(max-width:620px){.summary-donut-wrap{flex-direction:column}.summary-donut{width:190px;height:190px;flex-basis:190px}.summary-donut-legend{width:100%;max-height:none}.summary-exchange-card{padding:18px}.summary-exchange-card-head{align-items:flex-start}.summary-exchange-total strong{font-size:15px}}
    `}</style>
    <header className="app-topbar dashboard-topbar-modern"><div className="dashboard-search">⌕ <span>Buscar por activo, exchange, transacción...</span></div><div className="topbar-actions"><span className="notification">♧<i /></span><span className="profile-chip">{initials}</span><div className="profile-summary"><strong>{name}</strong></div><span className="profile-chevron">⌄</span></div></header>
    <section className="dashboard-content dashboard-modern-content">
      <div className="dashboard-heading-row"><div><h1>Hola, {name} 👋</h1><p>Aquí tienes un resumen real de tu cartera, conexiones e importaciones.</p></div><div className="period-selector-wrap"><span className="period-selector-label">Periodo</span><div className="chart-periods dashboard-periods">{(["7d","30d","3m","1y","all"] as Period[]).map((value) => <Link href={periodHref(value)} className={period === value ? "selected" : ""} key={value}>{value === "all" ? "Todo" : value.toUpperCase()}</Link>)}</div></div></div>
      <div className="dashboard-main-column" style={{ width: "100%" }}>
        <div className="stat-grid stat-grid-modern"><Stat icon="◎" label="Saldo actual de la cartera" value={eur(total)} note={unvalued ? `${unvalued} posiciones sin valoración EUR` : "Valoración actual disponible"} accent={unvalued > 0}/><Stat icon="▤" label="Movimientos" value={String(transactionCount || 0)} note="Registros normalizados"/><Stat icon="⇧" label="Importaciones" value={String(activeCsvCount || 0)} note="Importaciones CSV activas"/><Stat icon="✓" label="Posiciones" value={String(currentRows.length)} note={`${connectionCount || 0} conexiones activas`}/></div>

        <section className="panel-card exchange-holdings-card"><div className="panel-head"><div><h3>Tus activos por exchange</h3><p>Desglose independiente de cada exchange y de los activos que componen su saldo.</p></div><Link className="panel-link" href="/dashboard/exchanges">Gestionar conexiones</Link></div>{exchanges.length ? <div className="summary-exchange-breakdowns">{exchanges.map((exchange, exchangeIndex) => <article className="summary-exchange-card" key={exchange.key}><div className="summary-exchange-card-head"><div className="summary-exchange-title"><span className="summary-exchange-badge">{exchange.code.slice(0,1).toUpperCase()}</span><div><strong>{exchange.name}</strong><small>{exchange.assets.length} activos · {total ? ((exchange.value / total) * 100).toFixed(1) : "0.0"}% de la cartera</small></div></div><div className="summary-exchange-total"><strong>{eur(exchange.value)}</strong><small>Valor actual</small></div></div><div className="summary-asset-grid">{exchange.assets.map((asset, assetIndex) => <div className="summary-asset-row" key={`${exchange.key}:${asset.symbol}`}><span className="summary-asset-dot" style={{ background: palette[(exchangeIndex + assetIndex) % palette.length] }}/><div className="summary-asset-info"><strong>{asset.symbol}</strong><small>{exchange.value ? ((asset.value / exchange.value) * 100).toFixed(1) : "0.0"}% del exchange</small></div><span className="summary-asset-value">{eur(asset.value)}</span></div>)}</div></article>)}</div> : <div className="summary-empty"><strong>No hay exchanges con saldos valorados.</strong><br/>Conecta un exchange o importa un CSV para ver el desglose.</div>}</section>

        <section className="summary-donuts">
          <article className="panel-card dashboard-donut-card"><div className="panel-head"><div><h3>Cartera por exchange</h3><p>Distribución del valor total actual entre exchanges.</p></div></div>{exchanges.length && total > 0 ? <div className="summary-donut-wrap"><div className="summary-donut" style={{ background: donutStyle(exchanges.map((exchange) => exchange.value)) }} aria-label="Cartera por exchange"><div className="summary-donut-center"><strong>{eur(total)}</strong><span>Valor total</span></div></div><div className="summary-donut-legend">{exchanges.map((exchange, index) => <div className="summary-donut-legend-row" key={exchange.key}><span className="summary-asset-dot" style={{ background: palette[index % palette.length] }}/><div><strong>{exchange.name}</strong><small>{eur(exchange.value)} · {((exchange.value / total) * 100).toFixed(1)}%</small></div></div>)}</div></div> : <div className="summary-empty">No hay datos suficientes para representar la cartera.</div>}</article>

          <article className="panel-card dashboard-donut-card"><div className="panel-head"><div><h3>Activos por exchange</h3><p>{selected ? `Distribución de los activos de ${selected.name}.` : "Selecciona un exchange para consultar sus activos."}</p></div></div>{exchanges.length ? <><form method="get" action="/dashboard" className="summary-donut-select">{period !== "1y" && <input type="hidden" name="period" value={period}/>}<label htmlFor="summary-exchange">Exchange</label><select id="summary-exchange" name="exchange" defaultValue={selectedKey}>{exchanges.map((exchange) => <option value={exchange.key} key={exchange.key}>{exchange.name}</option>)}</select><button type="submit">Ver</button></form>{selected && selected.value > 0 ? <div className="summary-donut-wrap"><div className="summary-donut" style={{ background: donutStyle(selected.assets.map((asset) => asset.value)) }} aria-label={`Activos de ${selected.name}`}><div className="summary-donut-center"><strong>{eur(selected.value)}</strong><span>{selected.name}</span></div></div><div className="summary-donut-legend">{selected.assets.map((asset, index) => <div className="summary-donut-legend-row" key={`${selected.key}:${asset.symbol}`}><span className="summary-asset-dot" style={{ background: palette[index % palette.length] }}/><div><strong>{asset.symbol}</strong><small>{eur(asset.value)} · {((asset.value / selected.value) * 100).toFixed(1)}%</small></div></div>)}</div></div> : <div className="summary-empty">No hay activos valorados en este exchange.</div>}</> : <div className="summary-empty">No hay exchanges disponibles.</div>}</article>
        </section>
      </div>
      <div className="dashboard-footer-trust"><span>◈ <strong>Seguro y confiable</strong><small>Tus datos y claves siempre protegidos</small></span><span>▣ <strong>Cumplimiento fiscal</strong><small>Datos preparados para tus cálculos</small></span><span>⟳ <strong>Conexiones automáticas</strong><small>{connectionCount || 0} conexiones activas</small></span><span>◉ <strong>Soporte en español</strong><small>Estamos aquí para ayudarte</small></span></div>
    </section>
  </>;
}
