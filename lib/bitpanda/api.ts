const API_BASE = "https://api.bitpanda.com/v1";
const TICKER_BASE = "https://developer.bitpanda.com/v1";

type Page<T> = { data: T[]; meta?: { next_cursor?: string; page_size?: number } };

export type BitpandaRecord = { id: string; type?: string; attributes: Record<string, any> };

async function request<T>(base: string, path: string, apiKey: string, params?: Record<string,string|number|undefined>): Promise<T> {
  const url = new URL(`${base}${path}`);
  for (const [key,value] of Object.entries(params || {})) if (value !== undefined && value !== "") url.searchParams.set(key,String(value));
  const response = await fetch(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Bitpanda API ${response.status}: ${body.slice(0,240)}`);
  }
  return response.json() as Promise<T>;
}

async function paginated(path: string, apiKey: string, params?: Record<string,string|number|undefined>) {
  const all: BitpandaRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await request<Page<BitpandaRecord>>(API_BASE, path, apiKey, { ...params, page_size: 500, cursor });
    all.push(...(page.data || []));
    cursor = page.meta?.next_cursor;
    if (!cursor || !page.data?.length) break;
  } while (all.length < 100000);
  return all;
}

export const bitpandaApi = {
  trades: (key: string) => paginated("/trades", key),
  cryptoWallets: (key: string) => request<Page<BitpandaRecord>>(API_BASE, "/wallets", key).then(r => r.data || []),
  assetWallets: (key: string) => request<any>(API_BASE, "/asset-wallets", key),
  fiatWallets: (key: string) => request<Page<BitpandaRecord>>(API_BASE, "/fiatwallets", key).then(r => r.data || []),
  cryptoTransactions: (key: string) => paginated("/wallets/transactions", key),
  fiatTransactions: (key: string) => paginated("/fiatwallets/transactions", key),
  commodityTransactions: (key: string) => paginated("/assets/transactions/commodity", key),
  ticker: (key: string) => paginatedFromTicker("/ticker", key),
};

async function paginatedFromTicker(path: string, apiKey: string) {
  const all: BitpandaRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await request<{data: BitpandaRecord[]; next_cursor?: string; has_next_page?: boolean}>(TICKER_BASE, path, apiKey, { page_size: 500, cursor });
    all.push(...(page.data || []));
    cursor = page.next_cursor;
    if (!page.has_next_page || !cursor || !page.data?.length) break;
  } while (all.length < 10000);
  return all;
}
