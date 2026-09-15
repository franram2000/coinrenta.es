'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { calculateFifo, type FifoReport } from '@/lib/tax/fifo';
import { datasetToFifo, fetchConnectionDataset, getLocalDataset, mergeDatasets, type LocalDataset, type LocalMovement } from '@/lib/client/local-cache';

export type LocalConnection = { id: string; label: string | null; provider_type: string | null; status: string | null; last_sync_at: string | null; last_sync_status: string | null; exchange: string; exchangeName: string };

type Props = { userId: string; connections: LocalConnection[]; mode: 'renta' | 'movimientos' | 'fiscalidad' | 'resumen'; isPro: boolean; displayName?: string | null; year?: number };

function money(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }); }
function qty(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: 8 }); }
function date(value: string) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function isFiat(symbol: string | null) { return new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']).has(String(symbol || '').toUpperCase()); }

function WorkspaceStyles() {
  return <style jsx global>{`
    .workspace-page { width:100%; max-width:1240px; }
    .workspace-subtitle { margin:5px 0 0; color:var(--cr-text-muted); font-size:13px; }
    .renta-page { min-height:100%; }
    .renta-hero { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-bottom:16px; }
    .renta-hero h2 { margin:6px 0 4px; font-size:26px; letter-spacing:-.045em; }
    .renta-hero p { margin:0; color:var(--cr-text-muted); font-size:12px; }
    .renta-year-switcher { display:flex; gap:6px; flex-wrap:wrap; }
    .renta-year-switcher a { padding:8px 11px; border:1px solid var(--cr-border); border-radius:9px; color:#91A0B6; font-size:11px; font-weight:800; background:rgba(255,255,255,.02); }
    .renta-year-switcher a:hover,.renta-year-switcher a.selected { color:#6DE0D7; border-color:rgba(15,167,160,.30); background:var(--cr-primary-soft); }
    .renta-stat-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:13px; margin-bottom:15px; }
    .renta-number-warning { color:var(--cr-warning); }
    .renta-badge,.summary-data-note,.fiscal-badge { display:inline-flex; align-items:center; padding:6px 9px; border:1px solid var(--cr-border); border-radius:999px; color:#8290A5; background:rgba(255,255,255,.025); font-size:9px; font-weight:850; letter-spacing:.06em; text-transform:uppercase; }
    .renta-section { margin-top:15px; }
    .renta-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:18px; }
    .renta-summary-grid > div { min-width:0; padding:14px; border:1px solid var(--cr-border); border-radius:12px; background:rgba(255,255,255,.02); }
    .renta-summary-grid small { display:block; color:#7F8DA3; font-size:10px; font-weight:750; }
    .renta-summary-grid strong { display:block; margin-top:5px; font-size:16px; letter-spacing:-.02em; }
    .renta-explanation { display:grid; gap:5px; margin-top:16px; padding:14px; border:1px solid rgba(15,167,160,.14); border-radius:12px; background:rgba(15,167,160,.045); color:#8FA0B5; font-size:11px; line-height:1.6; }
    .renta-explanation strong { color:#D8E3ED; }
    .table-wrap { margin-top:18px; overflow:auto; border:1px solid var(--cr-border); border-radius:14px; background:#0A1220; }
    .workspace-table { width:100%; min-width:900px; border-collapse:collapse; }
    .workspace-table th { padding:12px 14px; text-align:left; color:#AAB6C7; background:rgba(255,255,255,.035); border-bottom:1px solid var(--cr-border); font-size:10px; font-weight:850; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
    .workspace-table td { padding:11px 14px; color:#D7DFE9; border-bottom:1px solid rgba(255,255,255,.055); font-size:12px; vertical-align:middle; white-space:nowrap; }
    .workspace-table tbody tr:hover { background:rgba(255,255,255,.025); }
    .workspace-table tbody tr:last-child td { border-bottom:0; }
    .workspace-table td strong { display:block; font-size:12px; }
    .table-subtext { display:block; margin-top:2px; color:#6F7E94; font-size:9px; }
    .movement-type { display:inline-flex; align-items:center; padding:5px 8px; border-radius:7px; background:rgba(15,167,160,.09); color:#72D7CF; font-size:10px; font-weight:850; }
    .fiscality-stat-grid { margin-top:0; }
    .fiscality-section { margin-top:15px; }
    .data-list { display:grid; gap:0; margin-top:12px; }
    .data-row { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:14px 0; border-top:1px solid var(--cr-border); }
    .data-row strong,.data-row span { display:block; }
    .data-row strong { font-size:12px; }
    .data-row div span { margin-top:3px; color:#7D8BA0; font-size:11px; }
    .fiscal-grid { display:grid; grid-template-columns:1.15fr .85fr; gap:15px; }
    .fiscal-card { min-width:0; border:1px solid var(--cr-border); border-radius:18px; background:var(--cr-surface); box-shadow:var(--cr-shadow-sm); }
    .fiscal-card-pad { padding:23px; }
    .fiscal-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .fiscal-kicker { color:#54D0C8; font-size:10px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
    .fiscal-card h2,.fiscal-card h3 { margin:5px 0 0; letter-spacing:-.035em; }
    .fiscal-card h2 { font-size:21px; }
    .fiscal-card h3 { font-size:17px; }
    .fiscal-impact { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }
    .fiscal-impact-box { padding:16px; border:1px solid var(--cr-border); border-radius:13px; background:rgba(255,255,255,.02); }
    .fiscal-impact-label { display:block; color:#7F8DA3; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
    .fiscal-impact-value { display:block; margin-top:7px; font-size:25px; letter-spacing:-.045em; }
    .fiscal-foot { display:flex; align-items:center; gap:7px; margin-top:15px; color:#728198; font-size:10px; }
    .fiscal-dot { width:6px; height:6px; border-radius:50%; background:var(--cr-success); }
    .fiscal-tech { grid-column:1 / -1; }
    .renta-framework-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:17px; }
    .renta-framework-grid > div { display:grid; gap:5px; padding:14px; border:1px solid var(--cr-border); border-radius:12px; background:rgba(255,255,255,.02); }
    .renta-framework-grid strong { font-size:11px; }
    .renta-framework-grid span { color:#7D8DA0; font-size:10px; line-height:1.55; }
    .renta-empty { min-height:180px; display:grid; place-items:center; padding:30px; text-align:center; color:#7D8DA0; font-size:12px; }
    .connection-error { padding:18px; border:1px solid rgba(231,106,106,.22); border-radius:14px; background:rgba(231,106,106,.06); color:#F0A0A0; font-size:12px; }
    .quality-actions { margin-top:12px; }
    .quality-action { display:inline-flex; padding:9px 12px; border-radius:9px; background:var(--cr-primary); color:white; font-size:11px; font-weight:800; }
    @media (max-width:900px) { .renta-stat-grid,.renta-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .fiscal-grid { grid-template-columns:1fr; } .fiscal-tech { grid-column:auto; } .renta-framework-grid { grid-template-columns:1fr; } .renta-hero { align-items:flex-start; flex-direction:column; } }
    @media (max-width:560px) { .renta-stat-grid,.renta-summary-grid,.fiscal-impact { grid-template-columns:1fr; } .panel-card { padding:17px; } }
  `}</style>;
}

export default function LocalWorkspace({ userId, connections, mode, isPro, displayName, year = new Date().getFullYear() }: Props) {
  const [datasets, setDatasets] = useState<LocalDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FifoReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const loaded: LocalDataset[] = [];
        for (const connection of connections.filter((item) => item.provider_type === 'csv' && item.status === 'active')) {
          const sourceVersion = connection.last_sync_at || '';
          let dataset = await getLocalDataset(userId, connection.id);
          if (!dataset || dataset.sourceVersion !== sourceVersion) dataset = await fetchConnectionDataset(userId, connection.id, sourceVersion);
          loaded.push(dataset);
        }
        if (!cancelled) setDatasets(loaded);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos locales.');
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [connections, userId]);

  const movements = useMemo(() => mergeDatasets(datasets), [datasets]);
  const fifoInput = useMemo(() => datasetToFifo({ version: 3, userId, connectionId: 'merged', sourceVersion: datasets.map((item) => item.sourceVersion).join(':'), fetchedAt: new Date().toISOString(), exchange: 'combined', movements }), [datasets, movements, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!fifoInput.txs.length) { setReport(null); return; }
    void calculateFifo(fifoInput.txs, year, fifoInput.assets).then((value) => { if (!cancelled) setReport(value); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo calcular el informe fiscal.'); });
    return () => { cancelled = true; };
  }, [fifoInput, year]);

  const connectionCount = connections.length;

  if (loading) return <><WorkspaceStyles /><main className="dashboard-content workspace-page"><section className="panel-card"><div className="renta-empty">Cargando datos guardados en este dispositivo…</div></section></main></>;
  if (error) return <><WorkspaceStyles /><main className="dashboard-content workspace-page"><section className="panel-card"><div className="connection-error">{error}<div className="quality-actions"><Link className="quality-action" href="/dashboard/exchanges">Revisar conexiones</Link></div></div></section></main></>;

  return <><WorkspaceStyles />{mode === 'movimientos' ? <Movements movements={movements} isPro={isPro} /> : mode === 'fiscalidad' ? <Fiscality report={report} year={year} /> : mode === 'resumen' ? <Summary report={report} movements={movements} displayName={displayName} connectionCount={connectionCount} /> : <Renta report={report} year={year} isPro={isPro} />}</>;
}

function Renta({ report, year, isPro }: { report: FifoReport | null; year: number; isPro: boolean }) {
  const actionable = report ? report.unknownDisposals + report.valuationIssues + report.pendingTransfers : 0;
  const years = Array.from({ length: 5 }, (_, index) => year - index);
  return <main className="dashboard-content workspace-page renta-page">
    <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Renta</h1><p className="workspace-subtitle">El cálculo fiscal se ejecuta sobre los datos guardados localmente en este dispositivo.</p></div></header>
    <section className="renta-hero panel-card"><div><span className="section-kicker">EJERCICIO FISCAL</span><h2>Informe fiscal {year}</h2><p>Cambio de ejercicio sin consultar de nuevo el histórico al servidor.</p></div><nav className="renta-year-switcher" aria-label="Ejercicio fiscal">{years.map((item)=><Link key={item} href={item===new Date().getFullYear()?'/dashboard/renta':`/dashboard/renta?year=${item}`} className={item===year?'selected':''}>{item}</Link>)}</nav></section>
    <section className="renta-stat-grid"><article className="stat-card"><span className="stat-label">Ganancia / pérdida</span><strong className={report && !report.gainKnown?'renta-number-warning':''}>{isPro?money(report?.gain):'Pro'}</strong><span className="stat-note">{isPro?(report?.gainKnown?'FIFO completo':'Resultado provisional'):'Resultado fiscal detallado disponible en Pro.'}</span></article><article className="stat-card"><span className="stat-label">Valor de transmisión</span><strong>{money(report?.proceeds)}</strong><span className="stat-note">Ventas y permutas</span></article><article className="stat-card"><span className="stat-label">Coste FIFO</span><strong>{money(report?.costBasis)}</strong><span className="stat-note">Lotes históricos</span></article><article className="stat-card"><span className="stat-label">Incidencias</span><strong>{actionable}</strong><span className="stat-note">Requieren revisión</span></article></section>
    <section className="renta-section panel-card"><div className="panel-head"><h3>Ganancias y pérdidas patrimoniales</h3><span className="renta-badge">EUR · FIFO</span></div><div className="renta-summary-grid"><div><small>Transmisiones / permutas</small><strong>{report?.disposals ?? 0}</strong></div><div><small>Ganancia calculada</small><strong>{isPro?money(report?.gain):'Pro'}</strong></div><div><small>Ingresos identificados</small><strong>{money(report?.incomeEur)}</strong></div><div><small>Comisiones fiat</small><strong>{money(report?.feesEur)}</strong></div></div></section>
    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">PRIVACIDAD</span><h3>Datos de esta consulta</h3></div></div><div className="renta-summary-grid"><div><small>Fuente</small><strong>Cache local</strong></div><div><small>Servidor</small><strong>Sin movimientos derivados</strong></div><div><small>Histórico</small><strong>{report?.processedTransactions ?? 0} movimientos</strong></div><div><small>FIFO</small><strong>Español</strong></div></div><div className="renta-explanation"><strong>Arquitectura de datos</strong><span>Los CSV originales y las credenciales de API permanecen asociados a la conexión. Los movimientos normalizados, lotes FIFO, saldos e incidencias se reconstruyen y guardan en IndexedDB de este dispositivo.</span></div></section>
  </main>;
}

function Movements({ movements, isPro }: { movements: LocalMovement[]; isPro: boolean }) {
  return <main className="dashboard-content workspace-page">
    <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Movimientos</h1><p className="workspace-subtitle">{movements.length.toLocaleString('es-ES')} movimientos disponibles desde la caché local.</p></div></header>
    <section className="panel-card"><div className="panel-head"><div><span className="section-kicker">CACHE LOCAL</span><h3>Histórico normalizado</h3></div><span className="summary-data-note">No se consulta transactions en Supabase.</span></div>{movements.length?<div className="table-wrap"><table className="workspace-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th>Cantidad</th><th>Contrapartida</th><th>Fee</th><th>Origen</th></tr></thead><tbody>{movements.slice().reverse().map((movement)=><tr key={movement.id}><td>{date(movement.occurredAt)}</td><td><span className="movement-type">{movement.transactionType}</span>{movement.originalType&&<small className="table-subtext">Origen: {movement.originalType}</small>}</td><td><strong>{movement.baseAsset||'—'}</strong></td><td>{isPro?`${qty(movement.baseAmount)} ${movement.baseAsset||''}`:'***'}</td><td>{isPro?`${qty(movement.quoteAmount)} ${movement.quoteAsset||movement.priceCurrency||''}`:'***'}</td><td>{isPro?`${qty(movement.feeAmount)} ${movement.feeAsset||''}`:'***'}</td><td>{movement.exchange}</td></tr>)}</tbody></table></div>:<div className="renta-empty">No hay movimientos en la caché local. Importa primero un CSV.</div>}</section>
  </main>;
}

function Fiscality({ report, year }: { report: FifoReport | null; year: number }) {
  return <main className="dashboard-content workspace-page"><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Fiscalidad</h1><p className="workspace-subtitle">Resumen fiscal calculado directamente desde la caché local.</p></div></header><section className="stat-grid fiscality-stat-grid"><article className="stat-card"><span className="stat-label">Ejercicio</span><strong>{year}</strong></article><article className="stat-card stat-card-accent"><span className="stat-label">Resultado</span><strong>{money(report?.gain)}</strong></article><article className="stat-card"><span className="stat-label">Coste FIFO</span><strong>{money(report?.costBasis)}</strong></article><article className="stat-card"><span className="stat-label">Transmisiones</span><strong>{report?.disposals ?? 0}</strong></article></section><div className="panel-card fiscality-section"><div className="panel-head"><div><span className="section-kicker">ESTADO</span><h3>Cálculo local</h3></div></div><div className="data-list"><div className="data-row"><div><strong>FIFO</strong><span>Histórico completo hasta el ejercicio seleccionado</span></div><span className="status-pill">Activo</span></div><div className="data-row"><div><strong>Datos fiscales</strong><span>Sin almacenamiento de resultados derivados en servidor</span></div><span className="status-pill">Local</span></div></div></div></main>;
}

function Summary({ report, movements, displayName, connectionCount }: { report: FifoReport | null; movements: LocalMovement[]; displayName?: string | null; connectionCount: number }) {
  const current = new Map<string, number>();
  for (const movement of movements) {
    if (!movement.baseAsset || movement.baseAmount == null || isFiat(movement.baseAsset)) continue;
    current.set(movement.baseAsset, (current.get(movement.baseAsset) || 0) + movement.baseAmount);
    if (movement.quoteAsset && movement.quoteAmount != null && !isFiat(movement.quoteAsset)) current.set(movement.quoteAsset, (current.get(movement.quoteAsset) || 0) + movement.quoteAmount);
  }
  const nonZero = [...current.entries()].filter(([, value]) => Math.abs(value) > 1e-10).length;
  return <main className="dashboard-content workspace-page"><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Centro de Mando Fiscal</h1><p className="workspace-subtitle">{displayName ? `Hola, ${displayName}.` : 'Tus datos fiscales están disponibles en este dispositivo.'}</p></div></header><section className="fiscal-grid"><div className="fiscal-card fiscal-card-pad"><div className="fiscal-card-head"><div><span className="fiscal-kicker">FISCAL</span><h2>Actividad registrada</h2></div><span className="fiscal-badge">CACHE LOCAL</span></div><div className="fiscal-impact"><div className="fiscal-impact-box"><span className="fiscal-impact-label">Ganancia / pérdida</span><strong className="fiscal-impact-value">{money(report?.gain)}</strong></div><div className="fiscal-impact-box"><span className="fiscal-impact-label">Transmisiones</span><strong className="fiscal-impact-value">{report?.disposals ?? 0}</strong></div></div><div className="fiscal-foot"><span className="fiscal-dot"/>Cálculo realizado en el navegador</div></div><div className="fiscal-card fiscal-card-pad"><div className="fiscal-card-head"><div><span className="fiscal-kicker">DATOS</span><h3>Estado local</h3></div></div><div className="renta-summary-grid"><div><small>Conexiones</small><strong>{connectionCount}</strong></div><div><small>Movimientos</small><strong>{movements.length}</strong></div><div><small>Activos con saldo</small><strong>{nonZero}</strong></div><div><small>Servidor</small><strong>Fuentes</strong></div></div></div><div className="fiscal-card fiscal-card-pad fiscal-tech"><div className="fiscal-card-head"><div><span className="fiscal-kicker">PRIVACIDAD</span><h3>Qué se queda en cada sitio</h3></div></div><div className="renta-framework-grid"><div><strong>Servidor</strong><span>Conexiones, metadatos, CSV originales y credenciales API protegidas.</span></div><div><strong>Dispositivo</strong><span>Movimientos normalizados, lotes FIFO, saldos, incidencias y resultados fiscales.</span></div><div><strong>Borrado</strong><span>Eliminar una conexión elimina su fuente del servidor y su caché asociada en este dispositivo.</span></div></div></div></section></main>;
}
