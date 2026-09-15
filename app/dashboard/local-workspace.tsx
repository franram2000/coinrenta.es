'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { calculateFifo, type FifoAsset, type FifoReport } from '@/lib/tax/fifo';
import { datasetToFifo, fetchConnectionDataset, getLocalDataset, mergeDatasets, type LocalDataset, type LocalMovement } from '@/lib/client/local-cache';

export type LocalConnection = { id: string; label: string | null; provider_type: string | null; status: string | null; last_sync_at: string | null; last_sync_status: string | null; exchange: string; exchangeName: string };

type Props = { userId: string; connections: LocalConnection[]; mode: 'renta' | 'movimientos' | 'fiscalidad' | 'resumen'; isPro: boolean; displayName?: string | null; year?: number };

function money(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }); }
function qty(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: 8 }); }
function date(value: string) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function isFiat(symbol: string | null) { return new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']).has(String(symbol || '').toUpperCase()); }
function title(mode: Props['mode']) { return mode === 'renta' ? 'Renta' : mode === 'movimientos' ? 'Movimientos' : mode === 'fiscalidad' ? 'Fiscalidad' : 'Resumen'; }

export default function LocalWorkspace({ userId, connections, mode, isPro, displayName, year = 2025 }: Props) {
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
  const fifoInput = useMemo(() => datasetToFifo({ version: 2, userId, connectionId: 'merged', sourceVersion: datasets.map((item) => item.sourceVersion).join(':'), fetchedAt: new Date().toISOString(), exchange: 'combined', movements }), [datasets, movements, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!fifoInput.txs.length) { setReport(null); return; }
    void calculateFifo(fifoInput.txs, year, fifoInput.assets).then((value) => { if (!cancelled) setReport(value); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo calcular el informe fiscal.'); });
    return () => { cancelled = true; };
  }, [fifoInput, year]);

  const connectionCount = connections.length;

  if (loading) return <main className="dashboard-content"><section className="panel-card"><div className="renta-empty">Cargando datos guardados en este dispositivo…</div></section></main>;
  if (error) return <main className="dashboard-content"><section className="panel-card"><div className="connection-error">{error}<div className="quality-actions"><Link className="quality-action primary" href="/dashboard/exchanges">Revisar conexiones</Link></div></div></section></main>;

  if (mode === 'movimientos') return <Movements movements={movements} isPro={isPro} />;
  if (mode === 'fiscalidad') return <Fiscality report={report} year={year} />;
  if (mode === 'resumen') return <Summary report={report} movements={movements} displayName={displayName} connectionCount={connectionCount} />;
  return <Renta report={report} year={year} isPro={isPro} />;
}

function Renta({ report, year, isPro }: { report: FifoReport | null; year: number; isPro: boolean }) {
  const actionable = report ? report.unknownDisposals + report.valuationIssues + report.pendingTransfers : 0;
  return <main className="dashboard-content renta-page">
    <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Renta</h1><p>El cálculo fiscal se ejecuta sobre los datos guardados localmente en este dispositivo.</p></div></header>
    <section className="renta-hero panel-card"><div><span className="section-kicker">EJERCICIO FISCAL</span><h2>Informe fiscal {year}</h2><p>Cambio de ejercicio sin consultar de nuevo el histórico al servidor.</p></div><nav className="renta-year-switcher" aria-label="Ejercicio fiscal">{[2025,2024,2023,2022].map((item)=><Link key={item} href={item===2025?'/dashboard/renta':`/dashboard/renta?year=${item}`} className={item===year?'selected':''}>{item}</Link>)}</nav></section>
    <section className="renta-stat-grid"><article className="stat-card"><span className="stat-label">Ganancia / pérdida</span><strong className={report && !report.gainKnown?'renta-number-warning':''}>{isPro?money(report?.gain):'Pro'}</strong><span className="stat-note">{isPro?(report?.gainKnown?'FIFO completo':'Resultado provisional'):'Resultado fiscal detallado disponible en Pro.'}</span></article><article className="stat-card"><span className="stat-label">Valor de transmisión</span><strong>{money(report?.proceeds)}</strong><span className="stat-note">Ventas y permutas</span></article><article className="stat-card"><span className="stat-label">Coste FIFO</span><strong>{money(report?.costBasis)}</strong><span className="stat-note">Lotes históricos</span></article><article className="stat-card"><span className="stat-label">Incidencias</span><strong>{actionable}</strong><span className="stat-note">Requieren revisión</span></article></section>
    <section className="renta-section panel-card"><div className="panel-head"><h3>Ganancias y pérdidas patrimoniales</h3><span className="renta-badge">EUR · FIFO</span></div><div className="renta-summary-grid"><div><small>Transmisiones / permutas</small><strong>{report?.disposals ?? 0}</strong></div><div><small>Ganancia calculada</small><strong>{isPro?money(report?.gain):'Pro'}</strong></div><div><small>Ingresos identificados</small><strong>{money(report?.incomeEur)}</strong></div><div><small>Comisiones fiat</small><strong>{money(report?.feesEur)}</strong></div></div></section>
    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">PRIVACIDAD</span><h3>Datos de esta consulta</h3></div></div><div className="renta-summary-grid"><div><small>Fuente</small><strong>Cache local</strong></div><div><small>Servidor</small><strong>Sin movimientos derivados</strong></div><div><small>Histórico</small><strong>{report?.processedTransactions ?? 0} movimientos</strong></div><div><small>FIFO</small><strong>Español</strong></div></div><div className="renta-explanation"><strong>Arquitectura de datos</strong><span>Los CSV originales y las credenciales de API permanecen asociados a la conexión. Los movimientos normalizados, lotes FIFO, saldos y resultados fiscales se reconstruyen y guardan en IndexedDB de este dispositivo.</span></div></section>
  </main>;
}

function Movements({ movements, isPro }: { movements: LocalMovement[]; isPro: boolean }) {
  return <><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Movimientos</h1><p>{movements.length.toLocaleString('es-ES')} movimientos disponibles desde la caché local.</p></div></header><section className="dashboard-content"><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">CACHE LOCAL</span><h3>Histórico normalizado</h3></div><span className="summary-data-note">No se consulta transactions en Supabase.</span></div>{movements.length?<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th>Cantidad</th><th>Contrapartida</th><th>Fee</th><th>Origen</th></tr></thead><tbody>{movements.slice().reverse().map((movement)=><tr key={movement.id}><td>{date(movement.occurredAt)}</td><td><strong>{movement.transactionType}</strong>{movement.originalType&&<small className="table-subtext">{movement.originalType}</small>}</td><td>{movement.baseAsset||'—'}</td><td>{isPro?`${movement.baseAmount ?? '—'} ${movement.baseAsset||''}`:'***'}</td><td>{isPro?`${movement.quoteAmount ?? '—'} ${movement.quoteAsset||movement.priceCurrency||''}`:'***'}</td><td>{isPro?`${movement.feeAmount ?? '—'} ${movement.feeAsset||''}`:'***'}</td><td>{movement.exchange}</td></tr>)}</tbody></table></div>:<div className="renta-empty">No hay movimientos en la caché local. Importa primero un CSV.</div>}</div></section></>;
}

function Fiscality({ report, year }: { report: FifoReport | null; year: number }) {
  return <><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Fiscalidad</h1><p>Resumen fiscal calculado directamente desde la caché local.</p></div></header><section className="dashboard-content"><div className="stat-grid fiscality-stat-grid"><article className="stat-card"><span className="stat-label">Ejercicio</span><strong>{year}</strong></article><article className="stat-card stat-card-accent"><span className="stat-label">Resultado</span><strong>{money(report?.gain)}</strong></article><article className="stat-card"><span className="stat-label">Coste FIFO</span><strong>{money(report?.costBasis)}</strong></article><article className="stat-card"><span className="stat-label">Transmisiones</span><strong>{report?.disposals ?? 0}</strong></article></div><div className="panel-card fiscality-section"><div className="panel-head"><div><span className="section-kicker">ESTADO</span><h3>Cálculo local</h3></div></div><div className="data-list"><div className="data-row"><div><strong>FIFO</strong><span>Histórico completo hasta el ejercicio seleccionado</span></div><span className="status-pill">Activo</span></div><div className="data-row"><div><strong>Datos fiscales</strong><span>Sin almacenamiento de resultados derivados en servidor</span></div><span className="status-pill">Local</span></div></div></div></section></>;
}

function Summary({ report, movements, displayName, connectionCount }: { report: FifoReport | null; movements: LocalMovement[]; displayName?: string | null; connectionCount: number }) {
  const current = new Map<string, number>();
  for (const movement of movements) {
    if (!movement.baseAsset || movement.baseAmount == null || isFiat(movement.baseAsset)) continue;
    current.set(movement.baseAsset, (current.get(movement.baseAsset) || 0) + movement.baseAmount);
    if (movement.quoteAsset && movement.quoteAmount != null && !isFiat(movement.quoteAsset)) current.set(movement.quoteAsset, (current.get(movement.quoteAsset) || 0) + movement.quoteAmount);
  }
  const nonZero = [...current.entries()].filter(([, value]) => Math.abs(value) > 1e-10).length;
  return <><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Centro de Mando Fiscal</h1><p>{displayName ? `Hola, ${displayName}.` : 'Tus datos fiscales están disponibles en este dispositivo.'}</p></div></header><section className="dashboard-content"><div className="fiscal-grid"><div className="fiscal-card fiscal-card-pad"><div className="fiscal-card-head"><div><span className="fiscal-kicker">FISCAL</span><h2>Actividad registrada</h2></div><span className="fiscal-badge">CACHE LOCAL</span></div><div className="fiscal-impact"><div className="fiscal-impact-box"><span className="fiscal-impact-label">Ganancia / pérdida</span><strong className="fiscal-impact-value">{money(report?.gain)}</strong></div><div className="fiscal-impact-box"><span className="fiscal-impact-label">Transmisiones</span><strong className="fiscal-impact-value">{report?.disposals ?? 0}</strong></div></div><div className="fiscal-foot"><span className="fiscal-dot"/>Cálculo realizado en el navegador</div></div><div className="fiscal-card fiscal-card-pad"><div className="fiscal-card-head"><div><span className="fiscal-kicker">DATOS</span><h3>Estado local</h3></div></div><div className="renta-summary-grid"><div><small>Conexiones</small><strong>{connectionCount}</strong></div><div><small>Movimientos</small><strong>{movements.length}</strong></div><div><small>Activos con saldo</small><strong>{nonZero}</strong></div><div><small>Servidor</small><strong>Fuentes</strong></div></div></div><div className="fiscal-card fiscal-card-pad fiscal-tech"><div className="fiscal-card-head"><div><span className="fiscal-kicker">PRIVACIDAD</span><h3>Qué se queda en cada sitio</h3></div></div><div className="renta-framework-grid"><div><strong>Servidor</strong><span>Conexiones, metadatos, CSV originales y credenciales API protegidas.</span></div><div><strong>Dispositivo</strong><span>Movimientos normalizados, lotes FIFO, saldos, incidencias y resultados fiscales.</span></div><div><strong>Borrado</strong><span>Eliminar una conexión elimina su fuente del servidor y su caché asociada en este dispositivo.</span></div></div></div></div></section></>;
}
