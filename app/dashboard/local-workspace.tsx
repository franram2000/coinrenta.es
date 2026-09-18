'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { calculateFifo, type FifoReport } from '@/lib/tax/fifo';
import { datasetToFifo, fetchConnectionDataset, mergeDatasets, type LocalDataset, type LocalMovement } from '@/lib/client/local-cache';
import type { ReviewIssue } from '@/lib/exchanges/canonicalize';

export type LocalConnection = { id: string; label: string | null; provider_type: string | null; status: string | null; last_sync_at: string | null; last_sync_status: string | null; exchange: string; exchangeName: string };
type Plan = 'free' | 'essential' | 'pro' | 'admin';
type Props = { userId: string; connections: LocalConnection[]; mode: 'renta' | 'movimientos' | 'fiscalidad' | 'resumen'; isPro: boolean; plan?: Plan; displayName?: string | null; year?: number };

type ReviewOverride = Partial<Pick<LocalMovement, 'transactionType' | 'baseAsset' | 'baseAmount' | 'quoteAsset' | 'quoteAmount' | 'feeAsset' | 'feeAmount' | 'price' | 'priceCurrency'>> & { targetMovementId: string; note?: string; resolvedAt: string };
type Incident = { id: string; movementId: string | null; occurredAt: string | null; title: string; message: string; severity: 'warning' | 'blocking'; hint?: string; kind: 'parser' | 'fifo' | 'system'; issue?: ReviewIssue };

function money(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }); }
function qty(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: 8 }); }
function date(value: string) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function isFiat(symbol: string | null) { return new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']).has(String(symbol || '').toUpperCase()); }

function fiscalizeMovement(movement: LocalMovement): LocalMovement {
  const original = String(movement.originalType || '').trim().toLowerCase();
  const stored = String(movement.transactionType || '').trim().toLowerCase();
  let type = stored;
  if (/^sell$|^sold$|^sale$|^venta$|^vendido$/.test(original)) type = 'sell';
  else if (/^buy$|^bought$|^purchase$|^purchased$|^compra$|^comprado$/.test(original)) type = 'buy';
  else if (/transfer\s*\(?stake\)?|stake\s+transfer|staking\s+allocation/.test(original)) type = 'transfer_in';
  else if (/transfer\s*\(?unstake\)?|unstake\s+transfer|staking\s+deallocation/.test(original)) type = 'transfer_out';
  else if (/^deposit$|^receive$|^received$|^deposito$/.test(original)) type = 'deposit';
  else if (/^withdrawal$|^withdraw$|^retirada$/.test(original)) type = 'withdrawal';
  else if (/^reward$|^bonus$|^airdrop$/.test(original)) type = 'reward';
  return { ...movement, transactionType: type || 'other' };
}

function WorkspaceStyles() {
  return <style jsx global>{`
    .workspace-page{width:100%;max-width:1240px}.workspace-subtitle{margin:5px 0 0;color:var(--cr-text-muted);font-size:13px}.renta-page{min-height:100%}
    .renta-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:16px}.renta-hero h2{margin:6px 0 4px;font-size:26px;letter-spacing:-.045em}.renta-hero p{margin:0;color:var(--cr-text-muted);font-size:12px}.renta-year-switcher{display:flex;gap:6px;flex-wrap:wrap}.renta-year-switcher a{padding:8px 11px;border:1px solid var(--cr-border);border-radius:9px;color:#91A0B6;font-size:11px;font-weight:800;background:rgba(255,255,255,.02)}.renta-year-switcher a:hover,.renta-year-switcher a.selected{color:#6DE0D7;border-color:rgba(15,167,160,.30);background:var(--cr-primary-soft)}
    .renta-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:15px}.renta-number-warning{color:var(--cr-warning)}.renta-badge,.fiscal-badge{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid var(--cr-border);border-radius:999px;color:#8290A5;background:rgba(255,255,255,.025);font-size:9px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}.renta-section{margin-top:15px}
    .renta-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:18px}.renta-summary-grid>div{min-width:0;padding:14px;border:1px solid var(--cr-border);border-radius:12px;background:rgba(255,255,255,.02)}.renta-summary-grid small{display:block;color:#7F8DA3;font-size:10px;font-weight:750}.renta-summary-grid strong{display:block;margin-top:5px;font-size:16px;letter-spacing:-.02em}
    .table-wrap{margin-top:18px;overflow:auto;border:1px solid var(--cr-border);border-radius:14px;background:#0A1220}.workspace-table{width:100%;min-width:900px;border-collapse:collapse}.workspace-table th{padding:12px 14px;text-align:left;color:#AAB6C7;background:rgba(255,255,255,.035);border-bottom:1px solid var(--cr-border);font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}.workspace-table td{padding:11px 14px;color:#D7DFE9;border-bottom:1px solid rgba(255,255,255,.055);font-size:12px;vertical-align:middle;white-space:nowrap}.workspace-table tbody tr:hover{background:rgba(255,255,255,.025)}.workspace-table tbody tr:last-child td{border-bottom:0}.workspace-table td strong{display:block;font-size:12px}.table-subtext{display:block;margin-top:2px;color:#6F7E94;font-size:9px}.movement-type{display:inline-flex;align-items:center;padding:5px 8px;border-radius:7px;background:rgba(15,167,160,.09);color:#72D7CF;font-size:10px;font-weight:850}
    .fiscality-stat-grid{margin-top:0}.fiscality-section{margin-top:15px}.data-list{display:grid;gap:0;margin-top:12px}.data-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;border-top:1px solid var(--cr-border)}.data-row strong,.data-row span{display:block}.data-row strong{font-size:12px}.data-row div span{margin-top:3px;color:#7D8BA0;font-size:11px}.fiscal-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:15px}.fiscal-card{min-width:0;border:1px solid var(--cr-border);border-radius:18px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm)}.fiscal-card-pad{padding:23px}.fiscal-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.fiscal-kicker{color:#54D0C8;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.fiscal-card h2,.fiscal-card h3{margin:5px 0 0;letter-spacing:-.035em}.fiscal-card h2{font-size:21px}.fiscal-card h3{font-size:17px}.fiscal-impact{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.fiscal-impact-box{padding:16px;border:1px solid var(--cr-border);border-radius:13px;background:rgba(255,255,255,.02)}.fiscal-impact-label{display:block;color:#7F8DA3;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.fiscal-impact-value{display:block;margin-top:7px;font-size:25px;letter-spacing:-.045em}.fiscal-foot{display:flex;align-items:center;gap:7px;margin-top:15px;color:#728198;font-size:10px}.fiscal-dot{width:6px;height:6px;border-radius:50%;background:var(--cr-success)}.fiscal-tech{grid-column:1 / -1}.renta-framework-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:17px}.renta-framework-grid>div{display:grid;gap:5px;padding:14px;border:1px solid var(--cr-border);border-radius:12px;background:rgba(255,255,255,.02)}.renta-framework-grid strong{font-size:11px}.renta-framework-grid span{color:#7D8DA0;font-size:10px;line-height:1.55}.renta-empty{min-height:180px;display:grid;place-items:center;padding:30px;text-align:center;color:#7D8DA0;font-size:12px}.connection-error{padding:18px;border:1px solid rgba(231,106,106,.22);border-radius:14px;background:rgba(231,106,106,.06);color:#F0A0A0;font-size:12px}
    .workspace-loading{min-height:320px;display:grid;place-items:center;padding:42px 28px;text-align:center;border:1px solid rgba(255,255,255,.065);border-radius:16px;background:linear-gradient(145deg,rgba(12,23,39,.96),rgba(7,15,27,.98));box-sizing:border-box}.workspace-loading-inner{width:min(620px,100%)}.workspace-loading-logo{position:relative;width:52px;height:52px;margin:0 auto 18px;border-radius:16px;background:linear-gradient(135deg,#0fa7a0,#6de0d7);box-shadow:0 0 0 8px rgba(15,167,160,.08),0 16px 40px rgba(15,167,160,.10)}.workspace-loading-logo:before,.workspace-loading-logo:after{content:"";position:absolute;inset:10px;border:2px solid rgba(255,255,255,.65);border-radius:50%}.workspace-loading-logo:after{inset:15px;border-color:rgba(255,255,255,.25)}.workspace-loading-kicker{color:#54D0C8;font-size:9px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.workspace-loading-title{margin-top:7px;color:#DCE6F0;font-size:19px;font-weight:800;letter-spacing:-.025em}.workspace-loading-copy{margin-top:6px;color:#8190A5;font-size:11px}.workspace-loading-bar{position:relative;height:7px;margin:24px auto 0;max-width:520px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.045)}.workspace-loading-bar:after{content:"";position:absolute;inset:0 auto 0 -42%;width:42%;border-radius:inherit;background:linear-gradient(90deg,transparent,#6DE0D7,transparent);animation:workspace-loading-slide 1.25s ease-in-out infinite}.workspace-loading-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:18px}.workspace-loading-step{padding:11px 8px;border:1px solid rgba(255,255,255,.055);border-radius:10px;background:rgba(255,255,255,.018);color:#65748A;font-size:9px}.workspace-loading-step.active{border-color:rgba(15,167,160,.22);background:rgba(15,167,160,.055);color:#7DDDD6}.workspace-loading-status{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:16px;color:#97A5B7;font-size:10px}.workspace-loading-dot{width:7px;height:7px;border-radius:50%;background:#0FA7A0;box-shadow:0 0 0 4px rgba(15,167,160,.08);animation:workspace-loading-pulse 1.35s ease-in-out infinite}.workspace-loading-note{margin-top:7px;color:#5F6E82;font-size:9px}@keyframes workspace-loading-slide{0%{transform:translateX(0)}100%{transform:translateX(430%)}}@keyframes workspace-loading-pulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}
    .incident-panel{margin-top:15px}.incident-count{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;border:1px solid rgba(236,151,79,.25);background:rgba(236,151,79,.07);color:#F2B27C;font-size:10px;font-weight:850}.incident-list{display:grid;gap:9px;margin-top:14px}.incident-item{padding:14px;border:1px solid rgba(236,151,79,.16);border-radius:12px;background:rgba(236,151,79,.035)}.incident-item-blurred{position:relative;min-height:112px;overflow:hidden}.incident-blur-content{filter:blur(6px);opacity:.55;user-select:none;pointer-events:none}.incident-lock-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center;background:rgba(7,15,27,.72)}.incident-lock-overlay strong{color:#E2E8F0;font-size:12px}.incident-lock-overlay span{color:#91A1B4;font-size:10px}.incident-lock-overlay .quality-action{margin-top:4px}.incident-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.incident-title{font-size:12px;font-weight:850;color:#E2E8F0}.incident-message{margin-top:4px;color:#97A4B6;font-size:11px;line-height:1.5}.incident-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.incident-chip{padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.04);color:#8190A5;font-size:9px}.incident-severity{padding:4px 7px;border-radius:7px;background:rgba(231,106,106,.10);color:#F4A0A0;font-size:9px;font-weight:850;text-transform:uppercase}.incident-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.incident-btn{display:inline-flex;padding:8px 10px;border:1px solid var(--cr-border);border-radius:8px;background:rgba(255,255,255,.03);color:#D5DEE9;font-size:10px;font-weight:800;cursor:pointer}.incident-btn.primary{background:var(--cr-primary);color:#fff;border-color:transparent}.incident-editor{margin-top:11px;padding:13px;border:1px solid rgba(15,167,160,.22);border-radius:10px;background:rgba(15,167,160,.045)}.incident-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.incident-field{display:grid;gap:5px}.incident-field.full{grid-column:1 / -1}.incident-field label{color:#7F8DA3;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.incident-field input,.incident-field select{width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--cr-border);border-radius:8px;background:#0B1422;color:#DDE6EF;font-size:11px}.incident-help{margin-top:9px;color:#728198;font-size:10px;line-height:1.5}.incident-empty{padding:18px;border:1px dashed var(--cr-border);border-radius:11px;color:#7D8BA0;font-size:11px;text-align:center}
    @media (max-width:900px){.renta-stat-grid,.renta-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fiscal-grid{grid-template-columns:1fr}.fiscal-tech{grid-column:auto}.renta-framework-grid{grid-template-columns:1fr}.renta-hero{align-items:flex-start;flex-direction:column}.incident-form{grid-template-columns:1fr 1fr}.workspace-loading{min-height:280px;padding:32px 20px}.workspace-loading-steps{grid-template-columns:1fr}}
    @media (max-width:560px){.renta-stat-grid,.renta-summary-grid,.fiscal-impact,.incident-form{grid-template-columns:1fr}.panel-card{padding:17px}.workspace-loading{min-height:250px}.workspace-loading-title{font-size:17px}}
  `}</style>;
}

function loadOverrides(userId: string): Record<string, ReviewOverride> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(`coinrenta-review-overrides:${userId}`) || '{}') as Record<string, ReviewOverride>; } catch { return {}; }
}
function saveOverrides(userId: string, value: Record<string, ReviewOverride>) { try { window.localStorage.setItem(`coinrenta-review-overrides:${userId}`, JSON.stringify(value)); } catch {} }

export default function LocalWorkspace({ userId, connections, mode, isPro, plan = isPro ? 'pro' : 'free', displayName, year = new Date().getFullYear() }: Props) {
  const [datasets, setDatasets] = useState<LocalDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(true);
  const [loadStage, setLoadStage] = useState('Cargando histórico fiscal');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FifoReport | null>(null);
  const [overrides, setOverrides] = useState<Record<string, ReviewOverride>>({});

  useEffect(() => { setOverrides(loadOverrides(userId)); }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null); setLoadStage('Cargando histórico fiscal');
      try {
        const loaded: LocalDataset[] = [];
        const activeConnections = connections.filter((item) => item.provider_type === 'csv' && item.status === 'active');
        for (const connection of activeConnections) {
          if (!cancelled) setLoadStage(`Leyendo ${connection.exchangeName || connection.exchange || 'fuente fiscal'}…`);
          const dataset = await fetchConnectionDataset(userId, connection.id, `force-refresh-${connection.last_sync_at || 'none'}`);
          if (!dataset.movements.length) throw new Error('La fuente CSV no ha devuelto movimientos normalizados.');
          loaded.push(dataset);
        }
        if (!cancelled) setDatasets(loaded);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos fiscales.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [connections, userId]);

  const movements = useMemo(() => mergeDatasets(datasets).map(fiscalizeMovement).map((movement) => {
    const override = overrides[movement.id];
    if (!override) return movement;
    const next = { ...movement, ...override };
    delete (next as any).targetMovementId; delete (next as any).note; delete (next as any).resolvedAt;
    return { ...next, classification: 'classified' as const, reviewIssues: [] };
  }), [datasets, overrides]);
  const fifoInput = useMemo(() => datasetToFifo({ version: 9, userId, connectionId: 'merged', sourceVersion: datasets.map((item) => item.sourceVersion).join('|'), fetchedAt: new Date().toISOString(), exchange: 'combined', movements }), [datasets, movements, userId]);

  useEffect(() => {
    let cancelled = false;
    setCalculating(true);
    if (!fifoInput.txs.length) { setReport(null); setCalculating(false); return; }
    setLoadStage('Calculando FIFO y comprobando operaciones');
    void calculateFifo(fifoInput.txs, year, fifoInput.assets).then((value) => { if (!cancelled) { setReport(value); setCalculating(false); } }).catch((cause) => { if (!cancelled) { setCalculating(false); setError(cause instanceof Error ? cause.message : 'No se pudo calcular el informe fiscal.'); } });
    return () => { cancelled = true; };
  }, [fifoInput, year]);

  const connectionCount = connections.length;
  if (loading || calculating) return <><WorkspaceStyles /><main className="dashboard-content workspace-page"><section className="panel-card workspace-loading" aria-busy="true" aria-live="polite"><div className="workspace-loading-inner"><div className="workspace-loading-logo" aria-hidden="true"/><div className="workspace-loading-kicker">COINRENTA · CONTROL FISCAL</div><div className="workspace-loading-title">Preparando tus datos fiscales</div><div className="workspace-loading-copy">Estamos cargando el histórico completo y verificando que las operaciones estén listas para el cálculo.</div><div className="workspace-loading-bar" aria-hidden="true"/><div className="workspace-loading-steps"><div className={`workspace-loading-step ${loadStage.includes('Cargando') || loadStage.includes('Leyendo') ? 'active' : ''}`}>1 · Histórico</div><div className={`workspace-loading-step ${loadStage.includes('Calculando') ? 'active' : ''}`}>2 · Comprobación</div><div className={`workspace-loading-step ${loadStage.includes('Calculando') && report ? 'active' : ''}`}>3 · Resultado</div></div><div className="workspace-loading-status"><span className="workspace-loading-dot"/>{loadStage}</div><div className="workspace-loading-note">No cierres la página mientras terminamos de preparar el ejercicio.</div></div></section></main></>;
  if (error) return <><WorkspaceStyles /><main className="dashboard-content workspace-page"><section className="panel-card"><div className="connection-error">{error}<div style={{ marginTop: 10 }}><Link href="/dashboard/exchanges">Revisar conexiones</Link></div></div></section></main></>;
  return <><WorkspaceStyles />{mode === 'movimientos' ? <Movements movements={movements} isPro={isPro} /> : mode === 'fiscalidad' ? <Fiscality report={report} year={year} /> : mode === 'resumen' ? <Summary report={report} movements={movements} displayName={displayName} connectionCount={connectionCount} /> : <Renta report={report} year={year} isPro={isPro} plan={plan} movements={movements} overrides={overrides} userId={userId} onSaveOverride={(override) => { const next = { ...overrides, [override.targetMovementId]: override }; setOverrides(next); saveOverrides(userId, next); }} onRemoveOverride={(id) => { const next = { ...overrides }; delete next[id]; setOverrides(next); saveOverrides(userId, next); }} />}</>;
}

function buildIncidents(movements: LocalMovement[], report: FifoReport | null, year: number): Incident[] {
  const incidents: Incident[] = [];
  for (const movement of movements) {
    for (const issue of movement.reviewIssues || []) {
      if (issue.severity === 'info') continue;
      incidents.push({ id: `${movement.id}:parser:${issue.code}`, movementId: movement.id, occurredAt: movement.occurredAt, title: issue.message, message: issue.hint || 'Revisa este movimiento antes de cerrar el ejercicio.', severity: issue.severity, hint: issue.hint, kind: 'parser', issue });
    }
  }
  for (const sale of report?.qualitySales || []) {
    if (!sale.occurredAt || new Date(sale.occurredAt).getUTCFullYear() !== year) continue;
    incidents.push({ id: `${sale.id}:fifo`, movementId: sale.id.includes(':fee') ? sale.id.split(':fee')[0] : sale.id, occurredAt: sale.occurredAt, title: `Incidencia FIFO · ${sale.symbol}`, message: sale.reason, severity: 'blocking', kind: 'fifo' });
  }
  if (report?.pendingTransfers) incidents.push({ id: `pending:${year}`, movementId: null, occurredAt: null, title: 'Transferencias pendientes de cuadrar', message: `${report.pendingTransfers} fragmentos de transferencia no han podido enlazarse con una entrada/salida compatible.`, severity: 'blocking', kind: 'system' });
  if (report?.valuationIssues) incidents.push({ id: `valuation:${year}`, movementId: null, occurredAt: null, title: 'Operaciones sin valoración fiscal', message: `${report.valuationIssues} operaciones del ejercicio no tienen una valoración EUR suficientemente demostrable.`, severity: 'blocking', kind: 'system' });
  return incidents;
}

function Renta({ report, year, isPro, plan, movements, overrides, userId, onSaveOverride, onRemoveOverride }: { report: FifoReport | null; year: number; isPro: boolean; plan: Plan; movements: LocalMovement[]; overrides: Record<string, ReviewOverride>; userId: string; onSaveOverride: (override: ReviewOverride) => void; onRemoveOverride: (id: string) => void }) {
  const actionable = buildIncidents(movements, report, year).filter((item) => !overrides[item.movementId || '']).length;
  const currentYear = new Date().getFullYear(); const firstFiscalYear = 2018;
  const years = Array.from({ length: currentYear - firstFiscalYear + 1 }, (_, index) => currentYear - index);
  return <main className="dashboard-content workspace-page renta-page">
    <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Renta</h1><p className="workspace-subtitle">El cálculo fiscal se ejecuta sobre el histórico completo.</p></div></header>
    <section className="renta-hero panel-card"><div><span className="section-kicker">EJERCICIO FISCAL</span><h2>Informe fiscal {year}</h2><p>Cambio de ejercicio sobre el mismo histórico completo.</p></div><nav className="renta-year-switcher" aria-label="Ejercicio fiscal">{years.map((item)=><Link key={item} href={item===currentYear?'/dashboard/renta':`/dashboard/renta?year=${item}`} className={item===year?'selected':''}>{item}</Link>)}</nav></section>
    <section className="renta-stat-grid"><article className="stat-card"><span className="stat-label">Ganancia / pérdida</span><strong className={report && !report.gainKnown?'renta-number-warning':''}>{isPro?money(report?.gain):'Pro'}</strong><span className="stat-note">{isPro?(report?.gainKnown?'FIFO completo':'Resultado provisional'):'Resultado fiscal detallado disponible en Pro.'}</span></article><article className="stat-card"><span className="stat-label">Valor de transmisión</span><strong>{money(report?.proceeds)}</strong><span className="stat-note">Ventas y permutas</span></article><article className="stat-card"><span className="stat-label">Coste FIFO</span><strong>{money(report?.costBasis)}</strong><span className="stat-note">Lotes históricos</span></article><article className="stat-card"><span className="stat-label">Incidencias</span><strong>{actionable}</strong><span className="stat-note">Requieren revisión</span></article></section>
    <section className="renta-section panel-card"><div className="panel-head"><h3>Ganancias y pérdidas patrimoniales</h3><span className="renta-badge">EUR · FIFO</span></div><div className="renta-summary-grid"><div><small>Transmisiones / permutas</small><strong>{report?.disposals ?? 0}</strong></div><div><small>Ganancia calculada</small><strong>{isPro?money(report?.gain):'Pro'}</strong></div><div><small>Ingresos identificados</small><strong>{money(report?.incomeEur)}</strong></div><div><small>Comisiones fiat</small><strong>{money(report?.feesEur)}</strong></div></div></section>
    <IncidentPanel year={year} movements={movements} report={report} plan={plan} overrides={overrides} userId={userId} onSaveOverride={onSaveOverride} onRemoveOverride={onRemoveOverride} />
  </main>;
}

function IncidentPanel({ year, movements, report, plan, overrides, userId, onSaveOverride, onRemoveOverride }: { year: number; movements: LocalMovement[]; report: FifoReport | null; plan: Plan; overrides: Record<string, ReviewOverride>; userId: string; onSaveOverride: (override: ReviewOverride) => void; onRemoveOverride: (id: string) => void }) {
  const incidents = buildIncidents(movements, report, year);
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string>('');
  const [type, setType] = useState('sell');
  const [asset, setAsset] = useState(''); const [amount, setAmount] = useState(''); const [quoteAsset, setQuoteAsset] = useState(''); const [quoteAmount, setQuoteAmount] = useState(''); const [price, setPrice] = useState(''); const [priceCurrency, setPriceCurrency] = useState('EUR'); const [note, setNote] = useState('');
  const visible = incidents.filter((incident) => !overrides[incident.movementId || '']);
  const isProPlan = plan === 'pro' || plan === 'admin';
  const isEssentialPlan = plan === 'essential';

  function openEditor(incident: Incident) {
    const target = movements.find((movement) => movement.id === incident.movementId) || movements.find((movement) => movement.classification === 'needs_review') || movements[0];
    setEditing(incident.id); setSelectedMovementId(target?.id || ''); setType(target?.transactionType || 'sell'); setAsset(target?.baseAsset || ''); setAmount(target?.baseAmount == null ? '' : String(Math.abs(target.baseAmount))); setQuoteAsset(target?.quoteAsset || ''); setQuoteAmount(target?.quoteAmount == null ? '' : String(Math.abs(target.quoteAmount))); setPrice(target?.price == null ? '' : String(target.price)); setPriceCurrency(target?.priceCurrency || 'EUR'); setNote(incident.message);
  }

  function save() {
    if (!selectedMovementId) return;
    const numeric = (value: string) => value.trim() === '' ? null : Number(value.replace(',', '.'));
    const dir = type === 'sell' || type === 'withdrawal' || type === 'transfer_out' ? -1 : 1;
    onSaveOverride({ targetMovementId: selectedMovementId, transactionType: type, baseAsset: asset.trim().toUpperCase() || null, baseAmount: numeric(amount) == null ? null : dir * Math.abs(numeric(amount) as number), quoteAsset: quoteAsset.trim().toUpperCase() || null, quoteAmount: numeric(quoteAmount) == null ? null : (type === 'buy' ? -1 : 1) * Math.abs(numeric(quoteAmount) as number), price: numeric(price), priceCurrency: priceCurrency.trim().toUpperCase() || 'EUR', note, resolvedAt: new Date().toISOString() });
    setEditing(null);
  }

  return <section className="panel-card incident-panel">
    <div className="panel-head">
      <div><span className="section-kicker">CONTROL DE CALIDAD</span><h3>Incidencias fiscales</h3></div>
      <span className="incident-count">{visible.length} pendientes</span>
    </div>
    <p className="workspace-subtitle">El parser identifica anomalías antes del cálculo FIFO. La información disponible depende de tu plan.</p>

    {visible.length === 0
      ? <div className="incident-empty" style={{ marginTop: 12 }}>No hay incidencias pendientes para este ejercicio. Las operaciones ya pueden entrar en el cálculo con los datos normalizados.</div>
      : <div className="incident-list">
          {visible.map((incident) => {
            const movement = incident.movementId ? movements.find((item) => item.id === incident.movementId) : null;

            if (!isProPlan && !isEssentialPlan) {
              return <article className="incident-item incident-item-blurred" key={incident.id}>
                <div className="incident-blur-content" aria-hidden="true">
                  <div className="incident-title">Incidencia fiscal detectada</div>
                  <div className="incident-message">Información de la incidencia y operaciones afectadas</div>
                  <div className="incident-meta"><span className="incident-chip">Fecha · operación · activo</span><span className="incident-chip">Detalles fiscales</span></div>
                </div>
                <div className="incident-lock-overlay">
                  <strong>Detalles bloqueados</strong>
                  <span>Consulta los detalles con el plan Pro.</span>
                  <Link className="quality-action primary" href="/dashboard/suscripcion">Ver Pro</Link>
                </div>
              </article>;
            }

            if (isEssentialPlan) {
              return <article className="incident-item" key={incident.id}>
                <div className="incident-head">
                  <div><div className="incident-title">{incident.title}</div><div className="incident-message">Se ha detectado una incidencia que requiere revisión.</div></div>
                  <span className="incident-severity">{incident.severity === 'blocking' ? 'Bloqueante' : 'Revisión'}</span>
                </div>
                <div className="incident-meta">
                  <span className="incident-chip">Tipo: {incident.kind}</span>
                  <span className="incident-chip">Detalle de operaciones disponible en Pro</span>
                </div>
                <div className="incident-actions">
                  <Link className="incident-btn primary" href="/dashboard/suscripcion">Ver Pro para revisar</Link>
                </div>
              </article>;
            }

            return <article className="incident-item" key={incident.id}>
              <div className="incident-head">
                <div><div className="incident-title">{incident.title}</div><div className="incident-message">{incident.message}</div></div>
                <span className="incident-severity">{incident.severity === 'blocking' ? 'Bloqueante' : 'Revisión'}</span>
              </div>
              <div className="incident-meta">
                {movement && <span className="incident-chip">{date(movement.occurredAt)} · {movement.transactionType} · {movement.baseAsset || 'sin activo'} · {qty(movement.baseAmount)}</span>}
                {movement && <span className="incident-chip">Origen: {movement.originalType || 'desconocido'}</span>}
                <span className="incident-chip">{incident.kind}</span>
              </div>
              <div className="incident-actions">
                <button type="button" className="incident-btn primary" onClick={() => openEditor(incident)}>Revisar / corregir</button>
                {movement && <Link className="incident-btn" href="#historico">Ir al movimiento</Link>}
              </div>

              {editing === incident.id && <div className="incident-editor">
                <div className="incident-form">
                  <div className="incident-field full"><label>Movimiento al que corresponde</label><select value={selectedMovementId} onChange={(event) => setSelectedMovementId(event.target.value)}>{movements.map((item) => <option key={item.id} value={item.id}>{date(item.occurredAt)} · {item.transactionType} · {item.baseAsset || '—'} · {qty(item.baseAmount)}</option>)}</select></div>
                  <div className="incident-field"><label>Tipo fiscal</label><select value={type} onChange={(event) => setType(event.target.value)}>{['buy','sell','trade','deposit','withdrawal','transfer_in','transfer_out','reward','interest','airdrop','cashback','income','expense','fee','other'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                  <div className="incident-field"><label>Activo</label><input value={asset} onChange={(event) => setAsset(event.target.value)} placeholder="BTC" /></div>
                  <div className="incident-field"><label>Cantidad activo</label><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></div>
                  <div className="incident-field"><label>Contrapartida</label><input value={quoteAsset} onChange={(event) => setQuoteAsset(event.target.value)} placeholder="EUR / USDT" /></div>
                  <div className="incident-field"><label>Cantidad contrapartida</label><input value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></div>
                  <div className="incident-field"><label>Precio unitario</label><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="0,00" /></div>
                  <div className="incident-field"><label>Divisa precio</label><input value={priceCurrency} onChange={(event) => setPriceCurrency(event.target.value)} placeholder="EUR" /></div>
                  <div className="incident-field full"><label>Nota</label><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Qué se ha corregido y por qué" /></div>
                </div>
                <div className="incident-actions">
                  <button type="button" className="incident-btn primary" onClick={save}>Guardar corrección</button>
                  <button type="button" className="incident-btn" onClick={() => setEditing(null)}>Cancelar</button>
                  {incident.movementId && overrides[incident.movementId] && <button type="button" className="incident-btn" onClick={() => onRemoveOverride(incident.movementId as string)}>Quitar corrección</button>}
                </div>
                <div className="incident-help">La corrección se almacena localmente y se aplica al recálculo FIFO. No modifica el CSV original.</div>
              </div>}
            </article>;
          })}
        </div>}

    {isEssentialPlan && visible.length > 0 && <div className="incident-help">El plan Esencial muestra una vista general de las incidencias. Para consultar la operación concreta, los datos afectados y corregirla, necesitas Pro.</div>}
    {!isProPlan && !isEssentialPlan && visible.length > 0 && <div className="incident-help">Las incidencias detectadas se muestran de forma protegida. El detalle está disponible en Pro.</div>}
  </section>;
}

function Movements({ movements, isPro }: { movements: LocalMovement[]; isPro: boolean }) { return <main className="dashboard-content workspace-page"><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Movimientos</h1><p className="workspace-subtitle">{movements.length.toLocaleString('es-ES')} movimientos disponibles desde el histórico local.</p></div></header><section id="historico" className="panel-card"><div className="panel-head"><div><span className="section-kicker">HISTÓRICO</span><h3>Movimientos normalizados</h3></div></div>{movements.length?<div className="table-wrap"><table className="workspace-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th>Cantidad</th><th>Contrapartida</th><th>Fee</th><th>Origen</th></tr></thead><tbody>{movements.slice().reverse().map((movement)=><tr key={movement.id}><td>{date(movement.occurredAt)}</td><td><span className="movement-type">{movement.transactionType}</span>{movement.originalType&&<small className="table-subtext">Origen: {movement.originalType}</small>}</td><td><strong>{movement.baseAsset||'—'}</strong></td><td>{isPro?`${qty(movement.baseAmount)} ${movement.baseAsset||''}`:'***'}</td><td>{isPro?`${qty(movement.quoteAmount)} ${movement.quoteAsset||movement.priceCurrency||''}`:'***'}</td><td>{isPro?`${qty(movement.feeAmount)} ${movement.feeAsset||''}`:'***'}</td><td>{movement.exchange}</td></tr>)}</tbody></table></div>:<div className="renta-empty">No hay movimientos en el histórico.</div>}</section></main>; }

function Fiscality({ report, year }: { report: FifoReport | null; year: number }) { return <main className="dashboard-content workspace-page"><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Fiscalidad</h1><p className="workspace-subtitle">Resumen fiscal calculado directamente desde el histórico completo.</p></div></header><section className="stat-grid fiscality-stat-grid"><article className="stat-card"><span className="stat-label">Ejercicio</span><strong>{year}</strong></article><article className="stat-card stat-card-accent"><span className="stat-label">Resultado</span><strong>{money(report?.gain)}</strong></article><article className="stat-card"><span className="stat-label">Coste FIFO</span><strong>{money(report?.costBasis)}</strong></article><article className="stat-card"><span className="stat-label">Transmisiones</span><strong>{report?.disposals ?? 0}</strong></article></section><div className="panel-card fiscality-section"><div className="panel-head"><div><span className="section-kicker">ESTADO</span><h3>Cálculo local</h3></div></div><div className="data-list"><div className="data-row"><div><strong>FIFO</strong><span>Histórico completo hasta el ejercicio seleccionado</span></div><span className="status-pill">Activo</span></div><div className="data-row"><div><strong>Datos fiscales</strong><span>Calculados en el dispositivo sobre la fuente CSV.</span></div><span className="status-pill">Local</span></div></div></div></main>; }

function Summary({ report, movements, displayName, connectionCount }: { report: FifoReport | null; movements: LocalMovement[]; displayName?: string | null; connectionCount: number }) { const current = new Map<string, number>(); for (const movement of movements) { if (!movement.baseAsset || movement.baseAmount == null || isFiat(movement.baseAsset)) continue; current.set(movement.baseAsset, (current.get(movement.baseAsset)||0)+movement.baseAmount); if (movement.quoteAsset&&movement.quoteAmount!=null&&!isFiat(movement.quoteAsset)) current.set(movement.quoteAsset,(current.get(movement.quoteAsset)||0)+movement.quoteAmount); } const nonZero=[...current.entries()].filter(([,value])=>Math.abs(value)>1e-10).length; return <main className="dashboard-content workspace-page"><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Centro de Mando Fiscal</h1><p className="workspace-subtitle">{displayName?`Hola, ${displayName}.`:'Tus datos fiscales están disponibles en este dispositivo.'}</p></div></header><section className="fiscal-grid"><div className="fiscal-card fiscal-card-pad"><div className="fiscal-card-head"><div><span className="fiscal-kicker">FISCAL</span><h2>Actividad registrada</h2></div><span className="fiscal-badge">HISTÓRICO</span></div><div className="fiscal-impact"><div className="fiscal-impact-box"><span className="fiscal-impact-label">Ganancia / pérdida</span><strong className="fiscal-impact-value">{money(report?.gain)}</strong></div><div className="fiscal-impact-box"><span className="fiscal-impact-label">Transmisiones</span><strong className="fiscal-impact-value">{report?.disposals ?? 0}</strong></div></div><div className="fiscal-foot"><span className="fiscal-dot"/>Cálculo realizado en el navegador</div></div><div className="fiscal-card fiscal-card-pad"><div className="fiscal-card-head"><div><span className="fiscal-kicker">DATOS</span><h3>Estado local</h3></div></div><div className="renta-summary-grid"><div><small>Conexiones</small><strong>{connectionCount}</strong></div><div><small>Movimientos</small><strong>{movements.length}</strong></div><div><small>Activos con saldo</small><strong>{nonZero}</strong></div><div><small>Servidor</small><strong>Fuentes</strong></div></div></div><div className="fiscal-card fiscal-card-pad fiscal-tech"><div className="fiscal-card-head"><div><span className="fiscal-kicker">PRIVACIDAD</span><h3>Qué se queda en cada sitio</h3></div></div><div className="renta-framework-grid"><div><strong>Servidor</strong><span>Conexiones, metadatos, CSV originales y credenciales API protegidas.</span></div><div><strong>Dispositivo</strong><span>Movimientos normalizados, lotes FIFO, saldos, incidencias y resultados fiscales.</span></div><div><strong>Borrado</strong><span>Eliminar una conexión elimina su fuente del servidor y su caché asociada en este dispositivo.</span></div></div></div></section></main>; }
