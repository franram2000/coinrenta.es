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

function inferFeeAsset(movement: NormalizedMovement, exchange: string) {
  const current = normalizeAsset(movement.feeAsset);
  if (current) return current;

  const rowFeeAsset = normalizeAsset(raw(movement, ["Fee asset", "Fee Asset", "Fee Currency", "Fee Coin", "Commission Asset"]));
  if (rowFeeAsset) return rowFeeAsset;

  const fee = Number(movement.feeAmount);
  if (!Number.isFinite(fee) || Math.abs(fee) < 1e-12) return null;

  const fiat = normalizeAsset(raw(movement, ["Fiat", "Currency", "Quote Currency", "Settlement Currency"]));
  const priceCurrency = normalizeAsset(movement.priceCurrency);

  // Bitpanda sometimes leaves “Fee asset” as “-” while the fee itself is
  // clearly expressed in the row's fiat currency. Do not force the user to
  // review a perfectly usable fee just because the exchange omitted the symbol.
  if (exchange.toLowerCase() === "bitpanda" && fiat && FIAT.has(fiat)) return fiat;
  if (priceCurrency && FIAT.has(priceCurrency)) return priceCurrency;
  return null;
}

function movementIssues(
  next: NormalizedMovement,
  original: string,
  type: string,
  pair: { base: string; quote: string; inferred: boolean },
  exchange: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const hasDate = Boolean(next.occurredAt) && Number.isFinite(new Date(next.occurredAt).getTime());
  const hasBase = Boolean(next.baseAsset) && next.baseAmount !== null && Math.abs(Number(next.baseAmount)) > 0;
  const hasAnyAmount = next.baseAmount !== null || next.quoteAmount !== null || next.feeAmount !== null;
  const isTrade = ["buy", "sell", "trade", "exchange", "convert", "swap"].includes(type);

  if (!hasDate) issues.push({ code: "missing_date", severity: "blocking", message: "Falta la fecha de la operación.", field: "fecha", hint: "Comprueba la fecha y hora en el extracto y añádela." });
  if (!original || original === "unknown") issues.push({ code: "missing_operation", severity: "blocking", message: "No queda claro qué operación es.", field: "tipo", hint: "Indica si fue una compra, una venta, una transferencia u otro movimiento." });
  if (type === "other" || type === "unknown") issues.push({ code: "unsupported_operation", severity: "blocking", message: "No hemos podido encajar esta operación.", field: "tipo", hint: "Revisa el movimiento y elige la operación que corresponda." });
  if (!hasBase && !next.quoteAsset) issues.push({ code: "missing_asset", severity: "blocking", message: "No hemos podido identificar el activo.", field: "activo", hint: "Indica qué activo se movió en esta operación." });
  if (!hasAnyAmount) issues.push({ code: "missing_amount", severity: "blocking", message: "Falta el importe del movimiento.", field: "cantidad", hint: "Introduce la cantidad exacta que aparece en el extracto." });
  if (next.baseAsset && next.baseAmount === null && !["expense"].includes(type)) issues.push({ code: "missing_base_amount", severity: "blocking", message: `Falta la cantidad de ${next.baseAsset}.`, field: "cantidad", hint: "Introduce la cantidad que entró o salió." });

  if (isTrade && !next.baseAsset && pair.base) issues.push({ code: "inferred_base", severity: "info", message: `Hemos identificado ${pair.base} a partir del par de mercado.`, field: "activo" });
  if (isTrade && !next.quoteAsset && pair.quote) issues.push({ code: "inferred_quote", severity: "info", message: `Hemos identificado ${pair.quote} como contrapartida.`, field: "contrapartida" });

  if (isTrade && (!next.quoteAsset || next.quoteAmount === null) && !pair.quote) {
    issues.push({ code: "missing_counterparty", severity: "blocking", message: "Falta la contrapartida de la operación.", field: "contrapartida", hint: "Indica qué activo o divisa se entregó o se recibió." });
  }

  if (isTrade && next.price === null && next.quoteAmount === null) {
    issues.push({ code: "missing_valuation", severity: "warning", message: "No aparece un valor suficiente para calcular la operación en euros.", field: "valoracion", hint: "Añade el importe en EUR o el precio y su divisa." });
  }

  if (isTrade && next.price !== null && !next.priceCurrency && !pair.quote && !FIAT.has(normalizeAsset(raw(next, ["Fiat", "Currency"])))) {
    issues.push({ code: "missing_price_currency", severity: "warning", message: "Tenemos un precio, pero no su divisa.", field: "divisa", hint: "Comprueba la divisa que usa el precio del extracto." });
  }

  if (next.feeAmount !== null && Math.abs(Number(next.feeAmount)) > 1e-12 && !next.feeAsset) {
    // A missing fee symbol is only a problem when the parser could not infer it.
    issues.push({ code: "missing_fee_asset", severity: "warning", message: "Hay una comisión, pero no aparece la divisa con la que se pagó.", field: "comision", hint: "Comprueba la divisa de la comisión en el extracto." });
  }

  // A provider can expose an asset class that is clearly not a cryptoasset.
  // Keep the movement, but ask for a human check rather than silently treating
  // an ETF/security like a coin.
  const assetClass = normalizedText(raw(next, ["Asset class", "Asset Class", "Instrument Type", "Product Type"]));
  if (assetClass && /(etf|stock|equity|security|fondo|accion|acción|share)/.test(assetClass)) {
    issues.push({ code: "non_crypto_asset", severity: "warning", message: "Este movimiento parece corresponder a un valor financiero y no a una criptomoneda.", field: "activo", hint: "Comprueba el activo antes de utilizar este movimiento en el cálculo de cripto." });
  }

  // Compare price and consideration only when both are available. Small
  // differences are normal because of spread/fees and should not create noise.
  if (isTrade && next.baseAmount !== null && next.quoteAmount !== null && next.price !== null && Math.abs(Number(next.price)) > 0) {
    const expected = Math.abs(Number(next.baseAmount)) * Math.abs(Number(next.price));
    const actual = Math.abs(Number(next.quoteAmount));
    if (expected > 0 && actual > 0) {
      const relativeGap = Math.abs(actual - expected) / expected;
      if (relativeGap > 0.08) {
        issues.push({ code: "price_mismatch", severity: "warning", message: "El precio y el importe no terminan de cuadrar.", field: "valoracion", hint: "Comprueba si el importe incluye comisión, spread u otro ajuste." });
      }
    }
  }

  // Bitpanda may use “-” as a placeholder. That is normal and should never be
  // shown to the user as an error by itself.
  const feeRaw = normalizedText(raw(next, ["Fee asset", "Fee Asset", "Fee Currency"]));
  if (feeRaw === "" || feeRaw === "-") {
    // no-op: omission is expected when there is no fee or the fee was inferred.
  }

  if (next.classification === "needs_review" && issues.length === 0) {
    issues.push({ code: "generic_review", severity: "warning", message: "Este movimiento merece una comprobación antes de cerrar el ejercicio.", hint: "Revisa que el tipo y los importes coincidan con el extracto." });
  }

  return issues;
}

export function canonicalizeNormalizedMovement(movement: NormalizedMovement, exchange: string): NormalizedMovement {
  const next = { ...movement, raw: { ...movement.raw } };
  const type = inferType(movement);
  const pair = pairFromRaw(movement);

  next.transactionType = type;
  next.originalType = movement.originalType || type;

  if (/transfer\s*\(?stake\)?/i.test(movement.originalType) || /stake\s+transfer/i.test(normalizedText(movement.originalType))) next.transactionType = "transfer_in";
  if (/transfer\s*\(?unstake\)?/i.test(movement.originalType) || /unstake\s+transfer/i.test(normalizedText(movement.originalType))) next.transactionType = "transfer_out";

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

  const inferredFeeAsset = inferFeeAsset(next, exchange);
  if (inferredFeeAsset) next.feeAsset = inferredFeeAsset;
  if (next.feeAmount !== null && Math.abs(Number(next.feeAmount)) < 1e-12) next.feeAmount = null;

  const rawData = next.raw as CanonicalRaw;
  const currentBase = normalizeAsset(next.baseAsset);
  if (exchange.toLowerCase() === "bitpanda" && (currentBase === "BCPEUR" || currentBase === "BCPUSD")) {
    rawData.cash_like = true;
    rawData.cash_currency = currentBase === "BCPEUR" ? "EUR" : "USD";
  }

  const assetClass = raw(next, ["Asset class", "Asset Class", "Instrument Type", "Product Type"]);
  rawData.asset_class = assetClass || null;
  rawData.asset_class_type = /(etf|stock|equity|security|fondo|accion|acción|share)/i.test(assetClass) ? "security" : null;

  const issues = movementIssues(next, String(movement.originalType || ""), next.transactionType, pair, exchange);
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
  rawData.canonical_fee_asset = normalizeAsset(next.feeAsset) || null;
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
