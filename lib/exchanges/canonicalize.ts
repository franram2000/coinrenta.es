import type { NormalizedMovement } from "./csv";

const FIAT = new Set([
  "EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD",
  "CNY", "HKD", "NZD", "ZAR", "TRY", "BRL", "MXN", "INR", "KRW",
]);

const CRYPTO_QUOTES = new Set(["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "BTC", "ETH", "BNB"]);

type CanonicalRaw = NormalizedMovement["raw"] & Record<string, unknown>;
const normalizeAsset = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
const normalizeType = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

function raw(movement: NormalizedMovement, names: string[]) {
  const source = movement.raw?.row || {};
  for (const name of names) {
    const direct = (movement.raw as Record<string, unknown> | undefined)?.[name];
    if (direct !== undefined && direct !== null && direct !== "") return String(direct);
    const value = source[name];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  const normalized = new Map(Object.entries(source).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(value ?? "").trim()]));
  for (const name of names) {
    const value = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (value) return value;
  }
  return "";
}

function inferType(movement: NormalizedMovement) {
  const original = normalizeType(movement.originalType);
  const description = normalizeType(raw(movement, ["Description", "Notes", "Remark", "Details", "Subtype", "Sub Type", "Activity"]));
  const combined = `${original} ${description}`;
  const direction = raw(movement, ["In/Out", "Direction", "Flow", "Cash Flow"]).toLowerCase();

  if (/transfer\s*\(stake\)|transfer_?stake|stake\s*transfer/.test(combined)) return "transfer_in";
  if (/transfer\s*\(unstake\)|transfer_?unstake|unstake\s*transfer/.test(combined)) return "transfer_out";
  if (/^staking$|^stake$|staking_?allocation/.test(original)) return /out|debit|withdraw/.test(direction) ? "transfer_out" : "transfer_in";
  if (/^buy$|purchase|bought|compra|adquir/.test(combined)) return "buy";
  if (/^sell$|sold|venta|vend/.test(combined)) return "sell";
  if (/swap|convert|conversion|trade|exchange|convertir/.test(combined)) return "trade";
  if (/withdraw|cash_?out|retirada|debit/.test(combined)) return "withdrawal";
  if (/deposit|cash_?in|entrada|received|receive/.test(combined)) return "deposit";
  if (/reward|bonus|referral|airdrop|fork|cashback/.test(combined)) return /cashback/.test(combined) ? "cashback" : "reward";
  if (/interest|yield|interes/.test(combined)) return "interest";
  if (/dividend|dividendo|income/.test(combined)) return "income";
  if (/fee|commission|comision|comisión/.test(combined)) return "fee";
  if (/card.*payment|payment.*card|pago.*tarjeta|spend|expense/.test(combined)) return "expense";
  if (/out|debit|salida/.test(direction)) return "withdrawal";
  if (/in|credit|entrada/.test(direction)) return "deposit";
  return movement.transactionType || "other";
}

function isCashProxy(asset: string | null) {
  const code = normalizeAsset(asset);
  return FIAT.has(code) || code === "BCPEUR" || code === "BCPUSD";
}

function pairFromRaw(movement: NormalizedMovement) {
  const pair = raw(movement, ["Pair", "Market", "Symbol", "Trading Pair"]);
  const base = normalizeAsset(raw(movement, ["Base Asset", "Base Coin"]));
  const quote = normalizeAsset(raw(movement, ["Quote Asset", "Quote Coin"]));
  if (base && quote) return { base, quote };
  const normalizedPair = pair.replace(/[\s_\/-]/g, "").toUpperCase();
  for (const quoteCandidate of ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "EUR", "USD", "GBP", "TRY", "BRL", "AUD", "CAD", "JPY", "CHF", "BTC", "ETH", "BNB"]) {
    if (normalizedPair.endsWith(quoteCandidate) && normalizedPair.length > quoteCandidate.length) {
      return { base: normalizedPair.slice(0, -quoteCandidate.length), quote: quoteCandidate };
    }
  }
  return { base: "", quote: "" };
}

export function canonicalizeNormalizedMovement(movement: NormalizedMovement, exchange: string): NormalizedMovement {
  const next = { ...movement, raw: { ...movement.raw } };
  const type = inferType(movement);
  const pair = pairFromRaw(movement);
  const currentBase = normalizeAsset(next.baseAsset);
  const currentFee = normalizeAsset(next.feeAsset);

  next.transactionType = type;
  next.originalType = movement.originalType || type;

  if (/transfer\s*\(stake\)/i.test(movement.originalType) || /transfer\s*\(unstake\)/i.test(movement.originalType)) {
    const direction = raw(movement, ["In/Out", "Direction", "Flow"]).toLowerCase();
    next.transactionType = /unstake|out|debit/.test(`${movement.originalType} ${direction}`.toLowerCase()) ? "transfer_out" : "transfer_in";
  }

  if ((!next.baseAsset || next.baseAmount === null) && pair.base) next.baseAsset = pair.base;
  if (!next.quoteAsset && pair.quote && CRYPTO_QUOTES.has(pair.quote)) next.quoteAsset = pair.quote;

  const rawData = next.raw as CanonicalRaw;
  if (exchange.toLowerCase() === "bitpanda" && (currentBase === "BCPEUR" || currentBase === "BCPUSD")) {
    rawData.cash_like = true;
    rawData.cash_currency = currentBase === "BCPEUR" ? "EUR" : "USD";
  }

  const classificationNeedsReview =
    !next.occurredAt ||
    !Number.isFinite(new Date(next.occurredAt).getTime()) ||
    (!next.baseAsset && !next.quoteAsset) ||
    (next.baseAmount === null && next.quoteAmount === null && next.feeAmount === null);

  const cashAsset = Boolean(next.baseAsset && isCashProxy(next.baseAsset));
  next.classification = classificationNeedsReview ? "needs_review" : movement.classification;

  rawData.canonical_exchange = exchange.toLowerCase();
  rawData.canonical_type = next.transactionType;
  rawData.canonical_cash_asset = cashAsset;
  rawData.canonical_pair_base = pair.base || null;
  rawData.canonical_pair_quote = pair.quote || null;
  rawData.canonical_fee_asset = currentFee || null;
  next.raw = rawData;

  return next;
}

export function canonicalizeNormalizedMovements(movements: NormalizedMovement[], exchange: string) {
  return movements.map((movement) => canonicalizeNormalizedMovement(movement, exchange));
}
