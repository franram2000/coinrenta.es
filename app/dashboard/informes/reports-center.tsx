'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateFifo, type FifoReport } from '@/lib/tax/fifo';
import { datasetToFifo, fetchConnectionDataset, mergeDatasets, type LocalDataset, type LocalMovement } from '@/lib/client/local-cache';

type Connection = { id: string; label: string | null; exchange: string; exchangeName: string; status: string | null };
type Props = { userId: string; connections: Connection[]; displayName?: string | null; plan: string };
type YearLoss = { year: number; loss: number; remaining: number; expires: number };
type HarvestCandidate = { asset: string; quantity: number; cost: number; lastPrice: number; loss: number; confidence: 'Alta' | 'Media' };
type NonTransmission = { date: string; type: string; asset: string; amount: number | null; valueEur: number | null; exchange: string };

const fiat = new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']);
const incomeTypes = new Set(['reward','interest','dividend','airdrop','cashback','income']);
const nonTransferIncome = /airdrop|refer|referral|referido|bonus|bono|welcome|bienvenida/i;

function money(v: number | null) { return v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }); }
function num(v: number | null, digits = 6) { return v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('es-ES', { maximumFractionDigits: digits }); }
function dt(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(d); }
function originalType(m: LocalMovement) { return `${m.originalType || ''} ${m.transactionType || ''}`.toLowerCase(); }
function valueEur(m: LocalMovement) {
  const raw = m.rawRow || {};
  for (const key of ['value_eur','total_eur','amount_eur','fiat_amount_eur','proceeds_eur','eur_value','EUR Value']) {
    const n = Number(String(raw[key] ?? '').replace(',', '.'));
    if (Number.isFinite(n) && n !== 0) return Math.abs(n);
  }
  const quote = Math.abs(Number(m.quoteAmount));
  const quoteAsset = String(m.quoteAsset || '').toUpperCase();
  if (Number.isFinite(quote) && quote > 0 && quoteAsset === 'EUR') return quote;
  const base = Math.abs(Number(m.baseAmount));
  const price = Math.abs(Number(m.price));
  const currency = String(m.priceCurrency || '').toUpperCase();
  if (Number.isFinite(base) && Number.isFinite(price) && base > 0 && price > 0 && currency === 'EUR') return base * price;
  return null;
}

export default function ReportsCenter({ userId, connections, displayName, plan }: Props) {
  const [datasets, setDatasets] = useState<LocalDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [taxRate, setTaxRate] = useState(21);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState<string | null>(null);

  async function load() {
    setError(null);
    const active = connections.filter((c) => c.status !== 'error');
    if (!active.length) { setDatasets([]); setLoading(false); return; }
    try {
      const loaded = await Promise.all(active.map((c) => fetchConnectionDataset(userId, c.id, 'reports')));
      setDatasets(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos para los informes.');
      setDatasets([]);
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void load(); }, [connections.map((c) => `${c.id}:${c.status}`).join('|')]);

  const movements = useMemo(() => mergeDatasets(datasets).map((m) => ({ ...m, transactionType: String(m.transactionType || '').toLowerCase() })), [datasets]);
  const fifoReport = useMemo<FifoReport | null>(() => {
    if (!movements.length) return null;
    try {
      const merged: LocalDataset = { version: 9, userId, connectionId: 'reports', sourceVersion: 'reports', fetchedAt: new Date().toISOString(), exchange: 'merged', movements };
      const { txs, assets } = datasetToFifo(merged);
      return calculateFifo(txs, assets);
    } catch { return null; }
  }, [movements, userId]);

  const yearStats = useMemo(() => {
    const grouped = new Map<number, { gain: number; known: boolean }>();
    for (const sale of fifoReport?.qualitySales || []) {
      const year = new Date(sale.occurredAt).getFullYear();
      const row = grouped.get(year) || { gain: 0, known: true };
      if (sale.proceeds == null || sale.costBasis == null || sale.missingCostEur != null) row.known = false;
      else row.gain += sale.proceeds - sale.costBasis;
      grouped.set(year, row);
    }
    return [...grouped.entries()].sort((a,b) => a[0]-b[0]);
  }, [fifoReport]);

  const lossPool = useMemo<YearLoss[]>(() => {
    const pool: YearLoss[] = [];
    let carry: { origin: number; amount: number; expires: number }[] = [];
    for (const [year, stat] of yearStats) {
      carry = carry.filter((x) => x.expires >= year && x.amount > 0.005);
      if (stat.gain < -0.005) carry.push({ origin: year, amount: Math.abs(stat.gain), expires: year + 4 });
      if (stat.gain > 0.005) {
        let remaining = stat.gain;
        for (const item of carry) { const used = Math.min(item.amount, remaining); item.amount -= used; remaining -= used; if (remaining <= 0) break; }
      }
      for (const item of carry) {
        const existing = pool.find((p) => p.year === item.origin);
        if (existing) existing.remaining = item.amount;
        else pool.push({ year: item.origin, loss: Math.max(item.amount, 0), remaining: Math.max(item.amount, 0), expires: item.expires });
      }
    }
    return pool.filter((p) => p.remaining > 0.005).sort((a,b) => a.year-b.year);
  }, [yearStats]);

  const currentHoldings = useMemo(() => {
    if (!fifoReport) return [] as HarvestCandidate[];
    const priceByAsset = new Map<string, number>();
    for (const m of movements) {
      const asset = String(m.baseAsset || '').toUpperCase();
      const p = Math.abs(Number(m.price));
      const currency = String(m.priceCurrency || '').toUpperCase();
      if (asset && !fiat.has(asset) && Number.isFinite(p) && p > 0 && currency === 'EUR') priceByAsset.set(asset, p);
    }
    const grouped = new Map<string, { qty: number; cost: number; lastPrice: number }>();
    for (const [assetId, lots] of fifoReport.yearEndLots) {
      const symbol = assetId.replace(/^local-asset:/, '').toUpperCase();
      if (fiat.has(symbol)) continue;
      let qty = 0, cost = 0;
      for (const lot of lots) { qty += lot.qty; cost += lot.costEur ?? 0; }
      const lastPrice = priceByAsset.get(symbol) || 0;
      if (qty > 0 && lastPrice > 0 && cost > lastPrice * qty * 1.001) {
        grouped.set(symbol, { qty, cost, lastPrice });
      }
    }
    return [...grouped.entries()].map(([asset, x]) => ({ asset, quantity: x.qty, cost: x.cost, lastPrice: x.lastPrice, loss: x.lastPrice * x.qty - x.cost, confidence: 'Media' as const })).sort((a,b) => a.loss - b.loss);
  }, [fifoReport, movements]);

  const nonTransmissionals = useMemo<NonTransmission[]>(() => movements.filter((m) => incomeTypes.has(String(m.transactionType || '').toLowerCase()) || nonTransferIncome.test(originalType(m))).map((m) => ({ date: m.occurredAt, type: /airdrop/i.test(originalType(m)) ? 'Airdrop' : /refer|referido/i.test(originalType(m)) ? 'Referido' : /bonus|bono|welcome|bienvenida/i.test(originalType(m)) ? 'Bono' : 'Rendimiento', asset: m.baseAsset || m.quoteAsset || '—', amount: m.baseAmount ?? null, valueEur: valueEur(m), exchange: m.exchange || '—' })), [movements]);

  async function download(kind: string, payload: Record<string, unknown>) {
    setGenerating(kind); setError(null);
    try {
      const response = await fetch('/api/reports/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, userName: displayName || 'Titular de la cuenta', generatedAt: new Date().toISOString(), ...payload }) });
      if (!response.ok) throw new Error(await response.text() || 'No se pudo generar el PDF.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${kind}-coinrenta.pdf`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.'); }
    finally { setGenerating(null); }
  }

  if (loading) return <div className="reports-state"><div className="reports-spinner"/><strong>Preparando tus informes</strong><span>Estamos reuniendo el histórico disponible en CoinRenta.</span></div>;

  return <div className="reports-page">
    <div className="reports-hero"><div><span className="section-kicker">Documentación fiscal</span><h2>Informes y herramientas</h2><p>Genera documentación estructurada a partir del histórico normalizado de tu cuenta y analiza situaciones fiscales relevantes.</p></div><div className="reports-coverage"><strong>{movements.length.toLocaleString('es-ES')}</strong><span>movimientos analizados</span><button className="btn btn-outline" type="button" onClick={() => { setRefreshing(true); void load(); }} disabled={refreshing}>{refreshing ? 'Actualizando…' : 'Actualizar datos'}</button></div></div>
    {error && <div className="reports-error" role="alert">{error}</div>}
    <div className="reports-grid">
      <article className="report-card report-card-wide"><div className="report-card-top"><div className="report-icon">↗</div><span className="report-badge">Esencial</span></div><h3>Trazabilidad y Origen de Fondos</h3><p>Documenta la trazabilidad de una retirada en EUR y relaciona, cuando los datos lo permiten, depósitos, adquisiciones, ventas y retirada final.</p><div className="origin-preview">{(() => { const withdrawal = movements.find((m) => ['withdrawal','withdraw'].includes(String(m.transactionType)) && String(m.baseAsset || '').toUpperCase() === 'EUR'); if (!withdrawal) return <span>No se ha localizado una retirada EUR en el histórico actual.</span>; const idx = movements.indexOf(withdrawal); const previous = movements.slice(0, idx).slice(-4).reverse(); return <><strong>Retirada detectada: {money(valueEur(withdrawal))}</strong><div>{previous.slice(0,3).map((m) => <span key={m.id}>{dt(m.occurredAt)} · {m.transactionType} · {m.baseAsset || '—'} {num(m.baseAmount)}</span>)}</div></>; })()}</div><button className="report-action" type="button" disabled={generating === 'origen-fondos' || movements.length === 0} onClick={() => download('origen-fondos', { movements: movements.slice(-120), selectedYear })}>{generating === 'origen-fondos' ? 'Generando PDF…' : 'Generar informe PDF →'}</button></article>

      <article className="report-card"><div className="report-card-top"><div className="report-icon">◫</div><span className="report-badge">Esencial</span></div><h3>Bolsa de Pérdidas a Compensar</h3><p>Visualiza las pérdidas derivadas de transmisiones que, según el histórico analizado, permanecen pendientes de compensación dentro del plazo de cuatro años.</p><div className="loss-table">{lossPool.length ? lossPool.slice(0,4).map((x) => <div key={x.year}><span>{x.year}</span><strong>{money(x.remaining)}</strong><small>Vence {x.expires}</small></div>) : <div className="reports-empty">No se ha identificado una bolsa pendiente con los datos disponibles.</div>}</div><button className="report-action" type="button" disabled={generating === 'perdidas' || !lossPool.length} onClick={() => download('bolsa-perdidas', { losses: lossPool })}>{generating === 'perdidas' ? 'Generando PDF…' : 'Descargar informe →'}</button></article>

      <article className="report-card"><div className="report-card-top"><div className="report-icon">◒</div><span className="report-badge pro">Pro</span></div><h3>Simulador de optimización de diciembre</h3><p>Simulación de posibles pérdidas latentes usando la última valoración en EUR observada en el histórico. No sustituye el análisis fiscal completo.</p><div className="harvest-controls"><label>Tipo de ahorro de referencia<input type="number" min="0" max="100" step="0.5" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}/></label></div><div className="harvest-total"><span>Pérdida potencial identificada</span><strong>{money(currentHoldings.reduce((s, x) => s + Math.min(0, x.loss), 0))}</strong><small>Ahorro orientativo al {taxRate.toFixed(1).replace('.', ',')}%: {money(Math.abs(currentHoldings.reduce((s, x) => s + Math.min(0, x.loss), 0)) * (taxRate/100))}</small></div><div className="loss-table">{currentHoldings.slice(0,5).map((x) => <div key={x.asset}><span>{x.asset}</span><strong>{money(x.loss)}</strong><small>{num(x.quantity)} uds · referencia {money(x.lastPrice)}</small></div>)}{!currentHoldings.length && <div className="reports-empty">No hay posiciones con pérdida estimable a partir de la última valoración encontrada.</div>}</div><button className="report-action" type="button" disabled={generating === 'harvest' || !currentHoldings.length} onClick={() => download('optimizacion-diciembre', { taxRate, candidates: currentHoldings.slice(0,20), selectedYear })}>{generating === 'harvest' ? 'Generando PDF…' : 'Generar extracto →'}</button></article>

      <article className="report-card"><div className="report-card-top"><div className="report-icon">✦</div><span className="report-badge">Esencial</span></div><h3>Ganancias No Transmisivas</h3><p>Separa airdrops, referidos, bonos y otros ingresos no derivados de una venta para revisarlos con su fecha y valoración disponible.</p><div className="nontrans-summary"><strong>{nonTransmissionals.length}</strong><span>eventos detectados</span></div><div className="nontrans-list">{nonTransmissionals.slice(0,5).map((x) => <div key={`${x.date}:${x.asset}`}><span>{x.type}</span><strong>{x.asset}</strong><small>{dt(x.date)} · {money(x.valueEur)}</small></div>)}{!nonTransmissionals.length && <div className="reports-empty">No se han detectado eventos de este tipo en el histórico actual.</div>}</div><button className="report-action" type="button" disabled={generating === 'no-transmisivas' || !nonTransmissionals.length} onClick={() => download('ganancias-no-transmisivas', { events: nonTransmissionals })}>{generating === 'no-transmisivas' ? 'Generando PDF…' : 'Descargar informe →'}</button></article>
    </div>
    <div className="reports-methodology"><div><span className="section-kicker">Metodología</span><h3>Cómo interpretar estos informes</h3><p>Los informes se construyen con el histórico normalizado disponible en CoinRenta y con el cálculo FIFO local. Cuando una valoración, coste de adquisición o enlace entre movimientos no puede acreditarse con suficiente información, se marca como estimado o pendiente en lugar de inventarlo.</p></div><div className="reports-legal-note">Los informes son documentación de apoyo. No garantizan la aceptación por una entidad bancaria o por la Administración tributaria y no sustituyen el asesoramiento profesional.</div></div>
  </div>;
}
