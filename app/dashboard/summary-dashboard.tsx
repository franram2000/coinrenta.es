'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { calculateFifo, type FifoReport } from '@/lib/tax/fifo';
import { datasetToFifo, fetchConnectionDataset, mergeDatasets, type LocalDataset, type LocalMovement } from '@/lib/client/local-cache';

export type SummaryConnection = { id: string; exchangeName: string; label: string | null; status: string | null; lastSyncAt: string | null };

type Props = {
  userId: string;
  connections: SummaryConnection[];
  displayName?: string | null;
  plan: 'free' | 'essential' | 'pro' | 'admin';
};

const FIAT = new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']);

function money(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

function qty(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: 6 });
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '');
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function fiscalizeMovement(movement: LocalMovement): LocalMovement {
  const original = String(movement.originalType || '').trim().toLowerCase();
  let type = String(movement.transactionType || '').trim().toLowerCase();
  if (/^sell$|^sold$|^sale$|^venta$|^vendido$/.test(original)) type = 'sell';
  else if (/^buy$|^bought$|^purchase$|^purchased$|^compra$|^comprado$/.test(original)) type = 'buy';
  else if (/transfer\s*\(?stake\)?|stake\s+transfer|staking\s+allocation/.test(original)) type = 'transfer_in';
  else if (/transfer\s*\(?unstake\)?|unstake\s+transfer|staking\s+deallocation/.test(original)) type = 'transfer_out';
  else if (/^deposit$|^receive$|^received$|^deposito$/.test(original)) type = 'deposit';
  else if (/^withdrawal$|^withdraw$|^retirada$/.test(original)) type = 'withdrawal';
  else if (/^reward$|^bonus$|^airdrop$/.test(original)) type = 'reward';
  return { ...movement, transactionType: type || 'other' };
}

function riskCopy(report: FifoReport | null) {
  if (!report) return { label: 'Preparando', tone: 'neutral', text: 'Estamos calculando el ejercicio sobre el histórico completo.' };
  const blockers = (report.pendingTransfers || 0) + (report.valuationIssues || 0) + (report.unknownDisposals || 0);
  if (blockers === 0 && report.qualitySales.length === 0) return { label: 'Todo en orden', tone: 'good', text: 'No se han detectado bloqueos fiscales en el ejercicio calculado.' };
  if (blockers <= 2) return { label: 'Revisión necesaria', tone: 'warn', text: 'Hay algunos puntos concretos que conviene revisar antes de usar el resultado.' };
  return { label: 'Atención', tone: 'bad', text: 'Hay operaciones con información pendiente o valoración no demostrable.' };
}

function SummaryStyles() {
  return <style jsx global>{`
    .summary-page{width:100%;max-width:1240px;padding:0 0 44px}.summary-bg{position:fixed;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(circle at 78% 7%,rgba(15,167,160,.11),transparent 28%),radial-gradient(circle at 15% 35%,rgba(67,96,155,.08),transparent 24%)}
    .summary-top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:18px}.summary-eyebrow{display:inline-flex;align-items:center;gap:8px;color:#6DE0D7;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.summary-live{width:7px;height:7px;border-radius:50%;background:#32B57A;box-shadow:0 0 0 5px rgba(50,181,122,.1)}.summary-top h1{margin:7px 0 0;font-size:clamp(30px,4vw,44px);letter-spacing:-.055em;line-height:1.02}.summary-top p{margin:8px 0 0;color:#8391A5;font-size:12px}.summary-top-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.summary-top-link{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;border:1px solid var(--cr-border);border-radius:11px;background:rgba(255,255,255,.025);color:#C5D0DD;font-size:10px;font-weight:850}.summary-top-link.primary{border-color:rgba(15,167,160,.3);background:rgba(15,167,160,.09);color:#78DED5}
    .summary-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.2fr .8fr;gap:18px;padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:linear-gradient(145deg,rgba(17,29,49,.96),rgba(8,17,30,.98));box-shadow:0 28px 80px rgba(0,0,0,.28);margin-bottom:14px}.summary-hero:before{content:"";position:absolute;width:360px;height:360px;right:-120px;top:-170px;border-radius:50%;background:rgba(15,167,160,.17);filter:blur(35px);pointer-events:none}.summary-hero-main,.summary-hero-side{position:relative;z-index:1}.summary-kicker{color:#5FD6CE;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.summary-hero h2{margin:8px 0 0;font-size:26px;letter-spacing:-.045em}.summary-hero-copy{max-width:650px;margin:8px 0 0;color:#8D9AAF;font-size:12px;line-height:1.7}.summary-result{display:flex;align-items:flex-end;gap:13px;margin-top:22px}.summary-result-value{font-size:clamp(34px,5vw,56px);font-weight:900;letter-spacing:-.065em;line-height:.95}.summary-result-label{padding-bottom:4px;color:#718097;font-size:10px;font-weight:750}.summary-hero-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:17px}.summary-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border-radius:9px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);color:#93A0B3;font-size:9px;font-weight:800}.summary-chip strong{color:#D6DEE8}.summary-hero-side{display:flex;align-items:stretch}.summary-status{width:100%;padding:18px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}.summary-status-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.summary-status-title{font-size:12px;font-weight:900;color:#DFE7EF}.summary-status-badge{padding:6px 8px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.summary-status-badge.good{background:rgba(50,181,122,.11);color:#76D7AA}.summary-status-badge.warn{background:rgba(229,175,59,.12);color:#EBC979}.summary-status-badge.bad{background:rgba(231,106,106,.11);color:#F0A1A1}.summary-status-badge.neutral{background:rgba(255,255,255,.05);color:#9AA7B9}.summary-status p{margin:12px 0 0;color:#8290A4;font-size:10px;line-height:1.6}.summary-status-line{height:7px;margin-top:18px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.045)}.summary-status-line span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#0FA7A0,#6DE0D7)}.summary-status-note{display:flex;justify-content:space-between;gap:10px;margin-top:8px;color:#67758A;font-size:9px}
    .summary-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.summary-kpi{min-width:0;padding:15px;border:1px solid var(--cr-border);border-radius:15px;background:rgba(255,255,255,.02);box-shadow:0 12px 28px rgba(0,0,0,.1)}.summary-kpi-label{display:block;color:#748298;font-size:9px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.summary-kpi-value{display:block;margin-top:8px;font-size:21px;font-weight:900;letter-spacing:-.04em}.summary-kpi-note{display:block;margin-top:4px;color:#67758A;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.summary-kpi.accent{border-color:rgba(15,167,160,.2);background:linear-gradient(145deg,rgba(15,167,160,.075),rgba(255,255,255,.018))}.summary-kpi.accent .summary-kpi-value{color:#74DDD5}
    .summary-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.summary-panel{border:1px solid var(--cr-border);border-radius:18px;background:rgba(13,21,36,.78);box-shadow:0 14px 34px rgba(0,0,0,.13);overflow:hidden}.summary-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:18px 19px 0}.summary-panel-kicker{color:#54D0C8;font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.summary-panel h3{margin:5px 0 0;font-size:16px;letter-spacing:-.03em}.summary-panel-copy{margin:4px 0 0;color:#748197;font-size:10px}.summary-head-link{padding:7px 9px;border:1px solid var(--cr-border);border-radius:8px;color:#86D8D2;font-size:9px;font-weight:850}.summary-chart{height:184px;display:flex;align-items:stretch;gap:8px;padding:18px 19px 22px}.summary-month{position:relative;display:flex;flex:1;flex-direction:column;justify-content:flex-end;min-width:0}.summary-month-bar-wrap{height:126px;display:flex;align-items:flex-end;justify-content:center}.summary-month-bar{width:min(26px,74%);min-height:5px;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#6DE0D7,#0FA7A0);box-shadow:0 8px 22px rgba(15,167,160,.12)}.summary-month-label{margin-top:8px;text-align:center;color:#66748A;font-size:8px;font-weight:800}.summary-month-count{margin-bottom:6px;text-align:center;color:#8190A4;font-size:8px}.summary-chart-note{padding:0 19px 17px;color:#5F6E82;font-size:9px}.summary-side-stack{display:grid;gap:10px}.summary-mini{padding:16px 17px}.summary-mini-row{display:flex;justify-content:space-between;gap:15px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}.summary-mini-row:first-child{border-top:0;padding-top:0}.summary-mini-row:last-child{padding-bottom:0}.summary-mini-row span{color:#77859A;font-size:10px}.summary-mini-row strong{font-size:11px;text-align:right}.summary-tag{display:inline-flex;align-items:center;padding:5px 7px;border-radius:7px;background:rgba(255,255,255,.035);color:#8E9CB0;font-size:8px;font-weight:850;text-transform:uppercase}.summary-progress{margin-top:10px;height:8px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.045)}.summary-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#0FA7A0,#6DE0D7)}
    .summary-table{width:100%;border-collapse:collapse;margin-top:5px}.summary-table th{padding:11px 18px;text-align:left;color:#6F7D92;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid rgba(255,255,255,.06)}.summary-table td{padding:12px 18px;color:#CFD8E2;font-size:10px;border-bottom:1px solid rgba(255,255,255,.045)}.summary-table tr:last-child td{border-bottom:0}.summary-table td strong{display:block;font-size:10px}.summary-table td span{display:block;margin-top:3px;color:#67758A;font-size:8px}.summary-type{display:inline-flex;padding:5px 7px;border-radius:7px;background:rgba(15,167,160,.08);color:#70D9D2;font-size:8px;font-weight:900}.summary-table-right{text-align:right}.summary-empty{padding:32px 20px;text-align:center;color:#728096;font-size:10px}
    .summary-alerts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px}.summary-alert{min-width:0;padding:13px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.018)}.summary-alert-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.summary-alert-icon{width:27px;height:27px;display:grid;place-items:center;border-radius:9px;background:rgba(15,167,160,.09);color:#6DE0D7;font-size:12px}.summary-alert strong{font-size:10px}.summary-alert span{display:block;margin-top:7px;color:#77859A;font-size:9px;line-height:1.55}.summary-alert.danger{border-color:rgba(231,106,106,.14)}.summary-alert.danger .summary-alert-icon{background:rgba(231,106,106,.09);color:#F0A1A1}.summary-alert.warn{border-color:rgba(229,175,59,.14)}.summary-alert.warn .summary-alert-icon{background:rgba(229,175,59,.09);color:#EDC76D}
    .summary-privacy{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:16px 18px}.summary-privacy-icon{width:31px;height:31px;display:grid;place-items:center;flex:0 0 auto;border-radius:10px;background:rgba(50,181,122,.09);color:#7ADCB0}.summary-privacy-copy strong{display:block;font-size:10px}.summary-privacy-copy span{display:block;margin-top:3px;color:#758298;font-size:9px;line-height:1.55}.summary-plan{padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.045);color:#A3B1C4;font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
    @media (max-width:1050px){.summary-hero,.summary-grid{grid-template-columns:1fr}.summary-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.summary-hero-side{min-height:0}.summary-side-stack{grid-template-columns:1fr 1fr}.summary-alerts{grid-template-columns:1fr 1fr}}
    @media (max-width:700px){.summary-top{align-items:flex-start;flex-direction:column}.summary-top-actions{justify-content:flex-start}.summary-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-grid{grid-template-columns:1fr}.summary-side-stack{grid-template-columns:1fr}.summary-alerts{grid-template-columns:1fr}.summary-hero{padding:18px;border-radius:18px}.summary-hero h2{font-size:22px}.summary-chart{gap:5px}.summary-month-bar{width:min(20px,70%)}.summary-table{min-width:650px}.summary-panel.table-panel{overflow:auto}.summary-privacy{align-items:flex-start;flex-direction:column}}
    @media (max-width:460px){.summary-kpis{grid-template-columns:1fr}.summary-result{align-items:flex-start;flex-direction:column;gap:5px}.summary-result-label{padding-bottom:0}}
  `}</style>;
}

export default function SummaryDashboard({ userId, connections, displayName, plan }: Props) {
  const [movements, setMovements] = useState<LocalMovement[]>([]);
  const [report, setReport] = useState<FifoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(connections.map((connection) => fetchConnectionDataset(userId, connection.id, connection.lastSyncAt || '')))
      .then((datasets) => {
        if (cancelled) return;
        const merged = mergeDatasets(datasets as LocalDataset[]).map(fiscalizeMovement);
        setMovements(merged);
        const input = (datasets as LocalDataset[]).reduce((acc, dataset) => {
          const current = datasetToFifo(dataset);
          acc.txs.push(...current.txs); for (const [id, asset] of current.assets) acc.assets.set(id, asset);
          return acc;
        }, { txs: [] as ReturnType<typeof datasetToFifo>['txs'], assets: new Map<string, ReturnType<typeof datasetToFifo>['assets'] extends Map<string, infer V> ? V : never>() });
        return calculateFifo(input.txs, currentYear, input.assets).then((value) => { if (!cancelled) setReport(value); });
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo preparar el resumen.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connections, currentYear, userId]);

  const nonZeroAssets = useMemo(() => {
    const balances = new Map<string, number>();
    for (const movement of movements) {
      if (movement.baseAsset && movement.baseAmount != null && !FIAT.has(movement.baseAsset.toUpperCase())) balances.set(movement.baseAsset, (balances.get(movement.baseAsset) || 0) + movement.baseAmount);
      if (movement.quoteAsset && movement.quoteAmount != null && !FIAT.has(movement.quoteAsset.toUpperCase())) balances.set(movement.quoteAsset, (balances.get(movement.quoteAsset) || 0) + movement.quoteAmount);
    }
    return [...balances.values()].filter((value) => Math.abs(value) > 1e-10).length;
  }, [movements]);

  const monthly = useMemo(() => {
    const counts = new Array(12).fill(0);
    for (const movement of movements) {
      const at = new Date(movement.occurredAt);
      if (at.getFullYear() === currentYear) counts[at.getMonth()] += 1;
    }
    return counts;
  }, [currentYear, movements]);

  const recent = useMemo(() => movements.slice().sort((a,b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 6), [movements]);
  const status = riskCopy(report);
  const maxMonth = Math.max(1, ...monthly);
  const statusPercent = report ? Math.max(18, Math.min(100, 100 - Math.min(82, ((report.unknownDisposals + report.pendingTransfers + report.valuationIssues) / Math.max(1, report.disposals)) * 100))) : 20;
  const planLabel = plan === 'admin' ? 'Admin' : plan === 'pro' ? 'Pro' : plan === 'essential' ? 'Esencial' : 'Free';
  const yearTransactions = movements.filter((movement) => new Date(movement.occurredAt).getFullYear() === currentYear).length;
  const issueCount = report ? report.qualitySales.length + report.pendingTransfers + report.valuationIssues : 0;

  return <>
    <SummaryStyles />
    <div className="summary-bg" aria-hidden="true" />
    <main className="dashboard-content summary-page">
      <header className="summary-top">
        <div>
          <span className="summary-eyebrow"><i className="summary-live"/> Centro de mando fiscal</span>
          <h1>{displayName ? `Hola, ${displayName}` : 'Tu resumen fiscal'}</h1>
          <p>Todo lo importante de tu histórico CoinRenta, reunido en una sola vista.</p>
        </div>
        <div className="summary-top-actions">
          <span className="summary-plan">Plan {planLabel}</span>
          <Link href="/dashboard/renta" className="summary-top-link">Ver Renta →</Link>
          <Link href="/dashboard/suscripcion" className="summary-top-link primary">Gestionar plan ✦</Link>
        </div>
      </header>

      <section className="summary-hero">
        <div className="summary-hero-main">
          <span className="summary-kicker">Resultado del ejercicio · {currentYear}</span>
          <h2>Tu situación fiscal, a primera vista.</h2>
          <p className="summary-hero-copy">El resultado se calcula localmente sobre el histórico completo disponible. Aquí puedes ver la magnitud del ejercicio, la actividad registrada y los puntos que merecen revisión.</p>
          <div className="summary-result"><strong className="summary-result-value">{loading ? '···' : money(report?.gain)}</strong><span className="summary-result-label">ganancia / pérdida calculada</span></div>
          <div className="summary-hero-meta">
            <span className="summary-chip">Transmisiones <strong>{loading ? '—' : report?.disposals ?? 0}</strong></span>
            <span className="summary-chip">Coste FIFO <strong>{loading ? '—' : money(report?.costBasis)}</strong></span>
            <span className="summary-chip">Procesadas <strong>{loading ? '—' : report?.processedTransactions ?? 0}</strong></span>
          </div>
        </div>
        <div className="summary-hero-side">
          <div className="summary-status">
            <div className="summary-status-head"><div className="summary-status-title">Preparación del ejercicio</div><span className={`summary-status-badge ${status.tone}`}>{status.label}</span></div>
            <p>{error || (loading ? 'Estamos sincronizando el histórico y calculando los lotes FIFO.' : status.text)}</p>
            <div className="summary-status-line"><span style={{ width: `${statusPercent}%` }}/></div>
            <div className="summary-status-note"><span>Histórico local</span><strong>{issueCount} puntos a revisar</strong></div>
          </div>
        </div>
      </section>

      <section className="summary-kpis" aria-label="Indicadores principales">
        <article className="summary-kpi accent"><span className="summary-kpi-label">Movimientos totales</span><strong className="summary-kpi-value">{movements.length.toLocaleString('es-ES')}</strong><span className="summary-kpi-note">Histórico normalizado</span></article>
        <article className="summary-kpi"><span className="summary-kpi-label">Este ejercicio</span><strong className="summary-kpi-value">{yearTransactions.toLocaleString('es-ES')}</strong><span className="summary-kpi-note">Movimientos en {currentYear}</span></article>
        <article className="summary-kpi"><span className="summary-kpi-label">Conexiones</span><strong className="summary-kpi-value">{connections.length}</strong><span className="summary-kpi-note">Fuentes conectadas</span></article>
        <article className="summary-kpi"><span className="summary-kpi-label">Activos con saldo</span><strong className="summary-kpi-value">{nonZeroAssets}</strong><span className="summary-kpi-note">Saldo distinto de cero</span></article>
        <article className="summary-kpi"><span className="summary-kpi-label">Ingresos identificados</span><strong className="summary-kpi-value">{money(report?.incomeEur)}</strong><span className="summary-kpi-note">Importe valorado en EUR</span></article>
      </section>

      <section className="summary-grid">
        <article className="summary-panel">
          <div className="summary-panel-head"><div><span className="summary-panel-kicker">Actividad</span><h3>Ritmo de movimientos</h3><p className="summary-panel-copy">Número de operaciones registradas por mes durante {currentYear}.</p></div><Link href="/dashboard/movimientos" className="summary-head-link">Abrir histórico</Link></div>
          <div className="summary-chart">{monthly.map((count, index) => <div className="summary-month" key={index}><div className="summary-month-count">{count || ''}</div><div className="summary-month-bar-wrap"><div className="summary-month-bar" style={{ height: `${Math.max(4, (count / maxMonth) * 100)}%` }}/></div><div className="summary-month-label">{new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(currentYear, index, 1)).replace('.', '')}</div></div>)}</div>
          <div className="summary-chart-note">La gráfica representa actividad registrada, no rentabilidad. El cálculo fiscal se muestra arriba.</div>
        </article>

        <div className="summary-side-stack">
          <article className="summary-panel summary-mini"><div className="summary-panel-head" style={{padding:'0'}}><div><span className="summary-panel-kicker">Desglose</span><h3>Magnitudes fiscales</h3></div><span className="summary-tag">EUR</span></div><div style={{marginTop:12}}><div className="summary-mini-row"><span>Ganancia / pérdida</span><strong>{money(report?.gain)}</strong></div><div className="summary-mini-row"><span>Valor de transmisión</span><strong>{money(report?.proceeds)}</strong></div><div className="summary-mini-row"><span>Coste de adquisición</span><strong>{money(report?.costBasis)}</strong></div><div className="summary-mini-row"><span>Comisiones fiat</span><strong>{money(report?.feesEur)}</strong></div></div></article>
          <article className="summary-panel summary-mini"><div className="summary-panel-head" style={{padding:'0'}}><div><span className="summary-panel-kicker">Cobertura</span><h3>Estado del histórico</h3></div></div><div style={{marginTop:12}}><div className="summary-mini-row"><span>Hasta</span><strong>{report?.processedThrough ? fullDate(report.processedThrough) : '—'}</strong></div><div className="summary-mini-row"><span>Transacciones procesadas</span><strong>{report?.processedTransactions?.toLocaleString('es-ES') ?? '—'}</strong></div><div className="summary-mini-row"><span>Incidencias de calidad</span><strong>{issueCount}</strong></div><div className="summary-progress"><span style={{ width: `${statusPercent}%` }}/></div></div></article>
        </div>

        <article className="summary-panel table-panel"><div className="summary-panel-head"><div><span className="summary-panel-kicker">Última actividad</span><h3>Movimientos recientes</h3><p className="summary-panel-copy">Las operaciones más recientes del histórico normalizado.</p></div></div>{recent.length ? <table className="summary-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th className="summary-table-right">Cantidad</th><th className="summary-table-right">Origen</th></tr></thead><tbody>{recent.map((movement) => <tr key={movement.id}><td><strong>{shortDate(movement.occurredAt)}</strong><span>{new Date(movement.occurredAt).getFullYear()}</span></td><td><span className="summary-type">{movement.transactionType}</span></td><td><strong>{movement.baseAsset || '—'}</strong><span>{movement.quoteAsset || movement.priceCurrency || 'Sin contrapartida'}</span></td><td className="summary-table-right"><strong>{qty(movement.baseAmount)}</strong><span>{movement.baseAsset || ''}</span></td><td className="summary-table-right"><strong>{movement.exchange}</strong><span>{movement.originalType || 'normalizado'}</span></td></tr>)}</tbody></table> : <div className="summary-empty">{loading ? 'Cargando movimientos…' : 'Todavía no hay movimientos en el histórico.'}</div>}</article>

        <article className="summary-panel"><div className="summary-panel-head"><div><span className="summary-panel-kicker">Control</span><h3>Qué merece tu atención</h3><p className="summary-panel-copy">Información de control para decidir qué revisar antes de cerrar el ejercicio.</p></div></div><div className="summary-alerts"><div className="summary-alert"><div className="summary-alert-head"><span className="summary-alert-icon">✓</span><strong>Sincronización</strong></div><span>{connections.length ? `${connections.length} fuente${connections.length === 1 ? '' : 's'} disponible${connections.length === 1 ? '' : 's'} para el cálculo.` : 'No hay conexiones activas. Añade una fuente para empezar.'}</span></div><div className={`summary-alert ${report && report.pendingTransfers ? 'warn' : ''}`}><div className="summary-alert-head"><span className="summary-alert-icon">↔</span><strong>Transferencias</strong></div><span>{report?.pendingTransfers ? `${report.pendingTransfers} fragmentos pendientes de cuadrar.` : 'No hay transferencias pendientes detectadas.'}</span></div><div className={`summary-alert ${report && (report.valuationIssues || report.unknownDisposals) ? 'danger' : ''}`}><div className="summary-alert-head"><span className="summary-alert-icon">!</span><strong>Valoración fiscal</strong></div><span>{report?.valuationIssues || report?.unknownDisposals ? `${(report.valuationIssues || 0) + (report.unknownDisposals || 0)} operaciones necesitan revisión.` : 'No se han detectado problemas de valoración en el ejercicio.'}</span></div></div></article>

        <article className="summary-panel"><div className="summary-privacy"><div className="summary-privacy-icon">⌁</div><div className="summary-privacy-copy"><strong>Cálculo local y control del histórico</strong><span>CoinRenta prepara los datos fiscales en tu navegador a partir del histórico normalizado. Las conexiones, fuentes y credenciales permanecen separadas del cálculo local.</span></div><Link href="/dashboard/renta" className="summary-head-link">Ver detalle fiscal →</Link></div></article>
      </section>
    </main>
  </>;
}
