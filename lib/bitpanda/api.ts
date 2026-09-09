const API_BASE = "https://api.public.bitpanda.com/v1";

 type Page<T> = { data?: T[]; cursor?: string; next_cursor?: string; nextCursor?: string; selfCursor?: string; has_next_page?: boolean; hasNextPage?: boolean };
type CurrencyResponse = BitpandaAsset[] | { data?: BitpandaAsset[] };

export type BitpandaAsset = { id: string; symbol?: string; name?: string; isin?: string; type?: string; group?: string };
export type BitpandaHolding = { assetId?: string; asset_id?: string; quantity?: string; value?: string; balance?: { value?: string }; equivalentCurrencyId?: string };
export type BitpandaOperationTransaction = { transaction_id?: string; transactionId?: string; asset_id?: string; assetId?: string; currency_id?: string; currencyId?: string; wallet_id?: string; walletId?: string; asset_amount?: { value?: string }; assetAmount?: { value?: string }; amount?: string; fee_amount?: { value?: string; asset_id?: string; currency_id?: string }; feeAmount?: { value?: string; asset_id?: string; currency_id?: string }; transaction_type?: string; transactionType?: string; flow?: string; credited_at?: string; creditedAt?: string; timestamp?: string; asset_balance_after?: { value?: string }; assetBalanceAfter?: { value?: string }; trade?: { rate?: string; rate_with_fee?: string; rateWithFee?: string; to_eur_rate?: string; toEurRate?: string } };
export type BitpandaOperation = { operation_id?: string; operationId?: string; operation_type?: string; operationType?: string; timestamp?: string; transactions?: BitpandaOperationTransaction[]; assetId?: string; amount?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const requestQueues = new Map<string, Promise<void>>();
const lastRequestAt = new Map<string, number>();
const MIN_REQUEST_INTERVAL_MS = 250;

async function waitForRateLimit(apiKey: string) {
  const previous = requestQueues.get(apiKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  requestQueues.set(apiKey, previous.then(() => current));
  await previous;
  const elapsed = Date.now() - (lastRequestAt.get(apiKey) || 0);
  if (elapsed < MIN_REQUEST_INTERVAL_MS) await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  lastRequestAt.set(apiKey, Date.now());
  release();
}

function errorDetail(body: string, fallback: string) {
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const value = parsed as Record<string, unknown>;
      const candidate = value.message ?? value.error ?? value.detail ?? value.title ?? value.errors;
      if (typeof candidate === "string") return candidate;
      if (candidate !== undefined) return JSON.stringify(candidate);
      return JSON.stringify(parsed);
    }
  } catch {}
  return body.slice(0, 500);
}

async function request<T>(path: string, apiKey: string, params?: Record<string, string | number | undefined>, attempts = 4): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params || {})) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));

  for (let attempt = 0; attempt < attempts; attempt++) {
    await waitForRateLimit(apiKey);
    const response = await fetch(url, { method: "GET", headers: { "x-api-key": apiKey, Accept: "application/json" }, cache: "no-store" });
    if (response.ok) return response.json() as Promise<T>;

    const body = await response.text().catch(() => "");
    const detail = errorDetail(body, response.statusText || "Sin detalle");
    if (response.status === 429 && attempt < attempts - 1) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(5000 * 2 ** attempt, 60000);
      await sleep(delay);
      continue;
    }
    if (response.status === 429) {
      throw new Error(`Bitpanda API 429: límite de peticiones alcanzado. ${detail}`);
    }
    throw new Error(`Bitpanda API ${response.status}: ${detail}`);
  }
  throw new Error("Bitpanda API: no se pudo completar la petición");
}

function pageData<T>(page: Page<T> | T[]): T[] { return Array.isArray(page) ? page : page.data || []; }

async function paginated<T>(path: string, apiKey: string, extra?: Record<string, string | number | undefined>, limit = 100000): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await request<Page<T> | T[]>(path, apiKey, { ...extra, page_size: 100, cursor });
    const data = pageData(page);
    rows.push(...data);
    if (Array.isArray(page)) break;
    cursor = page.next_cursor || page.nextCursor || undefined;
    const hasNext = page.has_next_page ?? page.hasNextPage;
    if (!cursor || !data.length || hasNext === false) break;
  } while (rows.length < limit);
  return rows;
}

export async function listAssets(apiKey: string, ids?: string[]) {
  if (!ids?.length) return paginated<BitpandaAsset>("/assets", apiKey);
  const unique = [...new Set(ids.filter(Boolean))];
  const assets: BitpandaAsset[] = [];
  for (const id of unique) {
    const page = await request<Page<BitpandaAsset> | BitpandaAsset[]>("/assets", apiKey, { id });
    assets.push(...pageData(page));
  }
  return assets;
}

export async function listCurrencies(apiKey: string, ids?: string[]) {
  if (ids?.length) {
    const unique = [...new Set(ids.filter(Boolean))];
    const currencies: BitpandaAsset[] = [];
    for (const id of unique) {
      const response = await request<CurrencyResponse>("/currencies", apiKey, { id });
      currencies.push(...(Array.isArray(response) ? response : response?.data || []));
    }
    return currencies;
  }
  const response = await request<CurrencyResponse>("/currencies", apiKey);
  return Array.isArray(response) ? response : response?.data || [];
}

export const bitpandaApi = {
  portfolio: (apiKey: string) => request<BitpandaHolding[] | { data?: BitpandaHolding[] }>("/portfolio/holdings", apiKey),
  portfolioHistory: (apiKey: string, timeframe: "DAY" | "WEEK" | "MONTH" | "SIX_MONTH" | "YEAR" = "YEAR") => request<any>("/portfolio-history", apiKey, { timeframe }),
  operations: (apiKey: string) => paginated<BitpandaOperation>("/operations", apiKey),
  assets: (apiKey: string, ids?: string[]) => listAssets(apiKey, ids),
  currencies: (apiKey: string, ids?: string[]) => listCurrencies(apiKey, ids),
  ticker: (apiKey: string, assetId: string) => request<any>(`/assets/${encodeURIComponent(assetId)}/ticker`, apiKey),
};
