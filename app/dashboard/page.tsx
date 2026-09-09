import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumen", description: "Resumen patrimonial y fiscal de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "3m" | "1y" | "all";
type Snapshot = any;
type Transaction = any;

function Stat({ icon, label, value, note, accent = false }: { icon: string; label: string; value: string; note: string; accent?: boolean }) {
  return <article className={`stat-card ${accent ? "stat-card-accent" : ""}`}><span className="stat-icon">{icon}</span><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small className="stat-note">{note}</small></div></article>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const period: Period = ["7d", "30d", "3m", "1y", "all"].includes(params.period || "") ? params.period as Period : "1y";
  const now = Date.now();
  const periodMs: Record<Exclude<Period, "all">, number> = { "7d": 7 * 86400000, "30d": 30 * 86400000, "3m": 90 * 86400000, "1y": 365 * 86400000 };
  const cutoff = period === "all" ? 0 : now - periodMs[period];

  const [{ data: profile }, { count: transactionCount }, { count: activeCsvCount }, { count: connectionCount }, { data: snapshots }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("provider_type", "csv").eq("status", "active"),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
    supabase.from("balance_snapshots").select("id,captured_at,value_eur,quantity,price_eur,source,asset:assets(symbol,name),account:accounts(id,name,connection:exchange_connections(id,label,provider_type,exchange:exchanges(name,code)))").eq("user_id", user.id).order("captured_at", { ascending: true }).limit(10000),
    supabase.from("transactions").select("id,occurred_at,transaction_type,base_amount,quote_amount,price_currency,source,account:accounts(name,connection:exchange_connections(label,provider_type)),asset:assets(symbol,name)").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(8),
  ]);

  const name = profile?.display_name || user.email?.split("@")[0] || "usuario";
  const initials = name.slice(0, 1).toUpperCase();
  const history = snapshots || [];
  const latest = latestPositions(history);
  const currentRows = [...latest.values()].filter((row: Snapshot) => {
    const quantity = Number(row.quantity);
    const symbol = String(one(row.asset)?.symbol || "").trim();
    return Number.isFinite(quantity) && Math.abs(quantity) > 1e-12 && symbol && symbol !== "-";
  });
  const valuedRows = currentRows.filter((row: Snapshot) => Number.isFinite(Number(row.value_eur)));
  const total = valuedRows.reduce((sum: number, row: Snapshot) => sum + Number(row.value_eur), 0);
  const unvalued = currentRows.length - valuedRows.length;
  const filteredSnapshots = history.filter((row: Snapshot) => {
    const timestamp = new Date(row.captured_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
  const chart = makeChart(filteredSnapshots);
  const exchangeRows = buildExchangeRows(currentRows, filteredSnapshots);
  const periodHref = (value: Period) => value === "1y" ? "/dashboard" : `/dashboard?period=${value}`;

  return <>
    <header className="app-topbar dashboard-topbar-modern"><div className="dashboard-search">⌕ <span>Buscar por activo, exchange, transacción...</span></div><div className="topbar-actions"><span className="notification">♧<i /></span><span className="profile-chip">{initials}</span><div className="profile-summary"><strong>{name}</strong></div><span className="profile-chevron">⌄</span></div></header>
    <section className="dashboard-content dashboard-modern-content">
      <div className="dashboard-heading-row"><div><h1>Hola, {name} 👋</h1><p>Aquí tienes un resumen real de tus conexiones, movimientos e importaciones.</p></div><div className="period-selector-wrap"><span className="period-selector-label">Periodo</span><div className="chart-periods dashboard-periods">{(["7d", "30d", "3m", "1y", "all"] as Period[]).map((value) => <Link href={periodHref(value)} className={period === value ? "selected" : ""} key={value}>{value === "all" ? "Todo" : value.toUpperCase()}</Link>)}</div></div></div>
      <div className="dashboard-layout-grid"><div className="dashboard-main-column">
        <div className="stat-grid stat-grid-modern"><Stat icon="◎" label="Saldo actual de la cartera" value={eur(total)} note={unvalued ? `${unvalued} posiciones sin valoración EUR` : "Valoración actual disponible"} accent={unvalued > 0}/><Stat icon="▤" label="Movimientos" value={String(transactionCount || 0)} note="Registros normalizados"/><Stat icon="⇧" label="Importaciones" value={String(activeCsvCount || 0)} note="Importaciones CSV activas"/><Stat icon="✓" label="Posiciones" value={String(currentRows.length)} note={`${connectionCount || 0} conexiones activas`}/></div>
        <section className="panel-card chart-card"><div className="panel-head"><div><h3>Evolución de tus activos</h3><p>{chart.caption}</p></div><span className="summary-data-note">Valoración histórica real</span></div>{chart.hasData ? <><div className="asset-chart"><div className="chart-y-labels">{chart.yLabels.map((label: string, index: number) => <span key={`y-${index}`}>{label}</span>)}</div><svg viewBox="0 0 760 250" preserveAspectRatio="none" aria-label="Evolución de activos"><defs><linearGradient id="crFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0FA7A0" stopOpacity=".35"/><stop offset="100%" stopColor="#0FA7A0" stopOpacity="0"/></linearGradient></defs><path d={chart.area} fill="url(#crFill)"/><path d={chart.line} fill="none" stroke="#20C9BF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="chart-x-labels">{chart.labels.map((label: string, index: number) => <span key={`x-${index}`}>{label}</span>)}</div></div><div className="chart-footer"><div><span>Saldo actual</span><strong>{eur(total)}</strong></div><div><span>Máximo del periodo</span><strong>{eur(chart.max)}</strong></div><div><span>Mínimo del periodo</span><strong>{eur(chart.min)}</strong></div></div></> : <div className="dashboard-summary-empty"><strong>No hay valoraciones en este periodo</strong><span>Elige otro periodo o realiza una nueva sincronización/importación para generar historial.</span></div>}</section>
        <section className="panel-card exchange-holdings-card"><div className="panel-head"><div><h3>Tus activos por exchange</h3><p>Posiciones actuales agrupadas por conexión, con el detalle de los activos.</p></div><Link className="panel-link" href="/dashboard/exchanges">Gestionar conexiones</Link></div>{exchangeRows.length ? <div className="exchange-table"><div className="exchange-table-head"><span>Exchange</span><span>Valor total</span><span>% del total</span><span>Activos</span><span>Tendencia</span></div>{exchangeRows.map((ex: any) => <div className="exchange-table-row" key={ex.key}><div className="exchange-name"><span className="exchange-logo">{ex.code.slice(0, 1).toUpperCase()}</span><div><strong>{ex.name}</strong><small>{ex.assetsCount} posiciones</small><span className="dashboard-summary-exchange-source">{ex.source}</span><span className="dashboard-summary-exchange-assets">{ex.assetsList.join(" · ") || "Sin activos valorados"}</span></div></div><strong>{eur(ex.value)}</strong><span>{total ? ((ex.value / total) * 100).toFixed(1) : "0.0"}%</span><span>{ex.assetsCount}</span><span className={ex.change === null ? "mini-trend exchange-trend-flat" : ex.change > 0 ? "mini-trend exchange-trend-positive" : ex.change < 0 ? "mini-trend exchange-trend-negative" : "mini-trend exchange-trend-flat"}>{ex.change === null ? "—" : ex.change > 0 ? `+${ex.change.toFixed(1)}%` : `${ex.change.toFixed(1)}%`}</span></div>)}</div> : <div className="dashboard-summary-empty"><strong>Aún no hay saldos para mostrar</strong><span>Conecta un exchange o importa un CSV para poblar este panel automáticamente.</span></div>}</section>
      </div><aside className="dashboard-right-column"><section className="panel-card quick-card"><div className="panel-head"><h3>Accesos rápidos</h3></div><div className="quick-grid"><Link href="/dashboard/importar">⇧<span>Importar CSV</span></Link><Link href="/dashboard/exchanges">↻<span>Conectar Exchange</span></Link><Link href="/dashboard/movimientos">≋<span>Movimientos</span></Link><Link href="/dashboard/ayuda">?<span>Ayuda</span></Link></div></section><section className="panel-card recent-card"><div className="panel-head"><h3>Movimientos recientes</h3><Link className="panel-link" href="/dashboard/movimientos">Ver todos</Link></div>{transactions?.length ? <div className="recent-list">{transactions.map((tx: Transaction) => { const account = one(tx.account); const asset = one(tx.asset); return <div className="recent-row" key={tx.id}><span className="recent-icon">◆</span><div><strong>{labelType(tx.transaction_type)}</strong><small>{account?.name || "Cuenta"} · {asset?.symbol || "Activo"} · {sourceLabel(tx.source)}</small></div><div className="recent-value"><strong>{Number.isFinite(Number(tx.quote_amount)) ? `${Number(tx.quote_amount).toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${tx.price_currency || ""}` : "—"}</strong><small>{formatDate(tx.occurred_at)}</small></div></div>; })}</div> : <div className="empty-state"><strong>Sin movimientos todavía</strong><p>Cuando conectes un exchange o importes un CSV aparecerán aquí.</p></div>}</section></aside></div>
      <div className="dashboard-footer-trust"><span>◈ <strong>Seguro y confiable</strong><small>Tus datos y claves siempre protegidos</small></span><span>▣ <strong>Cumplimiento fiscal</strong><small>Datos preparados para tus cálculos</small></span><span>⟳ <strong>Conexiones automáticas</strong><small>{connectionCount || 0} conexiones activas</small></span><span>◉ <strong>Soporte en español</strong><small>Estamos aquí para ayudarte</small></span></div>
    </section>
  </>;
}

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function eur(value: number) { return Number.isFinite(value) ? value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }) : "—"; }
function formatDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date) : "—"; }
function labelType(type: string) { return type.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()); }
function sourceLabel(source: string) { return source === "api" ? "API" : source === "csv" ? "CSV" : source; }

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

function buildExchangeRows(current: Snapshot[], history: Snapshot[]) {
  const rows = new Map<string, any>();
  for (const item of current) {
    const account = one(item.account);
    const connection = one(account?.connection);
    const exchange = one(connection?.exchange);
    const key = connection?.id || `${exchange?.code || "other"}:${account?.name || "account"}`;
    const numericValue = Number(item.value_eur);
    const currentRow = rows.get(key) || { key, name: exchange?.name || connection?.label || "Sin exchange", code: exchange?.code || "—", value: 0, assetsCount: 0, assetsList: [], source: connection?.provider_type === "csv" || item.source === "calculated" ? "CSV" : "API", change: null as number | null };
    if (Number.isFinite(numericValue)) currentRow.value += numericValue;
    currentRow.assetsCount += 1;
    const symbol = String(one(item.asset)?.symbol || "").trim().toUpperCase();
    if (symbol && symbol !== "-" && !currentRow.assetsList.includes(symbol)) currentRow.assetsList.push(symbol);
    rows.set(key, currentRow);
  }

  const daily = new Map<string, Map<string, Map<string, number>>>();
  for (const item of history) {
    const value = Number(item.value_eur);
    const timestamp = new Date(item.captured_at).getTime();
    const symbol = String(one(item.asset)?.symbol || "").trim().toUpperCase();
    const account = one(item.account);
    const connection = one(account?.connection);
    const exchange = one(connection?.exchange);
    if (!Number.isFinite(value) || !Number.isFinite(timestamp) || !symbol || symbol === "-") continue;
    const exchangeKey = connection?.id || `${exchange?.code || "other"}:${account?.name || "account"}`;
    const day = new Date(timestamp).toISOString().slice(0, 10);
    const byExchange = daily.get(day) || new Map<string, Map<string, number>>();
    const positions = byExchange.get(exchangeKey) || new Map<string, number>();
    positions.set(positionKey(item), value);
    byExchange.set(exchangeKey, positions);
    daily.set(day, byExchange);
  }

  for (const [key, row] of rows) {
    const series = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, exchanges]) => {
      const positions = exchanges.get(key);
      return positions ? [...positions.values()].reduce((sum, value) => sum + value, 0) : null;
    }).filter((value): value is number => value !== null && Number.isFinite(value));
    if (series.length >= 2 && Math.abs(series[0]) > 1e-12) row.change = ((row.value - series[0]) / Math.abs(series[0])) * 100;
    row.assetsList.sort((a: string, b: string) => a.localeCompare(b));
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
}

function makeChart(rows: Snapshot[]) {
  const byDayAndPosition = new Map<string, { timestamp: number; value: number }>();
  for (const row of rows) {
    const value = Number(row.value_eur);
    const timestamp = new Date(row.captured_at).getTime();
    const symbol = String(one(row.asset)?.symbol || "").trim().toUpperCase();
    if (!Number.isFinite(value) || !Number.isFinite(timestamp) || !symbol || symbol === "-") continue;
    const day = new Date(timestamp).toISOString().slice(0, 10);
    const key = `${day}:${positionKey(row)}`;
    const existing = byDayAndPosition.get(key);
    if (!existing || timestamp > existing.timestamp) byDayAndPosition.set(key, { timestamp, value });
  }

  const days = new Map<string, number>();
  for (const [key, item] of byDayAndPosition) {
    const day = key.slice(0, 10);
    days.set(day, (days.get(day) || 0) + item.value);
  }
  const entries = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return { hasData: false, line: "", area: "", max: 0, min: 0, labels: ["Sin datos"], yLabels: [eur(0), eur(0), eur(0), eur(0), eur(0)], caption: "Todavía no hay valoraciones disponibles" };

  const values = entries.map(([, value]) => value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || Math.max(Math.abs(max), 1);
  const sampledEntries = entries.length > 60 ? entries.filter((_, index) => index % Math.ceil(entries.length / 60) === 0).slice(0, 60) : entries;
  const sampled = sampledEntries.map(([, value]) => value);
  const points = sampled.map((value, index) => {
    const x = sampled.length === 1 ? 380 : (index / (sampled.length - 1)) * 760;
    const y = 220 - ((value - min) / range) * 195;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const labelEntries = entries.length > 12 ? entries.filter((_, index) => index % Math.ceil(entries.length / 12) === 0).slice(0, 12) : entries;
  const labels = labelEntries.map(([day]) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(`${day}T12:00:00Z`)));
  const yLabels = [max, min + range * 0.75, min + range * 0.5, min + range * 0.25, min].map(eur);
  const line = `M ${points.join(" L ")}`;
  const caption = entries.length === 1 ? "1 valoración disponible; la evolución aparecerá al acumular nuevas valoraciones." : `${entries.length} días con valoración disponible`;
  return { hasData: true, line, area: `M 0 220 L ${points.join(" L ")} L 760 220 Z`, max, min, labels, yLabels, caption };
}
