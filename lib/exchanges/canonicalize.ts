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
    "Transaction Subtype", "Transaction Sub Type", "Product", "Category", "Reason", "Memo", "Reference",
  ]));
  const combined = `${original} ${description}`;
  const direction = normalizedText(raw(movement, ["In/Out", "Direction", "Flow", "Cash Flow", "Credit/Debit"]));

  if (/transfer\s+stake|stake\s+transfer|staking\s+allocation|stake\s+in/.test(combined)) return "transfer_in";
  if (/transfer\s+unstake|unstake\s+transfer|staking\s+deallocation|stake\s+out/.test(combined)) return "transfer_out";
  if (/\bsell\b|sold|sale|venta|vendido|vendida|sell\s+crypto|crypto\s+sale|liquidat/.test(combined)) return "sell";
  if (/\bbuy\b|bought|purchase|purchased|compra|comprado|comprada|crypto\s+purchase|acquir/.test(combined)) return "buy";
  if (/swap|convert|conversion|convertir|trade|exchange|conversion\s+of\s+assets|asset\s+exchange|crypto\s+to\s+crypto|intercambio|permuta/.test(combined)) return "trade";
  if (/withdraw|withdrawal|cash\s*out|cashout|retirada|retiro|debit|send\s+out|sent\s+to|envio|envío/.test(combined)) return "withdrawal";
  if (/deposit|cash\s*in|cashin|entrada|deposito|depositado|receive|received|received\s+from|credit|incoming|ingreso/.test(combined)) return "deposit";
  if (/reward|rewards|bonus|referral|airdrop|fork|staking\s+reward|earn\s+reward|campaign/.test(combined)) return /cashback/.test(combined) ? "cashback" : "reward";
  if (/interest|yield|interes|apr|apy|rendimiento/.test(combined)) return "interest";
  if (/dividend|dividendo|income/.test(combined)) return "income";
  if (/fee|fees|commission|comision|comisi[oó]n|network\s+fee|trading\s+fee|tarifa/.test(combined)) return "fee";
  if (/cashback|devolucion|devolución/.test(combined)) return "cashback";
  if (/card\s*payment|payment\s*card|card\s*spend|card\s*purchase|pago\s+tarjeta|spend|expense|merchant\s+payment|compra\s+tarjeta/.test(combined)) return "expense";
  if (/out|debit|salida|sent|send/.test(direction)) return "withdrawal";
  if (/in|credit|entrada|received|receive/.test(direction)) return "deposit";

  const side = normalizedText(raw(movement, ["Side", "Trade Side", "Order Side"]));
  const pair = raw(movement, ["Pair", "Market", "Trading Pair", "Instrument", "Symbol"]);
  if (pair && /^(buy|sell)$/.test(side)) return side;

  return movement.transactionType || "other";
}

function isCashProxy(asset: string | null) {
  const code = normalizeAsset(asset);
  return FIAT.has(code) || code === "BCPEUR" || code === "BCPUSD";
}

function pairFromRaw(movement: NormalizedMovement) {
  const pair = raw(movement, ["Pair", "Market", "Trading Pair", "Instrument", "Symbol"]);
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

function positiveNumber(value: number | null) {
  return value !== null && Number.isFinite(value) && Math.abs(value) > 0;
}

function movementIssues(next: NormalizedMovement, original: string, type: string, pair: { base: string; quote: string; inferred: boolean }): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const hasDate = Boolean(next.occurredAt) && Number.isFinite(new Date(next.occurredAt).getTime());
  const hasBase = Boolean(next.baseAsset) && positiveNumber(next.baseAmount);
  const hasAnyAmount = positiveNumber(next.baseAmount) || positiveNumber(next.quoteAmount) || positiveNumber(next.feeAmount);
  const isTrade = ["buy", "sell", "trade", "exchange", "convert", "swap"].includes(type);
  const base = normalizeAsset(next.baseAsset);
  const quote = normalizeAsset(next.quoteAsset);
  const fee = normalizeAsset(next.feeAsset);

  if (!hasDate) issues.push({ code: "missing_date", severity: "blocking", message: "Falta la fecha de la operación.", field: "fecha", hint: "Revisa la fecha que figura en el CSV." });
  if (!original || original === "unknown") issues.push({ code: "missing_operation", severity: "blocking", message: "No he podido saber qué operación es esta.", field: "tipo", hint: "Indica si fue una compra, venta, permuta, transferencia, recompensa u otra operación." });
  if (type === "other" || type === "unknown") issues.push({ code: "unsupported_operation", severity: "blocking", message: "El movimiento tiene un tipo que todavía no reconozco.", field: "tipo", hint: "Elige la operación que corresponda y quedará guardada como corrección." });
  if (!hasBase && !next.quoteAsset) issues.push({ code: "missing_asset", severity: "blocking", message: "No he podido identificar el activo afectado.", field: "activo", hint: "Indica el activo que entra o sale en esta operación." });
  if (!hasAnyAmount) issues.push({ code: "missing_amount", severity: "blocking", message: "Falta el importe o la cantidad del movimiento.", field: "cantidad", hint: "Comprueba la cantidad en el extracto y añádela." });
  if (next.baseAsset && next.baseAmount === null && type !== "expense") issues.push({ code: "missing_base_amount", severity: "blocking", message: `Falta la cantidad de ${base}.`, field: "cantidad", hint: "Introduce la cantidad exacta del activo." });

  if (isTrade && (!next.quoteAsset || next.quoteAmount === null) && !pair.quote) {
    issues.push({ code: "missing_counterparty", severity: "blocking", message: "Sé que aquí hay una compra/venta/permuta, pero no aparece qué se recibió o entregó a cambio.", field: "contrapartida", hint: "Indica el activo y el importe de la contrapartida o su valor en EUR." });
  }
  if (isTrade && next.price === null && next.quoteAmount === null) {
    issues.push({ code: "missing_valuation", severity: "warning", message: "No aparece un valor claro para esta operación.", field: "valoracion", hint: "Con el precio o el importe de la contrapartida puedo calcular el valor fiscal." });
  }
  if (isTrade && next.price !== null && next.price <= 0) {
    issues.push({ code: "invalid_price", severity: "blocking", message: "El precio de la operación no parece válido.", field: "precio", hint: "Comprueba el precio unitario del extracto." });
  }
  if (isTrade && next.price !== null && !next.priceCurrency) {
    issues.push({ code: "missing_price_currency", severity: "blocking", message: "Hay un precio, pero no sé en qué divisa está expresado.", field: "divisa", hint: "Indica EUR, USD, USDT u otra divisa." });
  }
  if (next.feeAmount !== null && next.feeAmount !== 0 && !next.feeAsset) {
    issues.push({ code: "missing_fee_asset", severity: "warning", message: "Hay una comisión, pero no aparece el activo con el que se pagó.", field: "comision", hint: "Indica el activo utilizado para pagar la comisión." });
  }
  if (next.feeAmount !== null && Math.abs(next.feeAmount) > 0 && !fee) {
    issues.push({ code: "fee_not_usable", severity: "warning", message: "La comisión no se puede llevar al cálculo porque falta su activo.", field: "comision" });
  }

  // These checks are deliberately silent when everything is consistent. We only
  // flag situations a tax professional would normally stop and verify.
  if (isTrade && next.baseAmount !== null && next.quoteAmount !== null && next.price !== null && next.price > 0) {
    const expected = Math.abs(next.baseAmount) * Math.abs(next.price);
    const actual = Math.abs(next.quoteAmount);
    if (expected > 0 && actual > 0) {
      const deviation = Math.abs(actual - expected) / expected;
      if (deviation > 0.08) {
        issues.push({ code: "amount_price_mismatch", severity: "warning", message: "El importe y el precio no cuadran del todo.", field: "valoracion", hint: "Puede ser spread, comisión o un formato distinto del exchange. Conviene comprobarlo antes de cerrar el ejercicio." });
      }
    }
  }

  if (isTrade && next.feeAmount !== null && next.quoteAmount !== null && Math.abs(next.quoteAmount) > 0) {
    const feeRatio = Math.abs(next.feeAmount) / Math.abs(next.quoteAmount);
    if (feeRatio > 0.10) {
      issues.push({ code: "unusually_high_fee", severity: "warning", message: "La comisión es bastante alta respecto al importe de la operación.", field: "comision", hint: "Comprueba que el CSV no mezcle comisión, spread e importe total." });
    }
  }

  // Informational traces are kept out of the user-facing incident list. They are
  // useful for audit/debugging without making the product feel noisy or robotic.
  if (pair.inferred) issues.push({ code: "pair_inferred", severity: "info", message: `Par interpretado automáticamente (${pair.base}/${pair.quote}).`, field: "par" });
  if (isCashProxy(next.baseAsset)) issues.push({ code: "cash_like", severity: "info", message: "Saldo fiat o equivalente de efectivo.", field: "activo" });
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

  const side = normalizedText(raw(movement, ["Side", "Trade Side", "Order Side"]));
  if (pair.base && /^(buy|sell)$/.test(side) && next.baseAmount !== null) {
    next.transactionType = side;
    next.baseAsset = next.baseAsset || pair.base;
    next.quoteAsset = next.quoteAsset || pair.quote || null;
    if (next.quoteAmount === null && next.price !== null && next.baseAmount !== null && next.price > 0) {
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
  const blocking = issues.some((issue) => issue.severity === "blocking");
  const review = issues.some((issue) => issue.severity === "warning");

  next.classification = blocking || next.transactionType === "other" || (!next.baseAsset && !next.quoteAsset)
    ? "needs_review"
    : next.classification;

  rawData.canonical_exchange = exchange.toLowerCase();
  rawData.canonical_type = next.transactionType;
  rawData.canonical_cash_asset = Boolean(next.baseAsset && isCashProxy(next.baseAsset));
  rawData.canonical_pair_base = pair.base || null;
  rawData.canonical_pair_quote = pair.quote || null;
  rawData.canonical_fee_asset = currentFee || normalizeAsset(next.feeAsset) || null;
  rawData.review_issues = issues;
  rawData.review_status = blocking ? "blocking" : review ? "review" : "clean";
  rawData.review_confidence = blocking ? "low" : review ? "medium" : "high";
  rawData.review_hint = issues.find((issue) => issue.hint)?.hint || null;
  next.raw = rawData;

  return next;
}

export function canonicalizeNormalizedMovements(movements: NormalizedMovement[], exchange: string) {
  return movements.map((movement) => canonicalizeNormalizedMovement(movement, exchange));
}
