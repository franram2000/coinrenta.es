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

export type FifoAsset = {
  id: string;
  symbol: string;
  name: string;
  asset_type?: string | null;
};

export type MatchedFifoLot = {
  sourceId: string;
  acquiredAt: string;
  quantity: number;
  unitCostEur: number | null;
  costEur: number | null;
};

export type FifoLot = {
  qty: number;
  costEur: number | null;
  acquiredAt: string;
  sourceId: string;
};

export type FifoSale = {
  id: string;
  occurredAt: string;
  symbol: string;
  name: string;
  quantity: number;
  proceeds: number | null;
  costBasis: number | null;
  missingQuantity: number;
  missingCostEur?: number | null;
  reason: string;
  matchedLots?: MatchedFifoLot[];
};

export type FifoReport = {
  gain: number;
  gainKnown: boolean;
  unknownBasis: number;
  unknownQuantity: number;
  proceeds: number;
  costBasis: number;
  disposals: number;
  knownDisposals: number;
  unknownDisposals: number;
  incomeEur: number;
  incomeKnown: number;
  feesEur: number;
  cryptoFeeEvents: number;
  cryptoFeeGain: number;
  unsupported: number;
  pendingTransfers: number;
  valuationIssues: number;
  qualitySales: FifoSale[];
  lots: Map<string, FifoLot[]>;
  yearEndLots: Map<string, FifoLot[]>;
  fifoMethod: "spanish-fifo";
  processedThrough: string;
  processedTransactions: number;
};

const FIAT = new Set([
  "EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD",
  "JPY", "SGD", "CNY", "HKD", "NZD", "ZAR", "TRY", "BRL", "MXN", "INR", "KRW",
]);

/** Bitpanda Cash Plus assets. They are cash-like intermediaries, not crypto lots. */
const CASH_LIKE = new Set([
  ...FIAT,
  "BCPEUR",
  "BCPUSD",
]);

const INCOME = new Set(["reward", "interest", "dividend", "airdrop", "cashback", "income"]);
const DISPOSALS = new Set(["sell", "swap", "trade", "convert", "exchange"]);
const TRANSFER_TYPES = new Set(["deposit", "withdrawal", "transfer_in", "transfer_out", "transfer", "staking"]);
const EPS = 1e-12;
const TRANSFER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const INTERNAL_TRANSFER_WINDOW_MS = 10 * 60 * 1000;

type FxTable = Map<string, Map<string, number>>;
type TransferFragment = {
  assetId: string;
  qty: number;
  costEur: number | null;
  acquiredAt: string;
  sourceId: string;
  at: number;
  accountId: string | null;
  transferKey?: string | null;
};

function n(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function symbol(asset: FifoAsset | null | undefined) {
  return String(asset?.symbol || "").trim().toUpperCase();
}

function day(iso: string) {
  return iso.slice(0, 10);
}

function rawText(raw: Record<string, unknown> | null | undefined, names: string[]) {
  if (!raw) return "";
  for (const name of names) {
    const direct = raw[name];
    if (direct !== undefined && direct !== null && direct !== "") return String(direct);
    const row = raw.row;
    if (row && typeof row === "object") {
      const value = (row as Record<string, unknown>)[name];
      if (value !== undefined && value !== null && value !== "") return String(value);
    }
  }
  return "";
}

function normalizeType(tx: FifoTx) {
  const stored = String(tx.transaction_type || "").trim().toLowerCase();
  const raw = tx.raw_data && typeof tx.raw_data === "object" ? tx.raw_data : {};
  const original = String(
    raw.original_type ??
      raw.originalType ??
      rawText(raw, ["Transaction Type", "Type", "Operation Type"]) ??
      stored,
  )
    .trim()
    .toLowerCase();

  // Bitpanda encodes staking custody movements as transfer(stake)/transfer(unstake).
  // They are not taxable rewards and must preserve the original FIFO basis.
  if (original.includes("transfer(stake)") || original.includes("stake transfer")) return "transfer_in";
  if (original.includes("transfer(unstake)") || original.includes("unstake transfer")) return "transfer_out";
  if (stored === "staking") {
    const direction = rawText(raw, ["In/Out", "Direction"]).toLowerCase();
    return direction.includes("out") ? "transfer_out" : "transfer_in";
  }
  return stored;
}

function assetClass(tx: FifoTx) {
  const raw = tx.raw_data && typeof tx.raw_data === "object" ? tx.raw_data : {};
  return String(
    raw.assetClass ??
      raw.asset_class ??
      raw["Asset class"] ??
      rawText(raw, ["Asset class"]) ??
      "",
  )
    .trim()
    .toLowerCase();
}

function isCashLike(asset: FifoAsset | null | undefined, tx?: FifoTx) {
  const s = symbol(asset);
  if (!s) return false;
  if (asset?.asset_type === "fiat") return true;
  if (CASH_LIKE.has(s)) return true;
  const klass = tx ? assetClass(tx) : "";
  return klass === "fiat" || klass.includes("cash") || klass.includes("e-money");
}

function cashCurrency(asset: FifoAsset | null | undefined) {
  const s = symbol(asset);
  if (s === "BCPEUR") return "EUR";
  if (s === "BCPUSD") return "USD";
  return s;
}

function rawNumber(raw: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value === undefined || value === null || value === "") continue;
    const text = String(value).replace(/\s/g, "").replace(/[^\d,().+\-]/g, "");
    if (!text || text === "-") continue;
    const negative = /^\(.*\)$/.test(text);
    const cleaned = text.replace(/[()]/g, "");
    const normalized = cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "")
      : cleaned.includes(",")
        ? cleaned.replace(",", ".")
        : cleaned;
    const result = Number(normalized);
    if (Number.isFinite(result)) return negative ? -Math.abs(result) : Math.abs(result);
  }
  return null;
}

async function loadFx(currencies: string[], from: string, to: string): Promise<FxTable> {
  const wanted = [...new Set(currencies.filter((currency) => currency && currency !== "EUR"))];
  const table: FxTable = new Map();
  if (!wanted.length) return table;

  // Query each series independently. ECB may reject a combined multi-currency
  // expression; one failed currency must not invalidate the other series.
  await Promise.all(
    wanted.map(async (currency) => {
      const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${encodeURIComponent(currency)}.EUR.SP00.A?startPeriod=${from}&endPeriod=${to}&format=csvdata`;
      try {
        const response = await fetch(url, { next: { revalidate: 86400 } } as any);
        if (!response.ok) return;
        const csv = await response.text();
        const lines = csv.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return;
        const header = lines[0].split(",");
        const currencyIndex = header.indexOf("CURRENCY");
        const dateIndex = header.indexOf("TIME_PERIOD");
        const valueIndex = header.indexOf("OBS_VALUE");
        if (currencyIndex < 0 || dateIndex < 0 || valueIndex < 0) return;

        const series = new Map<string, number>();
        for (const line of lines.slice(1)) {
          const cells = line.split(",");
          const date = String(cells[dateIndex] || "");
          const value = Number(cells[valueIndex]);
          if (!date || !Number.isFinite(value) || value <= 0) continue;
          // ECB gives 1 EUR = X foreign currency. We need EUR per unit of foreign currency.
          series.set(date, 1 / value);
        }
        if (series.size) table.set(currency.toUpperCase(), series);
      } catch {
        // Missing FX never invents a tax value. Affected rows remain explicitly unknown.
      }
    }),
  );
  return table;
}

function fxFor(table: FxTable, currency: string, iso: string) {
  const code = currency.toUpperCase();
  if (code === "EUR") return 1;
  const series = table.get(code);
  if (!series) return null;
  const target = new Date(`${day(iso)}T00:00:00Z`).getTime();
  let bestDate = "";
  let bestTime = -Infinity;
  for (const date of series.keys()) {
    const time = new Date(`${date}T00:00:00Z`).getTime();
    if (time <= target && time > bestTime) {
      bestDate = date;
      bestTime = time;
    }
  }
  return bestDate ? series.get(bestDate) ?? null : null;
}

function fiatToEur(amount: number, currency: string, occurredAt: string, fx: FxTable) {
  const rate = fxFor(fx, currency, occurredAt);
  return rate == null ? null : Math.abs(amount) * rate;
}

function transactionValueEur(
  tx: FifoTx,
  base: FifoAsset | null,
  quote: FifoAsset | null,
  fx: FxTable,
) {
  const raw = tx.raw_data || {};
  const direct = rawNumber(raw, [
    "value_eur", "total_eur", "amount_eur", "fiat_amount_eur", "proceeds_eur",
    "cost_eur", "eur_value", "eurValue", "totalEur", "valueEur",
  ]);
  if (direct != null) return direct;

  const quoteAmount = Math.abs(n(tx.quote_amount));
  if (quote && isCashLike(quote, tx) && quoteAmount > EPS) {
    return fiatToEur(quoteAmount, cashCurrency(quote), tx.occurred_at, fx);
  }

  const price = Math.abs(n(tx.price));
  const priceCurrency = String(tx.price_currency || "").trim().toUpperCase();
  const baseQty = Math.abs(n(tx.base_amount));
  if (price > EPS && baseQty > EPS && priceCurrency) {
    const value = baseQty * price;
    if (priceCurrency === "EUR") return value;
    if (FIAT.has(priceCurrency)) return fiatToEur(value, priceCurrency, tx.occurred_at, fx);
  }

  const rawPrice = rawNumber(raw, ["price_eur", "asset_price_eur", "market_price_eur"]);
  if (rawPrice != null && baseQty > EPS) return baseQty * rawPrice;

  void base;
  return null;
}

function transferMetadata(tx: FifoTx) {
  const raw = tx.raw_data || {};
  const key =
    raw.transfer_id ??
    raw.transferId ??
    raw.blockchain_txid ??
    raw.txid ??
    raw.txHash ??
    raw.reference ??
    rawText(raw, ["Transaction ID", "TransactionID", "Transfer ID"]);
  return key == null || key === "" ? null : String(key);
}

function cloneLots(source: Map<string, FifoLot[]>) {
  const copy = new Map<string, FifoLot[]>();
  for (const [assetId, lots] of source) copy.set(assetId, lots.map((lot) => ({ ...lot })));
  return copy;
}

function addLot(
  lots: Map<string, FifoLot[]>,
  assetId: string,
  qty: number,
  costEur: number | null,
  acquiredAt: string,
  sourceId: string,
) {
  if (qty <= EPS) return;
  const list = lots.get(assetId) || [];
  list.push({ qty, costEur, acquiredAt, sourceId });
  lots.set(assetId, list);
}

function consumeDetailed(lots: Map<string, FifoLot[]>, assetId: string, qty: number) {
  let remaining = Math.max(0, qty);
  let knownCost = 0;
  let knownQty = 0;
  const matchedLots: MatchedFifoLot[] = [];
  const list = lots.get(assetId) || [];

  while (remaining > EPS && list.length) {
    const lot = list[0];
    const used = Math.min(remaining, lot.qty);
    const ratio = used / Math.max(lot.qty, EPS);
    const cost = lot.costEur == null ? null : lot.costEur * ratio;

    matchedLots.push({
      sourceId: lot.sourceId,
      acquiredAt: lot.acquiredAt,
      quantity: used,
      unitCostEur: lot.costEur == null ? null : lot.costEur / Math.max(lot.qty, EPS),
      costEur: cost,
    });

    if (cost != null) {
      knownCost += cost;
      knownQty += used;
    }

    lot.qty -= used;
    remaining -= used;
    if (lot.qty <= EPS) list.shift();
  }

  lots.set(assetId, list);
  return {
    remaining: Math.max(0, remaining),
    knownCost,
    knownQty,
    matchedLots,
    fullyQuantityMatched: remaining <= EPS,
    fullyCostKnown: remaining <= EPS && knownQty + EPS >= qty,
  };
}

function pushTransferFragments(pending: TransferFragment[], tx: FifoTx, assetId: string, fragments: MatchedFifoLot[]) {
  const at = new Date(tx.occurred_at).getTime();
  const transferKey = transferMetadata(tx);
  for (const fragment of fragments) {
    if (fragment.quantity <= EPS) continue;
    pending.push({
      assetId,
      qty: fragment.quantity,
      costEur: fragment.costEur,
      acquiredAt: fragment.acquiredAt,
      sourceId: fragment.sourceId,
      at,
      accountId: tx.account_id,
      transferKey,
    });
  }
}

function matchTransferIn(pending: TransferFragment[], tx: FifoTx, assetId: string, qty: number) {
  let remaining = qty;
  const fragments: Array<{ qty: number; costEur: number | null; acquiredAt: string; sourceId: string }> = [];
  let knownCost = 0;
  let knownQty = 0;
  const at = new Date(tx.occurred_at).getTime();
  const transferKey = transferMetadata(tx);

  const candidates = pending
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.assetId === assetId && part.qty > EPS)
    .sort((a, b) => {
      const ak = transferKey && a.part.transferKey === transferKey ? 0 : 1;
      const bk = transferKey && b.part.transferKey === transferKey ? 0 : 1;
      if (ak !== bk) return ak - bk;
      const ai = a.part.accountId === tx.account_id ? 0 : 1;
      const bi = b.part.accountId === tx.account_id ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return Math.abs(at - a.part.at) - Math.abs(at - b.part.at);
    });

  for (const candidate of candidates) {
    if (remaining <= EPS) break;
    const part = candidate.part;
    const explicitKeyMatch = !!transferKey && !!part.transferKey && transferKey === part.transferKey;
    const internal = part.accountId === tx.account_id;
    const distance = Math.abs(at - part.at);
    const allowed = explicitKeyMatch || distance <= (internal ? INTERNAL_TRANSFER_WINDOW_MS : TRANSFER_WINDOW_MS);
    if (!allowed) continue;

    const used = Math.min(remaining, part.qty);
    if (used <= EPS) continue;
    const ratio = used / Math.max(part.qty, EPS);
    const cost = part.costEur == null ? null : part.costEur * ratio;
    fragments.push({ qty: used, costEur: cost, acquiredAt: part.acquiredAt, sourceId: part.sourceId });
    if (cost != null) {
      knownCost += cost;
      knownQty += used;
    }
    part.qty -= used;
    remaining -= used;
  }

  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].qty <= EPS) pending.splice(i, 1);
  }

  return { remaining: Math.max(0, remaining), knownCost, knownQty, fragments };
}

function feeValueEur(tx: FifoTx, fee: FifoAsset, feeQty: number, fx: FxTable) {
  const unitPrice = Math.abs(n(tx.price));
  const priceCurrency = String(tx.price_currency || "").trim().toUpperCase();
  if (unitPrice > EPS && priceCurrency) {
    const value = feeQty * unitPrice;
    if (priceCurrency === "EUR") return value;
    if (FIAT.has(priceCurrency)) return fiatToEur(value, priceCurrency, tx.occurred_at, fx);
  }
  const raw = tx.raw_data || {};
  const rawFeePrice = rawNumber(raw, ["fee_price_eur", "fee_price", "Fee price EUR"]);
  return rawFeePrice == null ? null : feeQty * rawFeePrice;
}

function addFeeQuality(qualitySales: FifoSale[], tx: FifoTx, fee: FifoAsset, feeQty: number, reason: string) {
  qualitySales.push({
    id: `${tx.id}:fee`,
    occurredAt: tx.occurred_at,
    symbol: symbol(fee),
    name: fee.name,
    quantity: feeQty,
    proceeds: null,
    costBasis: null,
    missingQuantity: feeQty,
    missingCostEur: null,
    reason,
  });
}

function recordCryptoFee(
  tx: FifoTx,
  base: FifoAsset | null,
  quote: FifoAsset | null,
  fee: FifoAsset | null,
  feeQty: number,
  lots: Map<string, FifoLot[]>,
  inYear: boolean,
  fx: FxTable,
  qualitySales: FifoSale[],
) {
  if (!fee || feeQty <= EPS || isCashLike(fee, tx)) return { event: false, known: true, gain: 0 };
  const fs = symbol(fee);
  // Many exports report the fee in the same asset as the net trade amount.
  // Treat it as already included when it equals the received asset on a buy or
  // the consideration asset, preventing a second artificial disposal.
  if ((base && fs === symbol(base)) || (quote && fs === symbol(quote))) {
    return { event: false, known: true, gain: 0 };
  }

  const consumed = consumeDetailed(lots, fee.id, feeQty);
  const value = feeValueEur(tx, fee, feeQty, fx);
  if (!inYear) return { event: true, known: consumed.fullyCostKnown && value != null, gain: 0 };

  if (!consumed.fullyQuantityMatched) {
    addFeeQuality(qualitySales, tx, fee, feeQty, "No hay suficiente cantidad del activo de comisión para determinar su coste FIFO.");
    return { event: true, known: false, gain: 0 };
  }
  if (!consumed.fullyCostKnown || value == null) {
    addFeeQuality(qualitySales, tx, fee, feeQty, value == null
      ? "No se puede valorar en EUR la comisión pagada en cripto en la fecha de la operación."
      : "La comisión se puede valorar, pero parte de su coste FIFO no es demostrable.");
    return { event: true, known: false, gain: 0 };
  }
  return { event: true, known: true, gain: value - consumed.knownCost };
}

export async function calculateFifo(
  txs: FifoTx[],
  year: number,
  assets: Map<string, FifoAsset>,
): Promise<FifoReport> {
  const targetEnd = new Date(Date.UTC(year + 1, 0, 1));
  const targetEndMs = targetEnd.getTime();
  const processed = txs
    .filter((tx) => {
      const at = new Date(tx.occurred_at).getTime();
      return Number.isFinite(at) && at < targetEndMs;
    })
    .sort((a, b) => {
      const time = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
      if (time !== 0) return time;
      const priority = (tx: FifoTx) => {
        const type = normalizeType(tx);
        if (type === "transfer_out" || type === "withdrawal") return 10;
        if (DISPOSALS.has(type)) return 20;
        if (type === "buy" || INCOME.has(type)) return 30;
        if (type === "transfer_in" || type === "deposit") return 40;
        return 50;
      };
      return priority(a) - priority(b) || a.id.localeCompare(b.id);
    });

  const currencies = new Set<string>();
  for (const tx of processed) {
    const quote = tx.quote_asset_id ? assets.get(tx.quote_asset_id) || null : null;
    const fee = tx.fee_asset_id ? assets.get(tx.fee_asset_id) || null : null;
    const quoteCurrency = cashCurrency(quote);
    const feeCurrency = cashCurrency(fee);
    const priceCurrency = String(tx.price_currency || "").trim().toUpperCase();
    if (FIAT.has(quoteCurrency)) currencies.add(quoteCurrency);
    if (FIAT.has(feeCurrency)) currencies.add(feeCurrency);
    if (FIAT.has(priceCurrency)) currencies.add(priceCurrency);
  }

  const first = processed[0]?.occurred_at?.slice(0, 10) || `${year}-01-01`;
  const fx = await loadFx([...currencies], first, targetEnd.toISOString().slice(0, 10));

  const lots = new Map<string, FifoLot[]>();
  const pending = [] as TransferFragment[];
  const qualitySales: FifoSale[] = [];

  let gain = 0;
  let gainKnown = true;
  let unknownBasis = 0;
  let unknownQuantity = 0;
  let proceeds = 0;
  let costBasis = 0;
  let disposals = 0;
  let knownDisposals = 0;
  let unknownDisposals = 0;
  let incomeEur = 0;
  let incomeKnown = 0;
  let feesEur = 0;
  let cryptoFeeEvents = 0;
  let cryptoFeeGain = 0;
  let unsupported = 0;
  let valuationIssues = 0;

  for (const tx of processed) {
    const type = normalizeType(tx);
    const base = tx.base_asset_id ? assets.get(tx.base_asset_id) || null : null;
    const quote = tx.quote_asset_id ? assets.get(tx.quote_asset_id) || null : null;
    const fee = tx.fee_asset_id ? assets.get(tx.fee_asset_id) || null : null;
    const baseQty = Math.abs(n(tx.base_amount));
    const quoteQty = Math.abs(n(tx.quote_amount));
    const feeQty = Math.abs(n(tx.fee_amount));
    const inYear = new Date(tx.occurred_at).getUTCFullYear() === year;

    if (!base || baseQty <= EPS) {
      if (type === "fee" && fee && feeQty > EPS && !isCashLike(fee, tx)) {
        const feeResult = recordCryptoFee(tx, base, quote, fee, feeQty, lots, inYear, fx, qualitySales);
        if (feeResult.event) cryptoFeeEvents++;
        if (inYear && feeResult.known) cryptoFeeGain += feeResult.gain;
        if (inYear && !feeResult.known) gainKnown = false;
      }
      continue;
    }

    if (type === "fee") {
      if (fee && feeQty > EPS && !isCashLike(fee, tx)) {
        const feeResult = recordCryptoFee(tx, base, quote, fee, feeQty, lots, inYear, fx, qualitySales);
        if (feeResult.event) cryptoFeeEvents++;
        if (inYear && feeResult.known) cryptoFeeGain += feeResult.gain;
        if (inYear && !feeResult.known) gainKnown = false;
      }
      continue;
    }

    if (isCashLike(base, tx)) {
      // Cash and Bitpanda Cash Plus movements are never crypto capital gains.
      continue;
    }

    if (TRANSFER_TYPES.has(type)) {
      if (type === "transfer_out" || type === "withdrawal") {
        const consumed = consumeDetailed(lots, base.id, baseQty);
        pushTransferFragments(pending, tx, base.id, consumed.matchedLots);
        if (consumed.remaining > EPS) {
          pending.push({
            assetId: base.id,
            qty: consumed.remaining,
            costEur: null,
            acquiredAt: tx.occurred_at,
            sourceId: tx.id,
            at: new Date(tx.occurred_at).getTime(),
            accountId: tx.account_id,
            transferKey: transferMetadata(tx),
          });
        }
        continue;
      }

      if (type === "transfer_in" || type === "deposit" || type === "transfer") {
        const matched = matchTransferIn(pending, tx, base.id, baseQty);
        for (const fragment of matched.fragments) {
          addLot(lots, base.id, fragment.qty, fragment.costEur, fragment.acquiredAt, fragment.sourceId);
        }
        if (matched.remaining > EPS) {
          // External deposit with no known outgoing leg: preserve quantity but do not invent basis.
          addLot(lots, base.id, matched.remaining, null, tx.occurred_at, tx.id);
        }
        continue;
      }
    }

    if (INCOME.has(type)) {
      const valueEur = transactionValueEur(tx, base, quote, fx);
      if (inYear && valueEur != null) {
        incomeEur += valueEur;
        incomeKnown++;
      }
      addLot(lots, base.id, baseQty, valueEur, tx.occurred_at, tx.id);
      continue;
    }

    if (type === "expense") continue;

    if (type === "buy") {
      const valueEur = transactionValueEur(tx, base, quote, fx);
      if (quote && !isCashLike(quote, tx) && quoteQty > EPS) {
        // Some exchanges export crypto-to-crypto acquisitions as "buy".
        const consumed = consumeDetailed(lots, quote.id, quoteQty);
        if (inYear) {
          disposals++;
          if (valueEur != null && consumed.fullyCostKnown) {
            knownDisposals++;
            costBasis += consumed.knownCost;
            gain += valueEur - consumed.knownCost;
          } else {
            unknownDisposals++;
            unknownBasis++;
            unknownQuantity += consumed.remaining > EPS ? consumed.remaining : Math.max(0, quoteQty - consumed.knownQty);
            gainKnown = false;
          }
        }
      }
      const acquisitionFeeEur = fee && isCashLike(fee, tx) && feeQty > EPS
        ? fiatToEur(feeQty, cashCurrency(fee), tx.occurred_at, fx)
        : 0;
      if (valueEur != null) {
        addLot(lots, base.id, baseQty, valueEur + (acquisitionFeeEur || 0), tx.occurred_at, tx.id);
      } else {
        addLot(lots, base.id, baseQty, null, tx.occurred_at, tx.id);
      }

      if (fee && !isCashLike(fee, tx) && feeQty > EPS) {
        const feeResult = recordCryptoFee(tx, base, quote, fee, feeQty, lots, inYear, fx, qualitySales);
        if (feeResult.event) cryptoFeeEvents++;
        if (inYear && feeResult.known) cryptoFeeGain += feeResult.gain;
        if (inYear && !feeResult.known) gainKnown = false;
      }
      continue;
    }

    if (DISPOSALS.has(type)) {
      const valueEur = transactionValueEur(tx, base, quote, fx);
      const quoteIsCrypto = !!quote && !isCashLike(quote, tx);

      if (valueEur == null) {
        if (inYear) {
          valuationIssues++;
          unsupported++;
          qualitySales.push({
            id: tx.id,
            occurredAt: tx.occurred_at,
            symbol: symbol(base),
            name: base.name,
            quantity: baseQty,
            proceeds: null,
            costBasis: null,
            missingQuantity: 0,
            missingCostEur: null,
            reason: quoteIsCrypto
              ? "La permuta tiene contraprestación en cripto, pero no hay una valoración EUR demostrable en la fecha de la operación."
              : "La contraprestación no está suficientemente identificada o valorada en EUR.",
          });
        }
        continue;
      }

      const consumed = consumeDetailed(lots, base.id, baseQty);
      const feeEur = fee && isCashLike(fee, tx) && feeQty > EPS
        ? fiatToEur(feeQty, cashCurrency(fee), tx.occurred_at, fx)
        : null;
      const netProceeds = feeEur == null ? valueEur : Math.max(0, valueEur - feeEur);

      if (inYear) {
        disposals++;
        proceeds += netProceeds;
        if (consumed.fullyCostKnown) {
          knownDisposals++;
          costBasis += consumed.knownCost;
          gain += netProceeds - consumed.knownCost;
        } else {
          unknownDisposals++;
          unknownBasis++;
          unknownQuantity += consumed.remaining > EPS
            ? consumed.remaining
            : Math.max(0, baseQty - consumed.knownQty);
          gainKnown = false;
          qualitySales.push({
            id: tx.id,
            occurredAt: tx.occurred_at,
            symbol: symbol(base),
            name: base.name,
            quantity: baseQty,
            proceeds: netProceeds,
            costBasis: consumed.knownQty > EPS ? consumed.knownCost : null,
            missingQuantity: consumed.remaining > EPS
              ? consumed.remaining
              : Math.max(0, baseQty - consumed.knownQty),
            missingCostEur: null,
            reason: consumed.remaining > EPS
              ? "No hay suficiente cantidad adquirida antes de la transmisión para cubrir el lote FIFO."
              : "Una parte del lote FIFO no tiene coste de adquisición demostrable.",
            matchedLots: consumed.matchedLots,
          });
        }
      }

      if (quoteIsCrypto && tx.quote_asset_id && quoteQty > EPS) {
        addLot(lots, tx.quote_asset_id, quoteQty, valueEur, tx.occurred_at, tx.id);
      }

      if (fee && !isCashLike(fee, tx) && feeQty > EPS) {
        const feeResult = recordCryptoFee(tx, base, quote, fee, feeQty, lots, inYear, fx, qualitySales);
        if (feeResult.event) cryptoFeeEvents++;
        if (inYear && feeResult.known) cryptoFeeGain += feeResult.gain;
        if (inYear && !feeResult.known) gainKnown = false;
      }
      continue;
    }

    if (type !== "unknown" && type !== "other") unsupported++;
  }

  // Crypto fee gains are disposals from the perspective of the asset paid as fee.
  // They are kept separate from the main trade proceeds/cost columns but included in gain.
  if (cryptoFeeEvents > 0) {
    gain += cryptoFeeGain;
    if (qualitySales.some((sale) => sale.id.endsWith(":fee"))) gainKnown = false;
  }

  const yearEndLots = cloneLots(lots);
  return {
    gain,
    gainKnown,
    unknownBasis,
    unknownQuantity,
    proceeds,
    costBasis,
    disposals,
    knownDisposals,
    unknownDisposals,
    incomeEur,
    incomeKnown,
    feesEur,
    cryptoFeeEvents,
    cryptoFeeGain,
    unsupported,
    pendingTransfers: pending.filter((part) => part.qty > EPS).length,
    valuationIssues,
    qualitySales,
    lots,
    yearEndLots,
    fifoMethod: "spanish-fifo",
    processedThrough: targetEnd.toISOString(),
    processedTransactions: processed.length,
  };
}
