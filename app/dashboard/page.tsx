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

function toDateEnd(date: string) {
  const value = new Date(`${date}T23:59:59.999Z`);
  return Number.isFinite(value.getTime()) ? value : null;
}

function formatSelectedDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(value) : date;
}

function yearFromDate(date: string) {
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const requestedDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const selectedEnd = toDateEnd(requestedDate) || toDateEnd(today)!;

  const [{ data: profile }, { count: transactionCount }, { count: activeCsvCount }, { count: connectionCount }, { data: snapshots }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("provider_type", "csv").eq("status", "active"),
    supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
    supabase.from("balance_snapshots").select("id,captured_at,value_eur,quantity,price_eur,source,asset:assets(symbol,name),account:accounts(id,name,connection:exchange_connections(id,label,provider_type,exchange:exchanges(name,code)))").eq("user_id", user.id).lte("captured_at", selectedEnd.toISOString()).order("captured_at", { ascending: true }).limit(20000),
  ]);

  const name = profile?.display_name || user.email?.split("@")[0] || "usuario";
  const initials = name.slice(0, 1).toUpperCase();
  const historicalRows = latestPositions(snapshots || []);
  const selectedRows = [...historicalRows.values()].filter((row: Snapshot) => {
    const quantity = Number(row.quantity);
    const symbol = String(one(row.asset)?.symbol || "").trim();
    return Number.isFinite(quantity) && quantity > 1e-12 && symbol && symbol !== "-";
  });
  const valuedRows = selectedRows.filter((row: Snapshot) => Number.isFinite(Number(row.value_eur)) && Number(row.value_eur) >= 0);
  const total = valuedRows.reduce((sum: number, row: Snapshot) => sum + Number(row.value_eur), 0);
  const unvalued = selectedRows.filter((row: Snapshot) => !Number.isFinite(Number(row.value_eur))).length;
  const exchangeRows = buildExchangeRows(selectedRows);
  const selectedYear = yearFromDate(requestedDate);
  const currentYear = new Date().getFullYear();
  const fiscalYears = Array.from({ length: 5 }, (_, index) => currentYear - index);

  return <>
    <header className="app-topbar dashboard-topbar-modern"><div className="dashboard-search">⌕ <span>Buscar por activo, exchange, transacción...</span></div><div className="topbar-actions"><span className="notification">♧<i /></span><span className="profile-chip">{initials}</span><div className="profile-summary"><strong>{name}</strong></div><span className="profile-chevron">⌄</span></div></header>
    <section className="dashboard-content dashboard-modern-content">
      <div className="dashboard-heading-row"><div><h1>Hola, {name} 👋</h1><p>Consulta el valor y las posiciones de tu cartera en una fecha concreta.</p></div></div>

      <section className="panel-card date-selector-card">
        <div className="panel-head"><div><h3>Consulta por fecha</h3><p>Selecciona un día para consultar el patrimonio y los activos que constaban en cartera hasta esa fecha.</p></div><span className="summary-data-note">{formatSelectedDate(requestedDate)}</span></div>
        <form className="dashboard-date-form" method="get" action="/dashboard">
          <label htmlFor="portfolio-date">Fecha</label>
          <input id="portfolio-date" name="date" type="date" value={requestedDate} max={today} />
          <button type="submit">Consultar fecha</button>
          <Link href="/dashboard">Hoy</Link>
        </form>
      </section>

      <div className="dashboard-layout-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}><div className="dashboard-main-column" style={{ width: "100%" }}>
        <div className="stat-grid stat-grid-modern"><Stat icon="◎" label="Saldo de la cartera" value={eur(total)} note={`Valor disponible a ${formatSelectedDate(requestedDate)}`} accent={unvalued > 0}/><Stat icon="✓" label="Activos con saldo" value={String(selectedRows.length)} note={`${selectedRows.length === 1 ? "posición" : "posiciones"} en la fecha seleccionada`}/><Stat icon="⇧" label="Importaciones" value={String(activeCsvCount || 0)} note="Importaciones CSV activas"/><Stat icon="▤" label="Movimientos" value={String(transactionCount || 0)} note="Registros normalizados"/></div>

        <section className="panel-card fiscal-closures-card">
          <div className="panel-head"><div><h3>Cierres fiscales</h3><p>Accede directamente al cierre fiscal de cada ejercicio para consultar y preparar tus datos.</p></div><span className="summary-data-note">Año en curso y anteriores</span></div>
          <div className="fiscal-year-grid">
            {fiscalYears.map((year) => <Link href={`/dashboard/renta?year=${year}`} className={year === selectedYear ? "fiscal-year-card selected" : "fiscal-year-card"} key={year}><span>{year === currentYear ? "Año en curso" : "Ejercicio fiscal"}</span><strong>Cierre {year}</strong><small>Ver datos fiscales →</small></Link>)}
          </div>
        </section>

        <section className="panel-card exchange-holdings-card">
          <div className="panel-head"><div><h3>Activos por exchange</h3><p>Desglose de los activos que tenían saldo positivo a {formatSelectedDate(requestedDate)}.</p></div><Link className="panel-link" href="/dashboard/exchanges">Gestionar conexiones</Link></div>
          {exchangeRows.length ? <div className="exchange-table">
            <div className="exchange-table-head"><span>Exchange</span><span>Activo</span><span>Saldo</span><span>Valor EUR</span><span>% cartera</span></div>
            {exchangeRows.map((ex: any) => ex.assets.map((asset: any, index: number) => <div className="exchange-table-row" key={`${ex.key}:${asset.symbol}`}>
              {index === 0 ? <div className="exchange-name"><span className="exchange-logo">{ex.code.slice(0, 1).toUpperCase()}</span><div><strong>{ex.name}</strong><small>{ex.assets.length} activos con saldo</small><span className="dashboard-summary-exchange-source">{ex.source}</span></div></div> : <div className="exchange-name exchange-name-continuation"><span></span><div><strong>{ex.name}</strong></div></div>}
              <div><strong>{asset.symbol}</strong><small className="dashboard-summary-exchange-asset-name">{asset.name || asset.symbol}</small></div>
              <span className="exchange-balance">{formatQuantity(asset.quantity)}</span>
              <strong>{Number.isFinite(asset.value) ? eur(asset.value) : "Sin valoración"}</strong>
              <span>{total > 0 && Number.isFinite(asset.value) ? `${((asset.value / total) * 100).toFixed(1)}%` : "—"}</span>
            </div>))}
          </div> : <div className="dashboard-summary-empty"><strong>No había activos con saldo en esa fecha</strong><span>Prueba otra fecha anterior o posterior para consultar el patrimonio histórico disponible.</span></div>}
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
    row.assets.push({ symbol, name: one(item.asset)?.name || symbol, quantity, value: Number.isFinite(value) && value >= 0 ? value : null });
    rows.set(key, row);
  }
  for (const row of rows.values()) row.assets.sort((a: any, b: any) => b.quantity - a.quantity || a.symbol.localeCompare(b.symbol));
  return [...rows.values()].sort((a, b) => {
    const av = a.assets.reduce((sum: number, asset: any) => sum + (Number.isFinite(asset.value) ? asset.value : 0), 0);
    const bv = b.assets.reduce((sum: number, asset: any) => sum + (Number.isFinite(asset.value) ? asset.value : 0), 0);
    return bv - av || a.name.localeCompare(b.name);
  });
}
