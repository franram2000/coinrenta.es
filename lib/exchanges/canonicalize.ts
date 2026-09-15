import type { NormalizedMovement } from "./csv";

const FIAT = new Set([
  "EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD",
  "CNY", "HKD", "NZD", "ZAR", "TRY", "BRL", "MXN", "INR", "KRW",
]);

const CRYPTO_QUOTES = new Set([
  "USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "BTC", "ETH", "BNB", "SOL", "XRP", "ADA",
]);

export type ReviewIssueSeverity = "info" | "warning" | "blocking";
export type ReviewIssue = {
  code: string;
  severity: ReviewIssueSeverity;
  message: string;
  field?: string;
  hint?: string;
};

type CanonicalRaw = NormalizedMovement["raw"] & Record<string, unknown>;
const normalizeAsset = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
const normalizeType = (value: unknown) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()\[\],.:/]+/g, " ").replace(/\s+/g, "_");
const normalizedText = (value: unknown) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()\[\],.:/]+/g, " ").replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

function raw(movement: NormalizedMovement, names: string[]) {
  const source = movement.raw?.row || {};
  const directSource = movement.raw as Record<string, unknown> | undefined;
  for (const name of names) {
    const direct = directSource?.[name];
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
  const original = normalizedText(movement.originalType);
  const description = normalizedText(raw(movement, [
    "Description", "Notes", "Remark", "Details", "Subtype", "Sub Type", "Activity", "Operation", "Business Type", "BusinessType",
    "Transaction Subtype", "Transaction Sub Type", "Product", "Category",
  ]));
  const combined = `${original} ${description}`;
  const direction = normalizedText(raw(movement, ["In/Out", "Direction", "Flow", "Cash Flow", "Credit/Debit"]));

  if (/transfer\s+stake|stake\s+transfer|staking\s+allocation|stake\s+in/.test(combined)) return "transfer_in";
  if (/transfer\s+unstake|unstake\s+transfer|staking\s+deallocation|stake\s+out/.test(combined)) return "transfer_out";
  if (/\bsell\b|sold|sale|venta|vendido|vendida|sell\s+crypto|crypto\s+sale/.test(combined)) return "sell";
  if (/\bbuy\b|bought|purchase|purchased|compra|comprado|comprada|crypto\s+purchase/.test(combined)) return "buy";
  if (/swap|convert|conversion|convertir|trade|exchange|conversion\s+of\s+assets|asset\s+exchange|crypto\s+to\s+crypto/.test(combined)) return "trade";
  if (/withdraw|withdrawal|cash\s*out|cashout|retirada|retiro|debit|send\s+out|sent\s+to/.test(combined)) return "withdrawal";
  if (/deposit|cash\s*in|cashin|entrada|deposito|depositado|receive|received|received\s+from|credit|incoming/.test(combined)) return "deposit";
  if (/reward|rewards|bonus|referral|airdrop|fork|staking\s+reward|earn\s+reward|campaign/.test(combined)) return /cashback/.test(combined) ? "cashback" : "reward";
  if (/interest|yield|interes|apr|apy/.test(combined)) return "interest";
  if (/dividend|dividendo|income/.test(combined)) return "income";
  if (/fee|fees|commission|comision|comisi[oó]n|network\s+fee|trading\s+fee/.test(combined)) return "fee";
  if (/cashback/.test(combined)) return "cashback";
  if (/card\s*payment|payment\s*card|card\s*spend|card\s*purchase|pago\s+tarjeta|spend|expense|merchant\s+payment/.test(combined)) return "expense";
  if (/out|debit|salida|sent|send/.test(direction)) return "withdrawal";
  if (/in|credit|entrada|received|receive/.test(direction)) return "deposit";

  // A row with a trading side and a pair is economically a trade even when the
  // provider gives us a proprietary operation label.
  const side = normalizedText(raw(movement, ["Side", "Trade Side"]));
  const pair = raw(movement, ["Pair", "Market", "Trading Pair", "Instrument", "Symbol"]);
  if (pair && /^(buy|sell)$/.test(side)) return side;

  return movement.transactionType || "other";
}

function isCashProxy(asset: string | null) {
  const code = normalizeAsset(asset);
  return FIAT.has(code) || code === "BCPEUR" || code === "BCPUSD";
}

function pairFromRaw(movement: NormalizedMovement) {
  const pair = raw(movement, ["Pair", "Market", "Trading Pair", "Instrument"]);
  const base = normalizeAsset(raw(movement, ["Base Asset", "Base Coin", "Underlying Asset"]));
  const quote = normalizeAsset(raw(movement, ["Quote Asset", "Quote Coin", "Settlement Asset"]));
  if (base && quote) return { base, quote, inferred: false };
  const normalizedPair = pair.replace(/\s/g, "").replace(/[\/_\-]/g, "").toUpperCase();
  if (!normalizedPair) return { base: "", quote: "", inferred: false };
  const candidates = [...CRYPTO_QUOTES, ...FIAT].sort((a, b) => b.length - a.length);
  for (const quoteCandidate of candidates) {
    if (normalizedPair.endsWith(quoteCandidate) && normalizedPair.length > quoteCandidate.length) {
      return { base: normalizedPair.slice(0, -quoteCandidate.length), quote: quoteCandidate, inferred: true };
    }
  }
  return { base: "", quote: "", inferred: false };
}

function movementIssues(next: NormalizedMovement, original: string, type: string, pair: { base: string; quote: string; inferred: boolean }): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const hasDate = Boolean(next.occurredAt) && Number.isFinite(new Date(next.occurredAt).getTime());
  const hasBase = Boolean(next.baseAsset) && next.baseAmount !== null && Math.abs(Number(next.baseAmount)) > 0;
  const hasAnyAmount = next.baseAmount !== null || next.quoteAmount !== null || next.feeAmount !== null;
  const isTrade = ["buy", "sell", "trade", "exchange", "convert", "swap"].includes(type);

  if (!hasDate) issues.push({ code: "missing_date", severity: "blocking", message: "No se ha podido determinar la fecha y hora del movimiento.", field: "fecha", hint: "Introduce la fecha exacta del movimiento." });
  if (!original || original === "unknown") issues.push({ code: "missing_operation", severity: "blocking", message: "El tipo de operación no está identificado de forma fiable.", field: "tipo", hint: "Selecciona qué operación representa este movimiento." });
  if (type === "other" || type === "unknown") issues.push({ code: "unsupported_operation", severity: "blocking", message: "La operación no coincide con ningún patrón fiscal conocido.", field: "tipo", hint: "Selecciona manualmente la categoría correcta para enseñar al motor cómo tratarla." });
  if (!hasBase && !next.quoteAsset) issues.push({ code: "missing_asset", severity: "blocking", message: "No se ha podido identificar el activo principal del movimiento.", field: "activo", hint: "Selecciona el activo al que corresponde la operación." });
  if (!hasAnyAmount) issues.push({ code: "missing_amount", severity: "blocking", message: "No se ha podido identificar ninguna cantidad utilizable.", field: "cantidad", hint: "Introduce la cantidad exacta del activo." });
  if (next.baseAsset && next.baseAmount === null && !["expense"].includes(type)) issues.push({ code: "missing_base_amount", severity: "blocking", message: `Falta la cantidad de ${next.baseAsset}.`, field: "cantidad", hint: "Introduce la cantidad que entra o sale." });
  if (isTrade && !next.baseAsset && pair.base) issues.push({ code: "inferred_base", severity: "info", message: `El activo ${pair.base} se ha inferido a partir del par ${pair.quote}.`, field: "activo" });
  if (isTrade && !next.quoteAsset && pair.quote) issues.push({ code: "inferred_quote", severity: "info", message: `La contrapartida ${pair.quote} se ha inferido a partir del par de mercado.`, field: "contrapartida" });
  if (isTrade && (!next.quoteAsset || next.quoteAmount === null) && !pair.quote) {
    issues.push({ code: "missing_counterparty", severity: "blocking", message: "La operación parece una compra, venta o permuta, pero falta la contraprestación.", field: "contrapartida", hint: "Selecciona el activo recibido/entregado o introduce su valor." });
  }
  if (isTrade && next.price === null && next.quoteAmount === null) {
    issues.push({ code: "missing_valuation", severity: "warning", message: "No existe un precio ni una contraprestación suficiente para valorar la operación.", field: "valoracion", hint: "Introduce el valor de transmisión/adquisición en EUR o el precio y divisa." });
  }
  if (isTrade && next.price !== null && !next.priceCurrency) {
    issues.push({ code: "missing_price_currency", severity: "blocking", message: "Existe un precio, pero no se ha identificado su divisa.", field: "divisa", hint: "Selecciona la divisa del precio." });
  }
  if (next.feeAmount !== null && !next.feeAsset) {
    issues.push({ code: "missing_fee_asset", severity: "warning", message: "Se ha detectado una comisión, pero no su activo.", field: "comision", hint: "Selecciona el activo usado para pagar la comisión." });
  }
  if (pair.inferred) issues.push({ code: "pair_inferred", severity: "info", message: "El par de mercado se ha interpretado automáticamente.", field: "par" });
  if (isCashProxy(next.baseAsset)) issues.push({ code: "cash_like", severity: "info", message: "El activo se trata como saldo fiat/cash-like y no genera lotes de cripto.", field: "activo" });
  if (next.classification === "needs_review" && issues.length === 0) issues.push({ code: "generic_review", severity: "warning", message: "El movimiento necesita una comprobación manual antes de incluirlo en el resultado fiscal.", hint: "Revisa el movimiento y confirma el tipo y los importes." });
  return issues;
}

export function canonicalizeNormalizedMovement(movement: NormalizedMovement, exchange: string): NormalizedMovement {
  const next = { ...movement, raw: { ...movement.raw } };
  const type = inferType(movement);
  const pair = pairFromRaw(movement);
  const currentBase = normalizeAsset(next.baseAsset);
  const currentFee = normalizeAsset(next.feeAsset);

  next.transactionType = type;
  next.originalType = movement.originalType || type;

  if (/transfer\s*\(?stake\)?/i.test(movement.originalType) || /stake\s+transfer/i.test(normalizedText(movement.originalType))) next.transactionType = "transfer_in";
  if (/transfer\s*\(?unstake\)?/i.test(movement.originalType) || /unstake\s+transfer/i.test(normalizedText(movement.originalType))) next.transactionType = "transfer_out";

  // When the provider exposes a pair and a side, trust the economic structure
  // over a proprietary operation label.
  const side = normalizedText(raw(movement, ["Side", "Trade Side"]));
  if (pair.base && /^(buy|sell)$/.test(side) && next.baseAmount !== null) {
    next.transactionType = side;
    next.baseAsset = next.baseAsset || pair.base;
    next.quoteAsset = next.quoteAsset || pair.quote || null;
    if (next.quoteAmount === null && next.price !== null && next.baseAmount !== null) {
      const derivedQuote = Math.abs(next.baseAmount) * Math.abs(next.price);
      if (Number.isFinite(derivedQuote) && derivedQuote > 0) next.quoteAmount = side === "buy" ? -derivedQuote : derivedQuote;
    }
  }

  if ((!next.baseAsset || next.baseAmount === null) && pair.base) next.baseAsset = pair.base;
  if (!next.quoteAsset && pair.quote) next.quoteAsset = pair.quote;
  if (next.priceCurrency) next.priceCurrency = normalizeAsset(next.priceCurrency);

  const rawData = next.raw as CanonicalRaw;
  if (exchange.toLowerCase() === "bitpanda" && (currentBase === "BCPEUR" || currentBase === "BCPUSD")) {
    rawData.cash_like = true;
    rawData.cash_currency = currentBase === "BCPEUR" ? "EUR" : "USD";
  }

  const issues = movementIssues(next, String(movement.originalType || ""), next.transactionType, pair);
  const hasBlocking = issues.some((issue) => issue.severity === "blocking");
  const onlyInfo = issues.length > 0 && !issues.some((issue) => issue.severity !== "info");

  next.classification = hasBlocking || next.transactionType === "other" || (!next.baseAsset && !next.quoteAsset)
    ? "needs_review"
    : next.classification;

  rawData.canonical_exchange = exchange.toLowerCase();
  rawData.canonical_type = next.transactionType;
  rawData.canonical_cash_asset = Boolean(next.baseAsset && isCashProxy(next.baseAsset));
  rawData.canonical_pair_base = pair.base || null;
  rawData.canonical_pair_quote = pair.quote || null;
  rawData.canonical_fee_asset = currentFee || normalizeAsset(next.feeAsset) || null;
  rawData.review_issues = issues;
  rawData.review_status = hasBlocking ? "blocking" : issues.length ? (onlyInfo ? "verified_with_inference" : "review") : "clean";
  rawData.review_confidence = hasBlocking ? "low" : issues.length ? "medium" : "high";
  rawData.review_hint = issues.find((issue) => issue.hint)?.hint || null;
  next.raw = rawData;

  return next;
}

export function canonicalizeNormalizedMovements(movements: NormalizedMovement[], exchange: string) {
  return movements.map((movement) => canonicalizeNormalizedMovement(movement, exchange));
}
