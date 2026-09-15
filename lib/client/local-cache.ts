'use client';

import type { FifoAsset, FifoTx } from '@/lib/tax/fifo';

export type LocalMovement = {
  id: string;
  occurredAt: string;
  transactionType: string;
  originalType: string;
  direction: 'incoming' | 'outgoing' | 'neutral';
  baseAsset: string | null;
  baseAmount: number | null;
  quoteAsset: string | null;
  quoteAmount: number | null;
  feeAsset: string | null;
  feeAmount: number | null;
  price: number | null;
  priceCurrency: string | null;
  classification: 'classified' | 'needs_review';
  accountId: string | null;
  sourceFile: string | null;
  exchange: string;
};

export type LocalDataset = {
  version: 3;
  userId: string;
  connectionId: string;
  sourceVersion: string;
  fetchedAt: string;
  exchange: string;
  movements: LocalMovement[];
};

type StoredRecord = LocalDataset & { cacheKey: string };
const DB_NAME = 'coinrenta-local';
const DB_VERSION = 2;
const STORE = 'datasets';

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

export async function getLocalDataset(userId: string, connectionId: string): Promise<LocalDataset | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(`${userId}:${connectionId}`);
    request.onsuccess = () => {
      const value = request.result as StoredRecord | undefined;
      if (!value || value.version !== 3) return resolve(null);
      resolve({ ...value });
    };
    request.onerror = () => reject(request.error || new Error('No se pudo leer la caché local.'));
  });
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
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('No se pudo borrar la caché local.'));
    });
  } catch {
    // Deleting local cache is best-effort when browser storage is unavailable.
  }
}

export async function clearUserLocalCache(userId: string) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value as StoredRecord;
        if (value.userId === userId) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error('No se pudo limpiar la caché local.'));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo limpiar la caché local.'));
    });
  } catch {
    // Best effort.
  }
}

export async function fetchConnectionDataset(userId: string, connectionId: string, sourceVersion: string): Promise<LocalDataset> {
  const url = `/api/exchange-data?connection_id=${encodeURIComponent(connectionId)}`;
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let detail = 'No se pudieron cargar los datos de la conexión.';
    try { const payload = await response.json(); detail = payload?.error || detail; } catch {}
    throw new Error(detail);
  }
  const payload = await response.json() as {
    connectionId: string;
    exchange: string;
    sourceVersion: string;
    fetchedAt: string;
    movements: Array<LocalMovement & { externalId?: string; raw?: { sourceFile?: string; sourceExchange?: string; row?: Record<string, string> } }>;
  };
  const movements: LocalMovement[] = (payload.movements || []).map((movement, index) => ({
    ...movement,
    id: movement.id || movement.externalId || `${payload.connectionId}:${movement.occurredAt}:${movement.transactionType}:${index}`,
    sourceFile: movement.sourceFile || movement.raw?.sourceFile || null,
    exchange: movement.exchange || movement.raw?.sourceExchange || payload.exchange,
    accountId: movement.accountId || null,
  }));
  const dataset: LocalDataset = {
    version: 3,
    userId,
    connectionId: payload.connectionId,
    sourceVersion: payload.sourceVersion || sourceVersion,
    fetchedAt: payload.fetchedAt || new Date().toISOString(),
    exchange: payload.exchange,
    movements,
  };
  await saveLocalDataset(dataset);
  return dataset;
}

export function datasetToFifo(dataset: LocalDataset): { txs: FifoTx[]; assets: Map<string, FifoAsset> } {
  const symbols = new Set<string>();
  for (const movement of dataset.movements) {
    for (const value of [movement.baseAsset, movement.quoteAsset, movement.feeAsset]) {
      if (value) symbols.add(value.toUpperCase());
    }
    if (movement.priceCurrency) symbols.add(movement.priceCurrency.toUpperCase());
  }

  const assets = new Map<string, FifoAsset>();
  for (const symbol of symbols) {
    const id = `local-asset:${symbol}`;
    const fiat = new Set(['EUR','USD','GBP','CHF','PLN','SEK','DKK','NOK','AUD','CAD','JPY','SGD','CNY','HKD','NZD','ZAR','TRY','BRL','MXN','INR','KRW']).has(symbol);
    assets.set(id, { id, symbol, name: symbol, asset_type: fiat ? 'fiat' : 'crypto' });
  }

  const idFor = (symbol: string | null) => symbol ? `local-asset:${symbol.toUpperCase()}` : null;
  const txs: FifoTx[] = dataset.movements.map((movement) => ({
    id: movement.id,
    occurred_at: movement.occurredAt,
    transaction_type: movement.transactionType,
    base_asset_id: idFor(movement.baseAsset),
    base_amount: movement.baseAmount,
    quote_asset_id: idFor(movement.quoteAsset),
    quote_amount: movement.quoteAmount,
    fee_asset_id: idFor(movement.feeAsset),
    fee_amount: movement.feeAmount,
    price: movement.price,
    price_currency: movement.priceCurrency,
    account_id: movement.accountId,
    raw_data: {
      original_type: movement.originalType,
      classification: movement.classification,
      sourceFile: movement.sourceFile,
      sourceExchange: movement.exchange,
    },
  }));
  return { txs, assets };
}

export function mergeDatasets(datasets: LocalDataset[]) {
  const byId = new Map<string, LocalMovement>();
  for (const dataset of datasets) {
    for (const movement of dataset.movements) {
      const id = movement.id || `${dataset.connectionId}:${movement.occurredAt}:${movement.transactionType}:${movement.baseAsset || ''}:${movement.baseAmount ?? ''}`;
      byId.set(id, { ...movement, id });
    }
  }
  return [...byId.values()].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || a.id.localeCompare(b.id));
}
