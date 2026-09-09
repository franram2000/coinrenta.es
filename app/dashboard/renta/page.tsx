import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Renta",
  description: "Preparación fiscal de criptoactivos para Renta, Patrimonio y obligaciones informativas.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Tx = {
  id: string;
  occurred_at: string;
  transaction_type: string;
  base_asset_id: string | null;
  base_amount: number | string | null;
  quote_asset_id: string | null;
  quote_amount: number | string | null;
  fee_asset_id: string | null;
  fee_amount: number | string | null;
  price: number | string | null;
  price_currency: string | null;
  source: string | null;
  account_id: string;
};

type Snapshot = {
  id: string;
  captured_at: string;
  account_id: string;
  asset_id: string;
  quantity: number | string | null;
  value_eur: number | string | null;
  price_eur: number | string | null;
  source: string | null;
};

type Asset = { id: string; symbol: string; name: string; asset_type: string | null };
type Account = { id: string; connection_id: string | null; name: string };
type Connection = { id: string; exchange_id: string; label: string | null; provider_type: string | null };
type Exchange = { id: string; code: string; name: string; website: string | null };

type Lot = { qty: number; cost: number | null };

type Report = {
  acquisitions: number;
  disposals: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  gainKnown: boolean;
  unknownBasis: number;
  incomeEvents: number;
  incomeEur: number;
  incomeKnown: number;
  feesEur: number;
  cryptoFeeEvents: number;
  transfers: number;
  unsupported: number;
  positions: { symbol: string; name: string; quantity: number; valueEur: number | null; accountCount: number; foreign: boolean }[];
  foreignValueEur: number;
  foreignValuationKnown: boolean;
};

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK"]);
const INCOME_TYPES = new Set(["reward", "interest", "dividend", "airdrop", "cashback"]);
const TRANSFER_TYPES = new Set(["deposit", "withdrawal", "transfer_in", "transfer_out"]);
const SALE_TYPES = new Set(["sell", "swap", "trade", "convert"]);
const PURCHASE_TYPES = new Set(["buy"]);

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}
function qty(value: number) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 8 });
}
function date(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}
function labelType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function isoStart(year: number) { return `${year}-01-01T00:00:00.000Z`; }
function isoEnd(year: number) { return `${year + 1}-01-01T00:00:00.000Z`; }

async function fetchTransactions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, end: string) {
  const out: Tx[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,occurred_at,transaction_type,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,source,account_id")
      .eq("user_id", userId)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []) as Tx[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function buildReport(transactions: Tx[], year: number, assets: Map<string, Asset>, accounts: Map<string, Account>, connections: Map<string, Connection>, exchanges: Map<string, Exchange>, snapshots: Snapshot[]): Report {
  const lots = new Map<string, Lot[]>();
  const acquisitionLots = new Map<string, number>();
  const positions = new Map<string, { symbol: string; name: string; quantity: number; accounts: Set<string> }>();
  let acquisitions = 0, disposals = 0, proceeds = 0, costBasis = 0, gain = 0;
  let gainKnown = true, unknownBasis = 0, incomeEvents = 0, incomeEur = 0, incomeKnown = 0;
  let feesEur = 0, cryptoFeeEvents = 0, transfers = 0, unsupported = 0;

  const getAsset = (id: string | null) => id ? assets.get(id) || null : null;
  const addLot = (assetId: string, quantity: number, cost: number | null) => {
    if (!quantity || quantity <= 0) return;
    const list = lots.get(assetId) || [];
    list.push({ qty: quantity, cost });
    lots.set(assetId, list);
  };
  const consumeLots = (assetId: string, quantity: number) => {
    let remaining = quantity;
    let allocated = 0;
    let known = true;
    const list = lots.get(assetId) || [];
    while (remaining > 1e-12 && list.length) {
      const lot = list[0];
      const take = Math.min(remaining, lot.qty);
      if (lot.cost === null) known = false;
      else allocated += lot.cost * (take / lot.qty);
      lot.qty -= take;
      remaining -= take;
      if (lot.qty <= 1e-12) list.shift();
    }
    lots.set(assetId, list);
    if (remaining > 1e-12) known = false;
    return { allocated, known, remaining };
  };

  const ordered = [...transactions].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  for (const tx of ordered) {
    const type = (tx.transaction_type || "").toLowerCase();
    const base = getAsset(tx.base_asset_id);
    const quote = getAsset(tx.quote_asset_id);
    const feeAsset = getAsset(tx.fee_asset_id);
    const baseQty = Math.abs(Number(tx.base_amount || 0));
    const quoteValue = Math.abs(Number(tx.quote_amount || 0));
    const feeQty = Math.abs(Number(tx.fee_amount || 0));
    const inSelectedYear = new Date(tx.occurred_at).getUTCFullYear() === year;
    const quoteIsEur = !!quote && quote.asset_type === "fiat" && (quote.symbol || "").toUpperCase() === "EUR" || (tx.price_currency || "").toUpperCase() === "EUR";
    const quoteIsFiat = !!quote && (quote.asset_type === "fiat" || FIAT.has((quote.symbol || "").toUpperCase()));

    if (feeQty > 0) {
      if (feeAsset && feeAsset.asset_type !== "fiat" && !FIAT.has(feeAsset.symbol.toUpperCase())) {
        cryptoFeeEvents += inSelectedYear ? 1 : 0;
        if (inSelectedYear) gainKnown = false;
      } else if (inSelectedYear) {
        feesEur += feeQty;
      }
    }

    if (PURCHASE_TYPES.has(type) && base && baseQty > 0) {
      acquisitions += inSelectedYear ? 1 : 0;
      const cost = quoteValue > 0 && quoteIsFiat && ((quote?.symbol || "").toUpperCase() === "EUR" || (tx.price_currency || "").toUpperCase() === "EUR") ? quoteValue + (feeAsset && (feeAsset.asset_type === "fiat" || FIAT.has(feeAsset.symbol.toUpperCase())) ? feeQty : 0) : null;
      addLot(base.id, baseQty, cost);
      acquisitionLots.set(base.id, (acquisitionLots.get(base.id) || 0) + baseQty);
      continue;
    }

    if (INCOME_TYPES.has(type) && base && baseQty > 0) {
      incomeEvents += inSelectedYear ? 1 : 0;
      const value = quoteValue > 0 && quoteIsEur ? quoteValue : (Number(tx.price || 0) > 0 && (tx.price_currency || "").toUpperCase() === "EUR" ? baseQty * Number(tx.price) : null);
      if (value !== null && Number.isFinite(value)) {
        if (inSelectedYear) { incomeEur += value; incomeKnown += 1; }
        addLot(base.id, baseQty, value);
      } else {
        addLot(base.id, baseQty, null);
        if (inSelectedYear) gainKnown = false;
      }
      continue;
    }

    if (TRANSFER_TYPES.has(type)) {
      transfers += inSelectedYear ? 1 : 0;
      if ((type === "transfer_in" || type === "deposit") && base && baseQty > 0) addLot(base.id, baseQty, null);
      continue;
    }

    if (SALE_TYPES.has(type) && base && baseQty > 0) {
      if (!quoteIsFiat && !quoteIsEur) {
        unsupported += inSelectedYear ? 1 : 0;
        const consumed = consumeLots(base.id, baseQty);
        if (consumed.remaining > 1e-12 || !quote) gainKnown = false;
        if (quote) addLot(quote.id, quoteValue, null);
        continue;
      }
      const consumed = consumeLots(base.id, baseQty);
      if (inSelectedYear) {
        disposals += 1;
        if (quoteValue > 0 && quoteIsEur) {
          proceeds += quoteValue - ((feeAsset && (feeAsset.asset_type === "fiat" || FIAT.has(feeAsset.symbol.toUpperCase()))) ? feeQty : 0);
          if (consumed.known) {
            costBasis += consumed.allocated;
            gain += (quoteValue - ((feeAsset && (feeAsset.asset_type === "fiat" || FIAT.has(feeAsset.symbol.toUpperCase()))) ? feeQty : 0)) - consumed.allocated;
          } else {
            gainKnown = false;
            unknownBasis += 1;
          }
        } else {
          gainKnown = false;
          unknownBasis += 1;
        }
      }
      continue;
    }

    if (base && baseQty > 0 && ["unknown", ""].includes(type) === false) {
      unsupported += inSelectedYear ? 1 : 0;
      addLot(base.id, baseQty, null);
      if (inSelectedYear) gainKnown = false;
    }
  }

  for (const [assetId, lotList] of lots.entries()) {
    const asset = assets.get(assetId);
    if (!asset) continue;
    const quantity = lotList.reduce((sum, lot) => sum + Math.max(0, lot.qty), 0);
    if (quantity <= 1e-12) continue;
    const accountSet = new Set<string>();
    for (const snapshot of snapshots) if (snapshot.asset_id === assetId && Math.abs(Number(snapshot.quantity || 0)) > 1e-12) accountSet.add(snapshot.account_id);
    positions.set(assetId, { symbol: asset.symbol, name: asset.name, quantity, accounts: accountSet });
  }

  const yearSnapshots = snapshots.filter((s) => new Date(s.captured_at).getUTCFullYear() === year && new Date(s.captured_at).getUTCMonth() === 11 && new Date(s.captured_at).getUTCDate() === 31);
  const latestByAccountAsset = new Map<string, Snapshot>();
  for (const snapshot of yearSnapshots) {
    const key = `${snapshot.account_id}:${snapshot.asset_id}`;
    const current = latestByAccountAsset.get(key);
    if (!current || new Date(snapshot.captured_at).getTime() > new Date(current.captured_at).getTime()) latestByAccountAsset.set(key, snapshot);
  }
  const valueByAsset = new Map<string, number>();
  const foreignByAsset = new Map<string, boolean>();
  let foreignValueEur = 0;
  let foreignValuationKnown = true;
  for (const snapshot of latestByAccountAsset.values()) {
    const value = snapshot.value_eur === null || snapshot.value_eur === undefined ? null : Number(snapshot.value_eur);
    if (value === null || !Number.isFinite(value)) continue;
    valueByAsset.set(snapshot.asset_id, (valueByAsset.get(snapshot.asset_id) || 0) + value);
    const account = accounts.get(snapshot.account_id);
    const connection = account?.connection_id ? connections.get(account.connection_id) : null;
    const exchange = connection ? exchanges.get(connection.exchange_id) : null;
    const foreign = exchange?.code?.toLowerCase() === "bitpanda";
    if (foreign) {
      foreignValueEur += value;
      foreignByAsset.set(snapshot.asset_id, true);
    }
  }
  const positionsArray = [...positions.values()].map((position) => ({
    symbol: position.symbol,
    name: position.name,
    quantity: position.quantity,
    valueEur: valueByAsset.has([...assets.entries()].find(([, a]) => a.symbol === position.symbol)?.[0] || "") ? valueByAsset.get([...assets.entries()].find(([, a]) => a.symbol === position.symbol)?.[0] || "") || null : null,
    accountCount: position.accounts.size,
    foreign: [...assets.entries()].find(([, a]) => a.symbol === position.symbol) ? foreignByAsset.get([...assets.entries()].find(([, a]) => a.symbol === position.symbol)?.[0] || "") || false : false,
  })).sort((a, b) => (b.valueEur || 0) - (a.valueEur || 0));

  return { acquisitions, disposals, proceeds, costBasis, gain, gainKnown, unknownBasis, incomeEvents, incomeEur, incomeKnown, feesEur, cryptoFeeEvents, transfers, unsupported, positions: positionsArray, foreignValueEur, foreignValuationKnown };
}

export default async function RentaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const requestedYear = Number(params.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2030 ? requestedYear : 2025;
  const start = isoStart(year);
  const end = isoEnd(year);

  const [transactions, snapshotsResult, assetsResult, accountsResult, connectionsResult, exchangesResult, taxYearsResult] = await Promise.all([
    fetchTransactions(supabase, user.id, end),
    supabase.from("balance_snapshots").select("id,captured_at,account_id,asset_id,quantity,value_eur,price_eur,source").eq("user_id", user.id).lt("captured_at", end).order("captured_at", { ascending: true }).limit(20000),
    supabase.from("assets").select("id,symbol,name,asset_type"),
    supabase.from("accounts").select("id,connection_id,name").eq("user_id", user.id),
    supabase.from("exchange_connections").select("id,exchange_id,label,provider_type").eq("user_id", user.id),
    supabase.from("exchanges").select("id,code,name,website").eq("is_active", true),
    supabase.from("tax_years").select("id,year,status,updated_at").eq("user_id", user.id).order("year", { ascending: false }),
  ]);

  if (snapshotsResult.error || assetsResult.error || accountsResult.error || connectionsResult.error || exchangesResult.error) {
    throw new Error((snapshotsResult.error || assetsResult.error || accountsResult.error || connectionsResult.error || exchangesResult.error)?.message || "No se pudo cargar la información fiscal.");
  }

  const assets = new Map<string, Asset>((assetsResult.data || []).map((row: Asset) => [row.id, row]));
  const accounts = new Map<string, Account>((accountsResult.data || []).map((row: Account) => [row.id, row]));
  const connections = new Map<string, Connection>((connectionsResult.data || []).map((row: Connection) => [row.id, row]));
  const exchanges = new Map<string, Exchange>((exchangesResult.data || []).map((row: Exchange) => [row.id, row]));
  const snapshots = (snapshotsResult.data || []) as Snapshot[];
  const selectedTransactions = transactions.filter((tx) => new Date(tx.occurred_at) >= new Date(start) && new Date(tx.occurred_at) < new Date(end));
  const report = buildReport(transactions, year, assets, accounts, connections, exchanges, snapshots);
  const foreignCustodians = [...connections.values()]
    .map((connection) => ({ connection, exchange: exchanges.get(connection.exchange_id) }))
    .filter(({ exchange }) => exchange?.code?.toLowerCase() === "bitpanda");
  const hasExactYearEndValuation = snapshots.some((snapshot) => {
    const dateValue = new Date(snapshot.captured_at);
    return dateValue.getUTCFullYear() === year && dateValue.getUTCMonth() === 11 && dateValue.getUTCDate() === 31 && snapshot.value_eur !== null;
  });
  const dataIssues = [
    report.unknownBasis > 0 ? `${report.unknownBasis} ventas usan lotes cuyo coste de adquisición no puede demostrarse con los datos importados.` : null,
    report.unsupported > 0 ? `${report.unsupported} operaciones requieren clasificación específica antes de cerrar el cálculo.` : null,
    report.cryptoFeeEvents > 0 ? `${report.cryptoFeeEvents} comisiones pagadas en criptoactivo requieren tratamiento separado como posible disposición.` : null,
    !hasExactYearEndValuation ? "No hay valoración de snapshots en 31/12; el valor de Patrimonio/721 no se marca como definitivo." : null,
    foreignCustodians.length > 0 ? "La custodia Bitpanda se identifica como extranjera por la entidad Bitpanda GmbH (Austria), pero el titular debe verificar la entidad contractual de su producto." : null,
  ].filter(Boolean) as string[];

  const yearLinks = [2025, 2024, 2023, 2022].map((value) => ({ value, href: value === 2025 ? "/dashboard/renta" : `/dashboard/renta?year=${value}` }));
  const taxYearStored = (taxYearsResult.data || []).find((item: any) => item.year === year);

  return <>
    <header className="app-topbar">
      <div><span className="topbar-kicker">CoinRenta</span><h1>Renta</h1><p>Preparación de los datos de criptoactivos para IRPF, Patrimonio, Modelo 721 y trazabilidad DAC8/CARF.</p></div>
    </header>
    <section className="dashboard-content renta-page">
      <section className="renta-hero panel-card">
        <div><span className="section-kicker">EJERCICIO FISCAL</span><h2>Informe fiscal {year}</h2><p>El informe separa los importes que pueden trasladarse al IRPF de la información patrimonial e informativa. No calcula una cuota total de IRPF porque esa cuota depende del resto de rentas y de la situación personal del contribuyente.</p></div>
        <div className="renta-year-switcher" aria-label="Ejercicio fiscal">{yearLinks.map((item) => <Link key={item.value} href={item.href} className={item.value === year ? "selected" : ""}>{item.value}</Link>)}</div>
      </section>

      <section className="renta-stat-grid">
        <article className="stat-card"><span className="stat-label">Ganancia / pérdida cripto</span><strong>{report.gainKnown ? money(report.gain) : "Revisión"}</strong><span className="stat-note">Transmisiones y permutas calculadas por operación</span></article>
        <article className="stat-card"><span className="stat-label">Valor de transmisión</span><strong>{money(report.proceeds)}</strong><span className="stat-note">Operaciones con contraprestación EUR conocida</span></article>
        <article className="stat-card"><span className="stat-label">Coste de adquisición</span><strong>{money(report.costBasis)}</strong><span className="stat-note">Lotes aplicados con criterio FIFO</span></article>
        <article className={`stat-card ${report.unknownBasis || report.unsupported ? "stat-card-accent" : ""}`}><span className="stat-label">Incidencias</span><strong>{dataIssues.length}</strong><span className="stat-note">Bloqueos que deben resolverse antes de declarar</span></article>
      </section>

      <section className="renta-section panel-card">
        <div className="panel-head"><div><span className="section-kicker">MODELO 100 · IRPF</span><h3>Ganancias y pérdidas patrimoniales</h3></div><span className="renta-badge">Renta del ahorro</span></div>
        <div className="renta-summary-grid"><div><small>Operaciones de transmisión/permutación</small><strong>{report.disposals}</strong></div><div><small>Ganancia/pérdida calculada</small><strong>{report.gainKnown ? money(report.gain) : "No definitiva"}</strong></div><div><small>Ingresos de reward / interest / etc.</small><strong>{report.incomeKnown ? money(report.incomeEur) : "Parcial"}</strong></div><div><small>Comisiones fiat identificadas</small><strong>{money(report.feesEur)}</strong></div></div>
        <div className="renta-explanation"><strong>Qué se traslada al IRPF</strong><span>La AEAT trata las ventas por dinero y las permutas entre monedas virtuales como ganancias o pérdidas patrimoniales. En transmisiones parciales de monedas homogéneas, el criterio aplicado es FIFO. Las comisiones directamente relacionadas con la operación se consideran en la determinación de los valores de adquisición/transmisión cuando correspondan.</span></div>
        <div className="renta-table-wrap"><table><thead><tr><th>Magnitud</th><th>Resultado</th><th>Estado</th></tr></thead><tbody><tr><td>Valor de transmisión</td><td>{money(report.proceeds)}</td><td><span className="renta-status ok">Calculado</span></td></tr><tr><td>Coste de adquisición</td><td>{money(report.costBasis)}</td><td><span className={`renta-status ${report.unknownBasis ? "warn" : "ok"}`}>{report.unknownBasis ? "Revisar lotes" : "FIFO"}</span></td></tr><tr><td>Ganancia / pérdida</td><td>{report.gainKnown ? money(report.gain) : "No definitiva"}</td><td><span className={`renta-status ${report.gainKnown ? "ok" : "warn"}`}>{report.gainKnown ? "Lista para revisión" : "Faltan datos"}</span></td></tr></tbody></table></div>
        <p className="renta-note">La cifra mostrada es la ganancia/pérdida de criptoactivos calculada por CoinRenta, no la cuota final del IRPF. La cuota dependerá, entre otros factores, del conjunto de la base del ahorro del contribuyente.</p>
      </section>

      <section className="renta-section panel-card">
        <div className="panel-head"><div><span className="section-kicker">PATRIMONIO · 31 DE DICIEMBRE</span><h3>Inventario patrimonial de criptoactivos</h3></div><span className={`renta-badge ${hasExactYearEndValuation ? "positive" : "warning"}`}>{hasExactYearEndValuation ? "Valoración disponible" : "Valoración pendiente"}</span></div>
        <div className="renta-summary-grid three"><div><small>Activos con saldo</small><strong>{report.positions.length}</strong></div><div><small>Valor conocido 31/12</small><strong>{money(report.positions.reduce((sum, item) => sum + (item.valueEur || 0), 0))}</strong></div><div><small>Datos necesarios</small><strong>Saldo + valor EUR + titularidad</strong></div></div>
        {report.positions.length ? <div className="renta-table-wrap"><table><thead><tr><th>Activo</th><th>Saldo</th><th>Valor EUR</th><th>Custodia</th></tr></thead><tbody>{report.positions.map((position) => <tr key={position.symbol}><td><strong>{position.name}</strong><small>{position.symbol}</small></td><td>{qty(position.quantity)}</td><td>{money(position.valueEur)}</td><td>{position.foreign ? "Custodia extranjera detectada" : "Revisar ubicación"}</td></tr>)}</tbody></table></div> : <div className="renta-empty">No hay posiciones calculables para este ejercicio con los datos disponibles.</div>}
        <p className="renta-note">La AEAT indica que las monedas virtuales deben declararse en Patrimonio por el saldo en euros a 31 de diciembre; la valoración se basa en la cotización a las 23:59 horas de ese día o, en defecto, en una estimación razonable. La obligación de presentar el Modelo 714 depende del patrimonio total y de la normativa aplicable al contribuyente.</p>
      </section>

      <section className="renta-section panel-card">
        <div className="panel-head"><div><span className="section-kicker">MODELO 721 · MONEDAS VIRTUALES EN EL EXTRANJERO</span><h3>Comprobación de obligación informativa</h3></div><span className={`renta-badge ${report.foreignValueEur > 50000 ? "warning" : ""}`}>{report.foreignValueEur > 50000 ? "Umbral superado" : "Por debajo de 50.000 € con datos actuales"}</span></div>
        <div className="renta-summary-grid three"><div><small>Saldo extranjero conocido</small><strong>{money(report.foreignValueEur)}</strong></div><div><small>Custodios extranjeros detectados</small><strong>{foreignCustodians.length}</strong></div><div><small>Estado</small><strong>{report.foreignValueEur > 50000 ? "Preparar Modelo 721" : "No supera el umbral actual"}</strong></div></div>
        <div className="renta-721-grid"><div><strong>Datos necesarios para el 721</strong><span>Custodio, identificación del custodio, tipo de moneda virtual, unidades y valoración en euros. La declaración es individualizada por moneda virtual.</span></div><div><strong>Regla de repetición</strong><span>Después de una primera declaración, la presentación vuelve a ser obligatoria cuando el saldo conjunto extranjero aumenta más de 20.000 € respecto del que originó la última declaración, y también en determinados supuestos de extinción de la titularidad.</span></div></div>
        <p className="renta-note">El umbral de 50.000 € se aplica al saldo conjunto de monedas virtuales situadas en el extranjero en los supuestos previstos por el artículo 42 quater RGAT. Una wallet propia no custodiada no se convierte automáticamente en una posición extranjera por el simple hecho de usar una blockchain extranjera.</p>
      </section>

      <section className="renta-section panel-card">
        <div className="panel-head"><div><span className="section-kicker">DAC8 · CARF · MiCA</span><h3>Trazabilidad y correspondencia regulatoria</h3></div><span className="renta-badge neutral">No son modelos del usuario</span></div>
        <div className="renta-framework-grid">
          <div><strong>DAC8</strong><span>Los proveedores obligados comunican información sobre usuarios, criptoactivos y operaciones sujetas a comunicación. El primer año de información de la Directiva es 2026, con comunicación posterior por los proveedores.</span><b>CoinRenta conserva: compras, ventas, permutas, transferencias, activos, fechas, importes y contraprestación.</b></div>
          <div><strong>CARF</strong><span>El marco OCDE exige reportar, entre otras, operaciones cripto/fiat, cripto/cripto y transferencias; además contempla categorías específicas cuando el proveedor conoce que una transferencia corresponde, por ejemplo, a staking o airdrops.</span><b>CoinRenta separa operaciones, transferencias e ingresos para facilitar su conciliación.</b></div>
          <div><strong>MiCA</strong><span>MiCA regula emisores y proveedores de servicios de criptoactivos, autorización, gobernanza, protección del cliente y conducta de mercado. No determina por sí mismo la cuota de IRPF del usuario.</span><b>La referencia a MiCA se usa para identificar el marco regulatorio del proveedor, no para crear un impuesto adicional.</b></div>
        </div>
      </section>

      <section className="renta-section panel-card">
        <div className="panel-head"><div><span className="section-kicker">CONTROL DE CALIDAD</span><h3>{dataIssues.length ? "El informe requiere revisión antes de declarar" : "Datos preparados para revisión"}</h3></div><span className={`renta-badge ${dataIssues.length ? "warning" : "positive"}`}>{dataIssues.length ? `${dataIssues.length} incidencias` : "Sin incidencias detectadas"}</span></div>
        {dataIssues.length ? <div className="renta-issues">{dataIssues.map((issue, index) => <div key={index}><span>!</span><p>{issue}</p></div>)}</div> : <div className="renta-ready"><strong>La información disponible pasa las comprobaciones básicas de integridad.</strong><span>Aun así, la revisión final debe contrastarse con la documentación original de cada exchange y con la situación fiscal global del contribuyente.</span></div>}
        <div className="renta-data-foot"><span>Transacciones del ejercicio: <strong>{selectedTransactions.length}</strong></span><span>Transacciones históricas analizadas: <strong>{transactions.length}</strong></span><span>Última actualización fiscal: <strong>{taxYearStored?.updated_at ? date(taxYearStored.updated_at) : "No registrada"}</strong></span></div>
      </section>
    </section>
  </>;
}
