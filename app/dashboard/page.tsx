import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Centro de Mando Fiscal", description: "Centro de Mando Fiscal de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TAX_YEAR = new Date().getFullYear();
const MODEL_721_LIMIT = 50000;

type Asset = { id: string; symbol: string; name: string | null };
type Account = { id: string; name: string | null; account_type: string | null; is_active: boolean | null; connection_id: string | null };
type Connection = { id: string; label: string | null; provider_type: string | null; status: string | null; last_sync_at: string | null; last_sync_status: string | null; exchange_id: string | null };
type Exchange = { id: string; name: string | null; code: string | null };
type Tx = { id: string; occurred_at: string; transaction_type: string | null; base_asset_id: string | null; base_amount: number | string | null; quote_asset_id: string | null; quote_amount: number | string | null; fee_asset_id: string | null; fee_amount: number | string | null; price: number | string | null; price_currency: string | null; account_id: string | null; raw_data: Record<string, unknown> | null };
type Snapshot = { id: string; captured_at: string; quantity: number | string | null; value_eur: number | string | null; asset_id: string | null; account_id: string | null };

type Lot = { qty: number; cost: number };

function money(value: number) { return Number.isFinite(value) ? value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }) : "—"; }
function number(value: number) { return Number.isFinite(value) ? value.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "—"; }
function parse(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function lower(value: unknown) { return String(value || "").trim().toLowerCase(); }
function isFiat(symbol: string | undefined) { return ["eur","usd","gbp","chf","pln","sek","dkk","nok","aud","cad","jpy","sgd"].includes(lower(symbol)); }
function isCold(account: Account | undefined, connection: Connection | undefined) { const text = `${account?.name || ""} ${account?.account_type || ""} ${connection?.label || ""}`.toLowerCase(); return /cold|hardware|ledger|trezor|billetera fría|billetera fria|cold wallet/.test(text); }
function isDisposal(type: string) { return /sell|sale|convert|swap|trade|exchange/.test(type); }
function isAcquisition(type: string) { return /buy|purchase|deposit|staking|reward|airdrop|interest|income|receive/.test(type); }
function taxOnSavings(amount: number) { let remaining = Math.max(0, amount); let tax = 0; for (const [limit, rate] of [[6000, .19], [44000, .21], [150000, .23], [100000, .27], [Infinity, .30]] as [number, number][]) { const slice = Math.min(remaining, limit); tax += slice * rate; remaining -= slice; if (remaining <= 0) break; } return tax; }
function eurValue(tx: Tx, baseQty: number, assets: Map<string, Asset>) { const price = parse(tx.price); if (price > 0 && lower(tx.price_currency) === "eur") return Math.abs(baseQty) * price; const quote = parse(tx.quote_amount); const quoteAsset = tx.quote_asset_id ? assets.get(tx.quote_asset_id)?.symbol : undefined; if (quote && lower(quoteAsset) === "eur") return Math.abs(quote); const raw = tx.raw_data || {}; for (const key of ["amount_fiat","fiat_amount","total_eur","value_eur"]) { const n = parse(raw[key]); if (n) return Math.abs(n); } return 0; }
function proceedsValue(tx: Tx, baseQty: number, assets: Map<string, Asset>) { return eurValue(tx, baseQty, assets); }

function calculateFiscal(transactions: Tx[], assets: Map<string, Asset>) {
  const lots = new Map<string, Lot[]>();
  let realized = 0;
  let yearRealized = 0;
  let missingBasis = 0;
  const sorted = [...transactions].sort((a,b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  for (const tx of sorted) {
    const type = lower(tx.transaction_type);
    const baseId = tx.base_asset_id;
    const baseQty = parse(tx.base_amount);
    if (!baseId || !baseQty) continue;
    const symbol = lower(assets.get(baseId)?.symbol);
    if (!symbol || isFiat(symbol)) continue;
    const year = new Date(tx.occurred_at).getFullYear();
    const book = lots.get(baseId) || [];
    if (isDisposal(type) && baseQty < 0) {
      let remaining = Math.abs(baseQty);
      let cost = 0;
      while (remaining > 1e-12 && book.length) {
        const lot = book[0];
        const used = Math.min(remaining, lot.qty);
        cost += used * (lot.cost / Math.max(lot.qty, 1e-18));
        lot.qty -= used; remaining -= used;
        if (lot.qty <= 1e-12) book.shift();
      }
      if (remaining > 1e-9) missingBasis += remaining;
      const proceeds = proceedsValue(tx, Math.abs(baseQty), assets);
      const gain = proceeds - cost;
      realized += gain;
      if (year === TAX_YEAR) yearRealized += gain;
    } else if (isAcquisition(type) && baseQty > 0) {
      const value = eurValue(tx, baseQty, assets);
      book.push({ qty: baseQty, cost: value });
    }
    lots.set(baseId, book);
  }
  return { realized, yearRealized, lots, missingBasis };
}

function latestPositions(snapshots: Snapshot[]) {
  const latest = new Map<string, Snapshot>();
  for (const row of snapshots) {
    if (!row.account_id || !row.asset_id) continue;
    const key = `${row.account_id}:${row.asset_id}`;
    const previous = latest.get(key);
    if (!previous || new Date(row.captured_at).getTime() > new Date(previous.captured_at).getTime()) latest.set(key, row);
  }
  return [...latest.values()];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: txRows, count: transactionCount }, { data: assetRows }, { data: accountRows }, { data: connectionRows }, { data: exchangeRows }, { data: snapshots }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("transactions").select("id,occurred_at,transaction_type,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,account_id,raw_data", { count: "exact" }).eq("user_id", user.id).order("occurred_at", { ascending: true }).limit(25000),
    supabase.from("assets").select("id,symbol,name").limit(5000),
    supabase.from("accounts").select("id,name,account_type,is_active,connection_id").eq("user_id", user.id),
    supabase.from("exchange_connections").select("id,label,provider_type,status,last_sync_at,last_sync_status,exchange_id").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("exchanges").select("id,name,code").limit(500),
    supabase.from("balance_snapshots").select("id,captured_at,quantity,value_eur,asset_id,account_id").eq("user_id", user.id).order("captured_at", { ascending: true }).limit(20000),
  ]);

  const assets = new Map((assetRows || []).map((a: Asset) => [a.id, a]));
  const accounts = new Map((accountRows || []).map((a: Account) => [a.id, a]));
  const connections = new Map((connectionRows || []).map((c: Connection) => [c.id, c]));
  const exchanges = new Map((exchangeRows || []).map((e: Exchange) => [e.id, e]));
  const transactions = (txRows || []) as Tx[];
  const fiscal = calculateFiscal(transactions, assets);
  const current = latestPositions((snapshots || []) as Snapshot[]).filter((row) => parse(row.quantity) > 1e-12 && parse(row.value_eur) >= 0);
  const totalValue = current.reduce((sum, row) => sum + parse(row.value_eur), 0);

  const foreignValue = current.reduce((sum, row) => {
    const account = accounts.get(row.account_id || ""); const connection = account?.connection_id ? connections.get(account.connection_id) : undefined;
    if (!account || !connection || isCold(account, connection)) return sum;
    return sum + parse(row.value_eur);
  }, 0);
  const model721Pct = Math.min(100, (foreignValue / MODEL_721_LIMIT) * 100);
  const model721Over = foreignValue >= MODEL_721_LIMIT;

  const currentCostByAsset = new Map<string, number>();
  for (const row of current) {
    const lots = fiscal.lots.get(row.asset_id || "") || [];
    currentCostByAsset.set(row.asset_id || "", lots.reduce((sum, lot) => sum + lot.cost, 0));
  }
  const unrealizedLoss = current.reduce((sum, row) => {
    const value = parse(row.value_eur); const cost = currentCostByAsset.get(row.asset_id || "") || 0;
    return sum + Math.min(0, value - cost);
  }, 0);
  const potentialSaving = Math.abs(unrealizedLoss) * 0.19;

  const unresolvedTypes = new Set(["unknown", "other", "manual", "unclassified", "unknown_transaction", ""]).size;
  const unclassified = transactions.filter((tx) => { const t = lower(tx.transaction_type); return !t || ["unknown","other","manual","unclassified","unknown_transaction"].includes(t); }).length;
  const activeConnections = (connectionRows || []).filter((c: Connection) => c.status === "active");
  const name = profile?.display_name || user.email?.split("@")[0] || "usuario";
  const initials = name.slice(0, 1).toUpperCase();

  return <>
    <style>{`
      .fiscal-dashboard{padding-bottom:48px}.fiscal-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}.fiscal-kicker{color:#6fdad2;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.fiscal-hero h1{margin:8px 0 6px;font-size:clamp(30px,3.4vw,43px);line-height:1;letter-spacing:-.055em}.fiscal-hero p{margin:0;color:var(--cr-text-muted);font-size:13px}.fiscal-year{padding:10px 13px;border:1px solid var(--cr-border);border-radius:12px;background:var(--cr-surface);color:#7ddbd4;font-size:11px;font-weight:850}.fiscal-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:16px}.fiscal-card{min-width:0;border:1px solid var(--cr-border);border-radius:19px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm);overflow:hidden}.fiscal-card-pad{padding:22px}.fiscal-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:20px}.fiscal-card-head h2,.fiscal-card-head h3{margin:0;font-size:15px;letter-spacing:-.025em}.fiscal-card-head p{margin:5px 0 0;color:var(--cr-text-muted);font-size:10px;line-height:1.5}.fiscal-impact{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fiscal-impact-box{padding:18px;border:1px solid var(--cr-border);border-radius:15px;background:rgba(255,255,255,.018)}.fiscal-impact-label{display:block;color:var(--cr-text-muted);font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.fiscal-impact-value{display:block;margin-top:9px;font-size:clamp(25px,3vw,36px);line-height:1;letter-spacing:-.055em}.fiscal-positive{color:#6ed8a9}.fiscal-negative{color:#ef8e8e}.fiscal-reserve{color:#f0bd63}.fiscal-foot{display:flex;align-items:center;gap:8px;margin-top:13px;color:var(--cr-text-muted);font-size:9px}.fiscal-dot{width:7px;height:7px;border-radius:50%;background:var(--cr-success);box-shadow:0 0 0 4px rgba(50,181,122,.08)}.fiscal-721{position:relative}.fiscal-meter{height:12px;margin:20px 0 12px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}.fiscal-meter-bar{height:100%;border-radius:inherit;background:linear-gradient(90deg,#32b57a,#e5af3b,#e76a6a);transition:width .5s ease}.fiscal-721-value{display:flex;align-items:end;justify-content:space-between;gap:10px}.fiscal-721-value strong{font-size:26px;letter-spacing:-.045em}.fiscal-721-value span{color:var(--cr-text-muted);font-size:10px}.fiscal-alert{margin-top:13px;padding:12px 13px;border-radius:12px;font-size:10px;line-height:1.5}.fiscal-alert-ok{border:1px solid rgba(50,181,122,.2);background:rgba(50,181,122,.07);color:#8ddbb8}.fiscal-alert-danger{border:1px solid rgba(231,106,106,.25);background:rgba(231,106,106,.08);color:#f0a0a0}.fiscal-hero-stat{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}.fiscal-badge{padding:5px 8px;border-radius:999px;background:rgba(99,102,241,.1);color:#aaa9ff;font-size:8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.fiscal-loss{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px;border:1px solid rgba(231,106,106,.18);border-radius:14px;background:rgba(231,106,106,.045)}.fiscal-loss strong{display:block;font-size:26px;color:#ef9292;letter-spacing:-.04em}.fiscal-loss span{display:block;margin-top:4px;color:var(--cr-text-muted);font-size:10px}.fiscal-saving{text-align:right}.fiscal-saving strong{font-size:20px;color:#6fd8d0}.fiscal-saving small{display:block;color:var(--cr-text-muted);font-size:9px;margin-top:3px}.fiscal-empty{padding:17px;border:1px dashed var(--cr-border-strong);border-radius:14px;color:var(--cr-text-muted);font-size:10px}.fiscal-tech{grid-column:1/-1}.fiscal-tech-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}.sync-list{display:grid;gap:8px}.sync-row{display:flex;align-items:center;gap:11px;padding:12px 13px;border:1px solid var(--cr-border);border-radius:12px;background:rgba(255,255,255,.018)}.sync-status{width:8px;height:8px;flex:0 0 auto;border-radius:50%}.sync-ok{background:var(--cr-success);box-shadow:0 0 0 4px rgba(50,181,122,.08)}.sync-warn{background:var(--cr-warning);box-shadow:0 0 0 4px rgba(229,175,59,.08)}.sync-info{min-width:0;flex:1}.sync-info strong{display:block;font-size:11px}.sync-info small{display:block;margin-top:2px;color:var(--cr-text-muted);font-size:9px}.sync-time{color:#8492a7;font-size:9px;white-space:nowrap}.tech-metric{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.tech-box{padding:14px;border:1px solid var(--cr-border);border-radius:12px}.tech-box strong{display:block;font-size:22px}.tech-box span{display:block;margin-top:4px;color:var(--cr-text-muted);font-size:9px}.fiscal-link{display:inline-flex;align-items:center;gap:5px;margin-top:14px;color:#70d8d1;font-size:10px;font-weight:850}.fiscal-note{margin-top:16px;color:#748197;font-size:9px;line-height:1.55}.fiscal-nav{display:flex;gap:8px;flex-wrap:wrap}.fiscal-nav a{padding:8px 10px;border:1px solid var(--cr-border);border-radius:9px;color:#a7b3c5;font-size:9px;font-weight:800}.fiscal-nav a:hover{border-color:rgba(15,167,160,.4);color:#70d8d1}@media(max-width:980px){.fiscal-grid{grid-template-columns:1fr}.fiscal-tech{grid-column:auto}.fiscal-tech-grid{grid-template-columns:1fr}}@media(max-width:620px){.fiscal-hero{display:block}.fiscal-year{display:inline-flex;margin-top:14px}.fiscal-impact{grid-template-columns:1fr}.fiscal-card-pad{padding:17px}.fiscal-loss{align-items:flex-start;flex-direction:column}.fiscal-saving{text-align:left}.tech-metric{grid-template-columns:1fr 1fr}}
    `}</style>
    <header className="app-topbar dashboard-topbar-modern"><div className="dashboard-search">⌕ <span>Buscar por activo, exchange, transacción...</span></div><div className="topbar-actions"><span className="notification">♧<i /></span><span className="profile-chip">{initials}</span><div className="profile-summary"><strong>{name}</strong><span>Centro de Mando Fiscal</span></div><span className="profile-chevron">⌄</span></div></header>
    <section className="dashboard-content fiscal-dashboard">
      <div className="fiscal-hero"><div><span className="fiscal-kicker">Centro de Mando Fiscal</span><h1>Tu situación fiscal, de un vistazo</h1><p>Las cifras que importan para saber qué has generado, qué debes reservar y qué riesgos tienes abiertos.</p></div><div className="fiscal-year">Ejercicio {TAX_YEAR}</div></div>

      <div className="fiscal-grid">
        <section className="fiscal-card fiscal-card-pad">
          <div className="fiscal-card-head"><div><h2>Semáforo fiscal · {TAX_YEAR}</h2><p>Ganancias y pérdidas patrimoniales ya realizadas durante el ejercicio.</p></div><span className={`fiscal-badge ${fiscal.yearRealized > 0 ? "" : "fiscal-positive"}`}>{fiscal.yearRealized > 0 ? "Reserva recomendada" : "Sin ganancia neta"}</span></div>
          <div className="fiscal-impact"><div className="fiscal-impact-box"><span className="fiscal-impact-label">Ganancia / pérdida realizada</span><strong className={`fiscal-impact-value ${fiscal.yearRealized >= 0 ? "fiscal-positive" : "fiscal-negative"}`}>{fiscal.yearRealized >= 0 ? "+" : ""}{money(fiscal.yearRealized)}</strong><div className="fiscal-foot"><span className="fiscal-dot" />Resultado neto calculado sobre tus operaciones</div></div><div className="fiscal-impact-box"><span className="fiscal-impact-label">Provisión IRPF estimada</span><strong className="fiscal-impact-value fiscal-reserve">{money(taxOnSavings(fiscal.yearRealized))}</strong><div className="fiscal-foot"><span className="fiscal-dot" />Estimación por escala estatal del ahorro</div></div></div>
          <p className="fiscal-note">Estimación orientativa: no sustituye el cálculo completo de tu declaración ni incorpora otras rentas, compensaciones, mínimos o circunstancias personales.</p>
        </section>

        <section className="fiscal-card fiscal-card-pad fiscal-721">
          <div className="fiscal-card-head"><div><h2>Modelo 721</h2><p>Valor estimado de criptoactivos en exchanges extranjeros.</p></div><span className="fiscal-badge">Compliance</span></div>
          <div className="fiscal-721-value"><strong>{money(foreignValue)}</strong><span>límite de referencia {money(MODEL_721_LIMIT)}</span></div>
          <div className="fiscal-meter"><div className="fiscal-meter-bar" style={{ width: `${model721Pct}%` }} /></div>
          <div className={`fiscal-alert ${model721Over ? "fiscal-alert-danger" : "fiscal-alert-ok"}`}>{model721Over ? `⚠ Estás por encima de ${money(MODEL_721_LIMIT)} en exchanges extranjeros. Revisa tu obligación de informar y prepara el informe del Modelo 721.` : `✓ Estás por debajo del umbral de ${money(MODEL_721_LIMIT)} según los saldos actualmente sincronizados.`}</div>
          <Link className="fiscal-link" href="/dashboard/renta">Ver informe fiscal →</Link>
        </section>

        <section className="fiscal-card fiscal-card-pad">
          <div className="fiscal-card-head"><div><h2>Cómo ahorrar impuestos hoy</h2><p>Oportunidades de Tax Loss Harvesting detectadas sobre tus posiciones actuales.</p></div><span className="fiscal-badge">PRO</span></div>
          {unrealizedLoss < -0.01 ? <div className="fiscal-loss"><div><strong>{money(unrealizedLoss)}</strong><span>Pérdidas latentes estimadas en posiciones abiertas</span></div><div className="fiscal-saving"><strong>≈ {money(potentialSaving)}</strong><small>ahorro fiscal potencial al 19%</small></div></div> : <div className="fiscal-empty">No se han detectado pérdidas latentes relevantes con los datos disponibles.</div>}
          <p className="fiscal-note">La venta de activos puede tener efectos fiscales y de mercado adicionales. CoinRenta muestra una oportunidad estimada, no una orden de venta.</p>
        </section>

        <section className="fiscal-card fiscal-card-pad">
          <div className="fiscal-card-head"><div><h2>Salud de la sincronización</h2><p>Comprueba si tus datos fiscales están actualizados.</p></div><span className="fiscal-badge">Datos</span></div>
          <div className="sync-list">{activeConnections.length ? activeConnections.slice(0,5).map((connection: Connection) => { const exchange = connection.exchange_id ? exchanges.get(connection.exchange_id) : undefined; const ok = connection.last_sync_status === "success" || connection.status === "active"; const label = exchange?.name || connection.label || "Exchange"; const when = connection.last_sync_at ? new Intl.DateTimeFormat("es-ES", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }).format(new Date(connection.last_sync_at)) : "sin fecha"; return <div className="sync-row" key={connection.id}><span className={`sync-status ${ok ? "sync-ok" : "sync-warn"}`} /><div className="sync-info"><strong>{label}</strong><small>{ok ? "Sincronización operativa" : "Requiere revisión"}</small></div><span className="sync-time">{when}</span></div>; }) : <div className="fiscal-empty">No tienes conexiones activas todavía.</div>}</div>
          <div className="fiscal-nav"><Link href="/dashboard/exchanges">Gestionar conexiones →</Link><Link href="/dashboard/movimientos">Ver movimientos →</Link></div>
        </section>

        <section className="fiscal-card fiscal-card-pad fiscal-tech">
          <div className="fiscal-card-head"><div><h2>Avisos y calidad de datos</h2><p>Indicadores técnicos que condicionan la precisión de tu información fiscal.</p></div></div>
          <div className="fiscal-tech-grid"><div className="tech-metric"><div className="tech-box"><strong>{number(transactionCount || transactions.length)}</strong><span>movimientos procesados</span></div><div className="tech-box"><strong>{number(unclassified)}</strong><span>sin clasificar</span></div></div><div>{unclassified > 0 ? <div className="fiscal-alert fiscal-alert-danger">⚠ Tienes {unclassified} movimientos que necesitan clasificación manual antes de considerar el expediente fiscal cerrado.</div> : fiscal.missingBasis > 0 ? <div className="fiscal-alert fiscal-alert-danger">⚠ Faltan datos de coste de adquisición para {number(fiscal.missingBasis)} unidades. Revisa los importes originales antes de presentar la Renta.</div> : <div className="fiscal-alert fiscal-alert-ok">✓ No se han detectado movimientos sin clasificar ni faltantes de coste de adquisición con los datos actuales.</div>}</div></div>
        </section>
      </div>
    </section>
  </>;
}
