import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QualityControl from "./quality-control";
import { calculateFifo, type FifoAsset, type FifoTx } from "@/lib/tax/fifo";

export const metadata: Metadata = { title: "Renta", description: "Preparación fiscal de criptoactivos.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Snapshot = { id: string; captured_at: string; account_id: string; asset_id: string; quantity: number | string | null; value_eur: number | string | null };
type Account = { id: string; connection_id: string | null; name: string };
type Connection = { id: string; exchange_id: string };
type Exchange = { id: string; code: string };

const money = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const date = (v: string | null | undefined) => v ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";
const endOf = (year: number) => `${year + 1}-01-01T00:00:00.000Z`;

async function loadTransactions(db: Awaited<ReturnType<typeof createClient>>, userId: string, end: string) {
  const out: FifoTx[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("transactions")
      .select("id,occurred_at,transaction_type,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,account_id,raw_data")
      .eq("user_id", userId).lt("occurred_at", end).order("occurred_at", { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data || []) as FifoTx[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export default async function RentaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requested = Number(params.year);
  const year = Number.isInteger(requested) && requested >= 2020 && requested <= 2030 ? requested : 2025;
  const end = endOf(year);

  const [profileResult, txs, snapshotsResult, latestResult, assetsResult, accountsResult, connectionsResult, exchangesResult] = await Promise.all([
    db.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    loadTransactions(db, user.id, end),
    db.from("balance_snapshots").select("id,captured_at,account_id,asset_id,quantity,value_eur").eq("user_id", user.id).lt("captured_at", end).order("captured_at", { ascending: true }).limit(20000),
    db.from("balance_snapshots").select("captured_at,source").eq("user_id", user.id).order("captured_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("assets").select("id,symbol,name,asset_type"),
    db.from("accounts").select("id,connection_id,name").eq("user_id", user.id),
    db.from("exchange_connections").select("id,exchange_id").eq("user_id", user.id),
    db.from("exchanges").select("id,code").eq("is_active", true),
  ]);

  const error = profileResult.error || snapshotsResult.error || latestResult.error || assetsResult.error || accountsResult.error || connectionsResult.error || exchangesResult.error;
  if (error) throw new Error(error.message);

  const assets = new Map<string, FifoAsset>((assetsResult.data || []).map((asset: FifoAsset) => [asset.id, asset]));
  const snapshots = (snapshotsResult.data || []) as Snapshot[];
  const accounts = new Map<string, Account>((accountsResult.data || []).map((account: Account) => [account.id, account]));
  const connections = new Map<string, Connection>((connectionsResult.data || []).map((connection: Connection) => [connection.id, connection]));
  const exchanges = new Map<string, Exchange>((exchangesResult.data || []).map((exchange: Exchange) => [exchange.id, exchange]));
  const report = await calculateFifo(txs, year, assets);
  const isPro = profileResult.data?.role === "pro" || profileResult.data?.role === "admin";
  const valuation = latestResult.data?.captured_at || null;

  const yearEnd = snapshots.some((row) => {
    const d = new Date(row.captured_at);
    return d.getUTCFullYear() === year && d.getUTCMonth() === 11 && d.getUTCDate() === 31 && row.value_eur != null;
  });

  const foreignValueEur = snapshots.reduce((sum, row) => {
    if (row.value_eur == null) return sum;
    const account = accounts.get(row.account_id);
    const connection = account?.connection_id ? connections.get(account.connection_id) : null;
    const exchange = connection ? exchanges.get(connection.exchange_id) : null;
    return exchange?.code?.toLowerCase() === "bitpanda" ? sum + Number(row.value_eur) : sum;
  }, 0);

  const issues = [
    report.unknownBasis ? {
      code: "missing-basis",
      title: `${report.unknownBasis} ventas con coste FIFO incompleto`,
      description: "El cálculo ha encontrado ventas en las que falta cantidad o coste de adquisición demostrable. Las ventas con un lote FIFO completo ya no se marcan como incidencia.",
      sales: report.qualitySales,
    } : null,
    report.unsupported ? {
      code: "unsupported",
      title: `${report.unsupported} operaciones requieren clasificación`,
      description: "CoinRenta conserva estos movimientos, pero todavía no puede incorporarlos de forma segura al cálculo fiscal.",
      actionLabel: "Revisar movimientos",
      actionHref: "/dashboard/movimientos",
    } : null,
    report.cryptoFeeEvents ? {
      code: "crypto-fees",
      title: `${report.cryptoFeeEvents} comisiones pagadas en cripto`,
      description: "La comisión queda identificada por separado para evitar incorporarla erróneamente al precio de la contraprestación.",
      actionLabel: "Revisar movimientos",
      actionHref: "/dashboard/movimientos",
    } : null,
    !yearEnd ? {
      code: "info-year-end",
      title: "No hay valoración exacta a 31/12",
      description: "La valoración patrimonial del ejercicio no se considera definitiva sin una valoración de cierre.",
    } : null,
    foreignValueEur > 0 ? {
      code: "info-foreign",
      title: "Se ha detectado custodia extranjera",
      description: "Comprueba la entidad contractual del custodio antes de determinar las obligaciones informativas correspondientes.",
    } : null,
  ].filter(Boolean) as any[];

  const actionable = issues.filter((issue) => !issue.code.startsWith("info"));

  return <main className="dashboard-content renta-page">
    <header className="app-topbar">
      <div><span className="topbar-kicker">CoinRenta</span><h1>Renta</h1><p>Preparación de datos para IRPF, Patrimonio, Modelo 721 y trazabilidad DAC8/CARF.</p></div>
    </header>

    <section className="renta-hero panel-card">
      <div><span className="section-kicker">EJERCICIO FISCAL</span><h2>Informe fiscal {year}</h2><p>Última valoración disponible: <strong>{date(valuation)}</strong></p></div>
      <nav className="renta-year-switcher" aria-label="Ejercicio fiscal">
        {[2025, 2024, 2023, 2022].map((item) => <Link key={item} href={item === 2025 ? "/dashboard/renta" : `/dashboard/renta?year=${item}`} className={year === item ? "selected" : ""}>{item}</Link>)}
      </nav>
    </section>

    <section className="renta-stat-grid">
      <article className="stat-card"><span className="stat-label">Ganancia / pérdida</span>{isPro ? <><strong className={!report.gainKnown ? "renta-number-warning" : ""}>{money(report.gain)}</strong><span className="stat-note">{report.gainKnown ? "FIFO completo con los datos disponibles." : "Resultado provisional por incidencias pendientes."}</span></> : <><strong className="renta-pro-locked-value">Pro</strong><span className="stat-note">Resultado fiscal detallado disponible en Pro.</span></>}</article>
      <article className="stat-card"><span className="stat-label">Valor de transmisión</span><strong>{money(report.proceeds)}</strong><span className="stat-note">Ventas y permutas computables</span></article>
      <article className="stat-card"><span className="stat-label">Coste de adquisición</span><strong>{money(report.costBasis)}</strong><span className="stat-note">Lotes consumidos por FIFO</span></article>
      <article className="stat-card"><span className="stat-label">Incidencias</span><strong>{actionable.length}</strong><span className="stat-note">Requieren revisión</span></article>
    </section>

    <section className="renta-section panel-card">
      <div className="panel-head"><h3>Ganancias y pérdidas patrimoniales</h3><span className="renta-badge">Renta del ahorro</span></div>
      <div className="renta-summary-grid">
        <div><small>Transmisiones / permutas</small><strong>{report.disposals}</strong></div>
        <div><small>Ganancia calculada</small>{isPro ? <strong className={!report.gainKnown ? "renta-number-warning" : ""}>{money(report.gain)}</strong> : <strong className="renta-pro-locked-value">Pro</strong>}</div>
        <div><small>Ingresos identificados</small><strong>{report.incomeKnown ? money(report.incomeEur) : "Parcial"}</strong></div>
        <div><small>Comisiones fiat</small><strong>{money(report.feesEur)}</strong></div>
      </div>
      {!report.gainKnown && <div className="renta-provisional"><strong>Resultado provisional</strong><span>Las operaciones con coste o valoración no demostrables quedan fuera del resultado definitivo hasta que se resuelvan.</span></div>}
    </section>

    <section className="renta-section panel-card">
      <div className="panel-head"><div><span className="section-kicker">FIFO</span><h3>Cómo se está calculando</h3></div><span className="renta-badge">Método obligatorio</span></div>
      <div className="renta-summary-grid">
        <div><small>Regla</small><strong>Primero en entrar, primero en salir</strong></div>
        <div><small>Moneda de cálculo</small><strong>EUR</strong></div>
        <div><small>Divisas extranjeras</small><strong>Conversión histórica ECB</strong></div>
        <div><small>Lotes sin coste</small><strong>{report.unknownBasis}</strong></div>
      </div>
      <div className="renta-explanation"><strong>Importante</strong><span>Un movimiento como «100,39785851 SILVER por -160 USD» sí tiene coste: CoinRenta convierte esos 160 USD a EUR con el tipo histórico del día de adquisición y guarda el coste en el lote FIFO. El signo negativo indica que el USD salió de la cuenta; no convierte el coste en negativo.</span></div>
    </section>

    <section className="renta-section panel-card">
      <div className="panel-head"><div><span className="section-kicker">CONTROL DE CALIDAD</span><h3>Revisión fiscal</h3></div><span className="renta-badge">{actionable.length ? "Requiere revisión" : "Sin incidencias"}</span></div>
      <QualityControl issues={issues} />
    </section>

    <section className="renta-section panel-card">
      <div className="panel-head"><div><span className="section-kicker">MODELO 721</span><h3>Custodia extranjera</h3></div></div>
      <div className="renta-summary-grid">
        <div><small>Valor detectado</small><strong>{money(foreignValueEur)}</strong></div>
        <div><small>Umbral de referencia</small><strong>{money(50000)}</strong></div>
        <div><small>Estado</small><strong>{foreignValueEur >= 50000 ? "Superado" : "Por debajo"}</strong></div>
        <div><small>Fuente</small><strong>Balances importados</strong></div>
      </div>
    </section>

    <div className="renta-footer-note">Las referencias fiscales son orientativas y deben contrastarse con la documentación original y, cuando proceda, con un asesor fiscal.</div>
  </main>;
}
