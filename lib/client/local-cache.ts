'use client';

import type { FifoAsset, FifoTx } from '@/lib/tax/fifo';
import type { ReviewIssue } from '@/lib/exchanges/canonicalize';

export type LocalMovement = {
  id: string; occurredAt: string; transactionType: string; originalType: string;
  direction: 'incoming' | 'outgoing' | 'neutral'; baseAsset: string | null; baseAmount: number | null;
  quoteAsset: string | null; quoteAmount: number | null; feeAsset: string | null; feeAmount: number | null;
  price: number | null; priceCurrency: string | null; classification: 'classified' | 'needs_review';
  accountId: string | null; sourceFile: string | null; exchange: string; rawRow?: Record<string, string> | null;
  reviewIssues?: ReviewIssue[];
  reviewStatus?: string | null;
  reviewConfidence?: 'low' | 'medium' | 'high' | string | null;
  reviewHint?: string | null;
};

export type LocalDataset = {
  version: number; userId: string; connectionId: string; sourceVersion: string; fetchedAt: string;
  exchange: string; movements: LocalMovement[];
};

type StoredRecord = LocalDataset & { cacheKey: string };
const DB_NAME = 'coinrenta-local';
const DB_VERSION = 6;
const STORE = 'datasets';
const CACHE_SCHEMA_VERSION = 9;
const FISCAL_REFRESH_VERSION = 'fifo9';

if (typeof document !== 'undefined') {
  const styleId = 'coinrenta-hide-supabase-derived-label';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '.summary-data-note{display:none!important;}';
    document.head.appendChild(style);
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible en este navegador.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'cacheKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la caché local.'));
  });
}

export async function getLocalDataset(_userId: string, _connectionId: string, _sourceVersion?: string): Promise<LocalDataset | null> {
  // Derived fiscal data is never used as the authoritative source. The current
  // normalization is fetched on each workspace load, then persisted locally.
  return null;
}

export async function saveLocalDataset(dataset: LocalDataset) {
  const db = await openDb();
  const record: StoredRecord = { ...dataset, cacheKey: `${dataset.userId}:${dataset.connectionId}` };
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('No se pudo guardar la caché local.'));
  });
}

export async function deleteLocalDataset(userId: string, connectionId: string) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(`${userId}:${connectionId}`);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error || new Error('No se pudo borrar la caché local.'));
    });
  } catch {}
}

export async function clearUserLocalCache(userId: string) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite'); const store = tx.objectStore(STORE); const request = store.openCursor();
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return; const value = cursor.value as StoredRecord; if (value.userId === userId) cursor.delete(); cursor.continue(); };
      request.onerror = () => reject(request.error || new Error('No se pudo limpiar la caché local.'));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error('No se pudo limpiar la caché local.'));
    });
  } catch {}
}

export async function fetchConnectionDataset(userId: string, connectionId: string, sourceVersion: string): Promise<LocalDataset> {
  const url = `/api/exchange-data?connection_id=${encodeURIComponent(connectionId)}&refresh=${encodeURIComponent(FISCAL_REFRESH_VERSION)}`;
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } });
  if (!response.ok) {
    let detail = 'No se pudieron cargar los datos de la conexión.';
    try { const payload = await response.json(); detail = payload?.error || detail; } catch {}
    throw new Error(detail);
  }
  const payload = await response.json() as {
    connectionId: string; exchange: string; sourceVersion: string; fetchedAt: string;
    movements: Array<LocalMovement & { externalId?: string; raw?: { sourceFile?: string; sourceExchange?: string; row?: Record<string, string>; review_issues?: ReviewIssue[]; review_status?: string; review_confidence?: string; review_hint?: string | null } }>;
  };
  const movements: LocalMovement[] = (payload.movements || []).map((movement, index) => {
    const raw = movement.raw;
    return {
      ...movement,
      id: movement.id || movement.externalId || `${payload.connectionId}:${movement.occurredAt}:${movement.transactionType}:${index}`,
      sourceFile: movement.sourceFile || raw?.sourceFile || null,
      exchange: movement.exchange || raw?.sourceExchange || payload.exchange,
      accountId: movement.accountId || null,
      rawRow: raw?.row || null,
      reviewIssues: movement.reviewIssues || raw?.review_issues || [],
      reviewStatus: movement.reviewStatus || raw?.review_status || null,
      reviewConfidence: movement.reviewConfidence || raw?.review_confidence || null,
      reviewHint: movement.reviewHint || raw?.review_hint || null,
    };
  });
  if (!movements.length) throw new Error('La fuente fiscal no contiene movimientos normalizados. Revisa la importación CSV.');
  const dataset: LocalDataset = {
    version: CACHE_SCHEMA_VERSION, userId, connectionId: payload.connectionId, sourceVersion: `${payload.sourceVersion || sourceVersion}:${FISCAL_REFRESH_VERSION}`,
    fetchedAt: payload.fetchedAt || new Date().toISOString(), exchange: payload.exchange, movements,
  };
  await saveLocalDataset(dataset); return dataset;
}

export function datasetToFifo(dataset: LocalDataset): { txs: FifoTx[]; assets: Map<string, FifoAsset> } {
  const symbols = new Set<string>();
  for (const movement of dataset.movements) {
    for (const value of [movement.baseAsset, movement.quoteAsset, movement.feeAsset, movement.priceCurrency]) if (value) symbols.add(value.toUpperCase());
    if (movement.rawRow) for (const value of [movement.rawRow.Fiat, movement.rawRow.Currency, movement.rawRow['Asset market price currency'], movement.rawRow['Spread Currency']]) if (value) symbols.add(value.toUpperCase());
  }
  const assets = new Map<string, FifoAsset>();
  for (const symbol of symbols) {
    const id = `local-asset:${symbol}`;
    const fiat = new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']).has(symbol);
    assets.set(id, { id, symbol, name: symbol, asset_type: fiat ? 'fiat' : 'crypto' });
  }
  const idFor = (symbol: string | null) => symbol ? `local-asset:${symbol.toUpperCase()}` : null;
  const txs: FifoTx[] = dataset.movements.map((movement) => ({
    id: movement.id, occurred_at: movement.occurredAt, transaction_type: movement.transactionType,
    base_asset_id: idFor(movement.baseAsset), base_amount: movement.baseAmount, quote_asset_id: idFor(movement.quoteAsset), quote_amount: movement.quoteAmount,
    fee_asset_id: idFor(movement.feeAsset), fee_amount: movement.feeAmount, price: movement.price, price_currency: movement.priceCurrency, account_id: movement.accountId,
    raw_data: { original_type: movement.originalType, classification: movement.classification, sourceFile: movement.sourceFile, sourceExchange: movement.exchange, review_issues: movement.reviewIssues || [], review_status: movement.reviewStatus, review_confidence: movement.reviewConfidence, review_hint: movement.reviewHint, row: movement.rawRow || undefined },
  }));
  return { txs, assets };
}

export function mergeDatasets(datasets: LocalDataset[]) {
  const byId = new Map<string, LocalMovement>();
  for (const dataset of datasets) for (const movement of dataset.movements) {
    const id = movement.id || `${dataset.connectionId}:${movement.occurredAt}:${movement.transactionType}:${movement.baseAsset || ''}:${movement.baseAmount ?? ''}`;
    byId.set(id, { ...movement, id });
  }
  return [...byId.values()].sort((a,b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || a.id.localeCompare(b.id));
}