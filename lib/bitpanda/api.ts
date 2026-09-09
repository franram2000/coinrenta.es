const API_BASE = "https://api.public.bitpanda.com";

type Page<T> = {
  data?: T[];
  cursor?: string;
};

export type BitpandaAsset = {
  id: string;
  symbol?: string;
  name?: string;
  isin?: string;
  type?: string;
  group?: string;
};

export type BitpandaHolding = {
  assetId: string;
  quantity: string;
  value: string;
  equivalentCurrencyId?: string;
};

export type BitpandaOperationTransaction = {
  transaction_id?: string;
  transactionId?: string;
  asset_id?: string;
  assetId?: string;
  currency_id?: string;
  currencyId?: string;
  wallet_id?: string;
  walletId?: string;
  asset_amount?: { value?: string };
  amount?: string;
  fee_amount?: { value?: string; asset_id?: string; currency_id?: string };
  transaction_type?: string;
  transactionType?: string;
  flow?: string;
  credited_at?: string;
  timestamp?: string;
  asset_balance_after?: { value?: string };
  trade?: { rate?: string; rate_with_fee?: string; to_eur_rate?: string };
};

export type BitpandaOperation = {
  operation_id?: string;
  operationId?: string;
  operation_type?: string;
  operationType?: string;
  timestamp?: string;
  transactions?: BitpandaOperationTransaction[];
  assetId?: string;
  amount?: string;
};

async function request<T>(path: string, apiKey: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body.slice(0, 280);
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.message || parsed?.error || parsed?.detail || detail;
    } catch {}
    throw new Error(`Bitpanda API ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

async function paginated<T>(path: string, apiKey: string, extra?: Record<string, string | number | undefined>, limit = 100000): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;

  do {
    const page = await request<Page<T>>(path, apiKey, {
      ...extra,
      pageSize: 500,
      cursor,
    });
    const data = page.data || [];
    rows.push(...data);
    cursor = page.cursor || undefined;
    if (!cursor || !data.length) break;
  } while (rows.length < limit);

  return rows;
}

export async function listAssets(apiKey: string, ids?: string[]) {
  if (!ids?.length) return paginated<BitpandaAsset>("/assets", apiKey);
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: BitpandaAsset[] = [];
  for (const id of unique) {
    const page = await request<Page<BitpandaAsset>>("/assets", apiKey, { id });
    chunks.push(...(page.data || []));
  }
  return chunks;
}

export async function listCurrencies(apiKey: string, ids?: string[]) {
  if (!ids?.length) return paginated<BitpandaAsset>("/currencies", apiKey);
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: BitpandaAsset[] = [];
  for (const id of unique) {
    const page = await request<Page<BitpandaAsset>>("/currencies", apiKey, { id });
    chunks.push(...(page.data || []));
  }
  return chunks;
}

export const bitpandaApi = {
  portfolio: (apiKey: string) => request<BitpandaHolding[]>("/portfolio/holdings", apiKey),
  portfolioHistory: (apiKey: string, timeframe: "DAY" | "WEEK" | "MONTH" | "SIX_MONTH" | "YEAR" = "YEAR") => request<any>("/portfolio/history", apiKey, { timeframe }),
  operations: (apiKey: string) => paginated<BitpandaOperation>("/operations", apiKey),
  assets: (apiKey: string, ids?: string[]) => listAssets(apiKey, ids),
  currencies: (apiKey: string, ids?: string[]) => listCurrencies(apiKey, ids),
  ticker: (apiKey: string, assetId: string) => request<any>(`/assets/${encodeURIComponent(assetId)}/ticker`, apiKey),
};
