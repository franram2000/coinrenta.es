export type FifoTx = {
  id: string;
  occurred_at: string;
  transaction_type: string | null;
  base_asset_id: string | null;
  base_amount: number | string | null;
  quote_asset_id: string | null;
  quote_amount: number | string | null;
  fee_asset_id: string | null;
  fee_amount: number | string | null;
  price: number | string | null;
  price_currency: string | null;
  account_id: string | null;
  raw_data?: Record<string, unknown> | null;
};

export type FifoAsset = { id: string; symbol: string; name: string; asset_type?: string | null };
export type FifoLot = { qty: number; costEur: number | null; acquiredAt: string; sourceId: string };
export type FifoSale = {
  id: string;
  occurredAt: string;
  symbol: string;
  name: string;
  quantity: number;
  proceeds: number | null;
  costBasis: number | null;
  missingQuantity: number;
  reason: string;
};
export type FifoReport = {
  gain: number;
  gainKnown: boolean;
  unknownBasis: number;
  proceeds: number;
  costBasis: number;
  disposals: number;
  incomeEur: number;
  incomeKnown: number;
  feesEur: number;
  cryptoFeeEvents: number;
  unsupported: number;
  qualitySales: FifoSale[];
  lots: Map<string, FifoLot[]>;
};

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD", "CNY", "HKD", "NZD", "ZAR", "TRY", "BRL", "MXN", "INR", "KRW"]);
const INCOME = new Set(["reward", "interest", "dividend", "airdrop", "cashback", "staking", "income"]);
const TRANSFERS = new Set(["deposit", "withdrawal", "transfer_in", "transfer_out", "transfer"]);
const DISPOSALS = new Set(["sell", "swap", "trade", "convert", "exchange"]);
const EPS = 1e-10;

type FxTable = Map<string, Map<string, number>>;

function n(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
function symbol(asset: FifoAsset | null | undefined) { return String(asset?.symbol || "").trim().toUpperCase(); }
function day(iso: string) { return iso.slice(0, 10); }
function isFiat(asset: FifoAsset | null | undefined) { const s = symbol(asset); return !!s && (asset?.asset_type === "fiat" || FIAT.has(s)); }
function rawNumber(raw: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value === undefined || value === null || value === "") continue;
    const result = Number(String(value).replace(/[^0-9,.-]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
    if (Number.isFinite(result)) return Math.abs(result);
  }
  return null;
}

async function loadFx(currencies: string[], from: string, to: string): Promise<FxTable> {
  const wanted = currencies.filter((currency) => currency !== "EUR");
  const table: FxTable = new Map();
  if (!wanted.length) return table;
  const key = wanted.join("+");
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${key}.EUR.SP00.A?startPeriod=${from}&endPeriod=${to}&format=csvdata`;
  try {
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) return table;
    const csv = await response.text();
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return table;
    const header = lines[0].split(",");
    const currencyIndex = header.indexOf("CURRENCY");
    const dateIndex = header.indexOf("TIME_PERIOD");
    const valueIndex = header.indexOf("OBS_VALUE");
    if (currencyIndex < 0 || dateIndex < 0 || valueIndex < 0) return table;
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      const currency = String(cells[currencyIndex] || "").toUpperCase();
      const date = cells[dateIndex];
      const value = Number(cells[valueIndex]);
      if (!currency || !date || !Number.isFinite(value) || value <= 0) continue;
      if (!table.has(currency)) table.set(currency, new Map());
      table.get(currency)!.set(date, 1 / value);
    }
  } catch {
    // A missing FX source must never invent a cost. The caller will mark it as unknown.
  }
  return table;
}

function fxFor(table: FxTable, currency: string, iso: string) {
  if (currency === "EUR") return 1;
  const series = table.get(currency);
  if (!series) return null;
  const target = new Date(`${day(iso)}T00:00:00Z`).getTime();
  let best: { date: string; rate: number } | null = null;
  for (const [date, rate] of series.entries()) {
    const time = new Date(`${date}T00:00:00Z`).getTime();
    if (time <= target && (!best || time > new Date(`${best.date}T00:00:00Z`).getTime())) best = { date, rate };
  }
  return best?.rate ?? null;
}

function fiatToEur(amount: number, currency: string, occurredAt: string, fx: FxTable) {
  const code = currency.toUpperCase();
  const rate = fxFor(fx, code, occurredAt);
  return rate == null ? null : Math.abs(amount) * rate;
}

function transactionValueEur(tx: FifoTx, base: FifoAsset | null, quote: FifoAsset | null, fx: FxTable) {
  const quoteAmount = Math.abs(n(tx.quote_amount));
  const quoteSymbol = symbol(quote);
  const price = Math.abs(n(tx.price));
  const priceCurrency = String(tx.price_currency || "").trim().toUpperCase();
  const raw = tx.raw_data || {};
  const direct = rawNumber(raw, ["value_eur", "total_eur", "amount_eur", "fiat_amount_eur", "proceeds_eur", "cost_eur"]);
  if (direct != null) return direct;
  if (quote && isFiat(quote) && quoteAmount > 0) return fiatToEur(quoteAmount, quoteSymbol, tx.occurred_at, fx);
  if (price > 0 && priceCurrency) {
    const value = Math.abs(n(tx.base_amount)) * price;
    if (priceCurrency === "EUR") return value;
    if (FIAT.has(priceCurrency)) return fiatToEur(value, priceCurrency, tx.occurred_at, fx);
  }
  const rawPrice = rawNumber(raw, ["price_eur", "asset_price_eur", "market_price_eur"]);
  if (rawPrice != null && n(tx.base_amount) !== 0) return Math.abs(n(tx.base_amount)) * rawPrice;
  void base;
  return null;
}

function addLot(lots: Map<string, FifoLot[]>, assetId: string, qty: number, costEur: number | null, tx: FifoTx) {
  if (qty <= EPS) return;
  const list = lots.get(assetId) || [];
  list.push({ qty, costEur, acquiredAt: tx.occurred_at, sourceId: tx.id });
  lots.set(assetId, list);
}

function consume(lots: Map<string, FifoLot[]>, assetId: string, qty: number) {
  let remaining = Math.max(0, qty);
  let cost = 0;
  let knownQty = 0;
  const list = lots.get(assetId) || [];
  while (remaining > EPS && list.length) {
    const lot = list[0];
    const used = Math.min(remaining, lot.qty);
    if (lot.costEur != null) {
      cost += lot.costEur * (used / Math.max(lot.qty, EPS));
      knownQty += used;
    }
    lot.qty -= used;
    remaining -= used;
    if (lot.qty <= EPS) list.shift();
  }
  lots.set(assetId, list);
  return { remaining, cost, knownQty, fullyKnown: remaining <= EPS && knownQty + EPS >= qty };
}

export async function calculateFifo(txs: FifoTx[], year: number, assets: Map<string, FifoAsset>): Promise<FifoReport> {
  const sorted = [...txs].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime() || a.id.localeCompare(b.id));
  const currencies = new Set<string>();
  for (const tx of sorted) {
    const quote = tx.quote_asset_id ? assets.get(tx.quote_asset_id) : null;
    const quoteSymbol = symbol(quote);
    const priceCurrency = String(tx.price_currency || "").trim().toUpperCase();
    if (FIAT.has(quoteSymbol)) currencies.add(quoteSymbol);
    if (FIAT.has(priceCurrency)) currencies.add(priceCurrency);
  }
  const first = sorted[0]?.occurred_at?.slice(0, 10) || `${year}-01-01`;
  const last = sorted[sorted.length - 1]?.occurred_at?.slice(0, 10) || `${year}-12-31`;
  const fx = await loadFx([...currencies], first, last);

  const lots = new Map<string, FifoLot[]>();
  const sales: FifoSale[] = [];
  let gain = 0, proceeds = 0, costBasis = 0, unknownBasis = 0, disposals = 0;
  let incomeEur = 0, incomeKnown = 0, feesEur = 0, cryptoFeeEvents = 0, unsupported = 0;
  let gainKnown = true;

  const transferOut = new Map<string, { costEur: number | null; qty: number; at: number }>();

  for (const tx of sorted) {
    const type = String(tx.transaction_type || "").trim().toLowerCase();
    const base = tx.base_asset_id ? assets.get(tx.base_asset_id) || null : null;
    const quote = tx.quote_asset_id ? assets.get(tx.quote_asset_id) || null : null;
    const fee = tx.fee_asset_id ? assets.get(tx.fee_asset_id) || null : null;
    const baseQty = Math.abs(n(tx.base_amount));
    const quoteQty = Math.abs(n(tx.quote_amount));
    const feeQty = Math.abs(n(tx.fee_amount));
    const inYear = new Date(tx.occurred_at).getUTCFullYear() === year;

    if (feeQty > EPS && fee) {
      if (isFiat(fee)) {
        const feeEur = fiatToEur(feeQty, symbol(fee), tx.occurred_at, fx);
        if (inYear && feeEur != null) feesEur += feeEur;
        else if (inYear) feesEur += 0;
      } else if (inYear) cryptoFeeEvents++;
    }

    if (!base || baseQty <= EPS) continue;

    if (type === "buy") {
      const cost = transactionValueEur(tx, base, quote, fx);
      addLot(lots, base.id, baseQty, cost, tx);
      continue;
    }

    if (INCOME.has(type)) {
      const value = transactionValueEur(tx, base, quote, fx);
      if (inYear && value != null) { incomeEur += value; incomeKnown++; }
      addLot(lots, base.id, baseQty, value, tx);
      continue;
    }

    if (TRANSFERS.has(type)) {
      if (type === "transfer_out" || type === "withdrawal") {
        const consumed = consume(lots, base.id, baseQty);
        if (consumed.remaining <= EPS) {
          transferOut.set(`${base.id}:${baseQty.toFixed(12)}`, { costEur: consumed.fullyKnown ? consumed.cost : null, qty: baseQty, at: new Date(tx.occurred_at).getTime() });
        }
      } else if (type === "transfer_in" || type === "deposit" || type === "transfer") {
        const key = `${base.id}:${baseQty.toFixed(12)}`;
        const previous = transferOut.get(key);
        const withinWindow = previous && Math.abs(new Date(tx.occurred_at).getTime() - previous.at) <= 14 * 86400000;
        addLot(lots, base.id, baseQty, withinWindow ? previous!.costEur : null, tx);
        if (withinWindow) transferOut.delete(key);
      }
      continue;
    }

    if (type === "fee") {
      if (fee && feeQty > EPS && !isFiat(fee)) consume(lots, fee.id, feeQty);
      continue;
    }

    if (type === "expense") continue;

    if (DISPOSALS.has(type)) {
      const valueEur = transactionValueEur(tx, base, quote, fx);
      const consumed = consume(lots, base.id, baseQty);
      const quoteIsFiat = isFiat(quote);
      const quoteIsCrypto = !!quote && !quoteIsFiat;

      if (quoteIsCrypto && valueEur == null) {
        if (inYear) {
          unsupported++;
          sales.push({ id: tx.id, occurredAt: tx.occurred_at, symbol: symbol(base), name: base.name, quantity: baseQty, proceeds: null, costBasis: consumed.knownQty > EPS ? consumed.cost : null, missingQuantity: Math.max(consumed.remaining, 0), reason: "La permuta tiene contraprestación identificada, pero no hay una valoración EUR demostrable para calcularla." });
        }
        continue;
      }

      if (valueEur == null) {
        if (inYear) {
          unsupported++;
          sales.push({ id: tx.id, occurredAt: tx.occurred_at, symbol: symbol(base), name: base.name, quantity: baseQty, proceeds: null, costBasis: consumed.knownQty > EPS ? consumed.cost : null, missingQuantity: Math.max(consumed.remaining, 0), reason: "La contraprestación no está suficientemente identificada o valorada en EUR." });
        }
        continue;
      }

      // A sale/permuta consumes the oldest lots first. This is the Spanish FIFO rule.
      if (inYear) {
        disposals++;
        proceeds += valueEur;
        if (consumed.fullyKnown) {
          costBasis += consumed.cost;
          gain += valueEur - consumed.cost;
        } else {
          gainKnown = false;
          unknownBasis++;
          const missing = Math.max(consumed.remaining, baseQty - consumed.knownQty);
          sales.push({ id: tx.id, occurredAt: tx.occurred_at, symbol: symbol(base), name: base.name, quantity: baseQty, proceeds: valueEur, costBasis: consumed.knownQty > EPS ? consumed.cost : null, missingQuantity: missing, reason: consumed.remaining > EPS ? "No hay suficiente cantidad adquirida antes de la venta para cubrir el lote FIFO." : "Una parte del lote FIFO tiene un coste de adquisición no demostrable." });
        }
      }

      // For crypto-to-crypto swaps, the received asset becomes a new lot at the EUR value of the exchange.
      if (quoteIsCrypto && tx.quote_asset_id && quoteQty > EPS) {
        addLot(lots, tx.quote_asset_id, quoteQty, valueEur, tx);
      }
      continue;
    }

    if (inYear && type !== "unknown" && type !== "other") unsupported++;
  }

  return { gain, gainKnown, unknownBasis, proceeds, costBasis, disposals, incomeEur, incomeKnown, feesEur, cryptoFeeEvents, unsupported, qualitySales: sales, lots };
}
