import { createHash } from "node:crypto";

export type CsvRow = Record<string, string>;
export type NormalizedLeg = {
  asset: string;
  amount: number;
  direction: "in" | "out";
  role: "base" | "counterparty" | "fee";
};

/**
 * The existing transactions table already has two monetary legs:
 * base_* is the asset being moved and quote_* is its counterparty.
 * A fee is deliberately kept separate from the counterparty.
 */
export type NormalizedMovement = {
  externalId: string;
  occurredAt: string;
  transactionType: string;
  originalType: string;
  direction: "incoming" | "outgoing" | "neutral";
  baseAsset: string | null;
  baseAmount: number | null;
  quoteAsset: string | null;
  quoteAmount: number | null;
  feeAsset: string | null;
  feeAmount: number | null;
  price: number | null;
  priceCurrency: string | null;
  classification: "classified" | "needs_review";
  legs: NormalizedLeg[];
  raw: { sourceFile: string; sourceExchange: string; row: CsvRow; parser: string };
};

export const CSV_SUPPORTED_EXCHANGES = new Set([
  "bitpanda", "binance", "coinbase", "kraken", "crypto.com", "cryptocom", "kucoin", "bybit", "okx",
]);

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD"]);
const QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "EUR", "USD", "GBP", "TRY", "BRL", "AUD", "CAD", "JPY", "CHF", "BTC", "ETH", "BNB"];
const clean = (value: unknown) => String(value ?? "").replace(/^\uFEFF/, "").trim();
const headerKey = (value: string) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function asAsset(value: unknown) {
  const result = clean(value).toUpperCase().replace(/[\s_-]+/g, "");
  return result || null;
}

function asNumber(value: unknown) {
  let raw = clean(value).replace(/\s/g, "").replace(/[^0-9,().+\-]/g, "");
  if (!raw || raw === "-") return null;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()]/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    const decimals = raw.length - raw.lastIndexOf(",") - 1;
    raw = decimals === 3 && raw.indexOf(",") > 0 ? raw.replace(/,/g, "") : raw.replace(",", ".");
  }
  const result = Number(raw);
  if (!Number.isFinite(result)) return null;
  return negative ? -Math.abs(result) : result;
}

function asDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw.length >= 10) {
    const date = new Date(numeric < 2_000_000_000 ? numeric * 1000 : numeric);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      out.push(cell); cell = "";
    } else cell += char;
  }
  out.push(cell);
  return out;
}

function readRows(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.map((line, index) => ({ line, index })).filter((item) => item.line.trim());
  if (!nonEmpty.length) throw new Error("El archivo está vacío.");
  const headerInfo = nonEmpty.find((item) => {
    const key = headerKey(item.line);
    return key.includes("transactionid") || key.includes("txid") || key.includes("userid") || key.includes("utctime") ||
      key.includes("timestamp") || key.includes("transactiontype") || key.includes("businesstype") || key.includes("ordertype") ||
      key.includes("subtype") || key.includes("transtype") || key.includes("biztype") || key.includes("assetmarketprice");
  }) || nonEmpty[0];
  const delimiter = headerInfo.line.includes(";") ? ";" : headerInfo.line.includes("\t") ? "\t" : ",";
  const headers = parseLine(headerInfo.line, delimiter).map(clean);
  if (headers.length < 2) throw new Error("No se ha podido identificar la cabecera del archivo.");
  const rows: CsvRow[] = [];
  for (let index = headerInfo.index + 1; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    const cells = parseLine(lines[index], delimiter);
    const row: CsvRow = {};
    headers.forEach((header, column) => { row[header] = clean(cells[column]); });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }
  return rows;
}

function rowMap(row: CsvRow) {
  const values = new Map(Object.entries(row).map(([key, value]) => [headerKey(key), clean(value)]));
  return (...names: string[]) => {
    for (const name of names) {
      const value = values.get(headerKey(name));
      if (value !== undefined && value !== "") return value;
    }
    return "";
  };
}

function pairAssets(pair: string, base: string, quote: string) {
  const explicitBase = asAsset(base);
  const explicitQuote = asAsset(quote);
  if (explicitBase && explicitQuote) return { base: explicitBase, quote: explicitQuote };
  const normalized = clean(pair).replace(/[\s_\/-]/g, "").toUpperCase();
  const candidate = QUOTES.find((quoteAsset) => normalized.endsWith(quoteAsset) && normalized.length > quoteAsset.length);
  return candidate ? { base: normalized.slice(0, -candidate.length), quote: candidate } : { base: explicitBase, quote: explicitQuote };
}

function classify(type: string, direction = "", description = "") {
  const value = `${type} ${description}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-\s]+/g, "_");
  const flow = direction.toLowerCase();
  if (/buy|purchase|bought|compra|comprado|comprada/.test(value)) return "buy";
  if (/sell|sold|venta|vendido|vendida/.test(value)) return "sell";
  if (/convert|conversion|swap|convertir|trade/.test(value)) return "trade";
  if (/withdraw|cash_out|removal|entnahme|retirada|withdrawal/.test(value)) return "withdrawal";
  if (/deposit|receive|received|cash_in|deposito|entrada/.test(value)) return "deposit";
  if (/transfer/.test(value)) return flow.includes("out") ? "transfer_out" : flow.includes("in") ? "transfer_in" : "transfer";
  if (/staking|stake|earn|allocation|deallocation/.test(value)) return "staking";
  if (/reward|bonus|referral|airdrop|fork/.test(value)) return "reward";
  if (/interest|yield|interes/.test(value)) return "interest";
  if (/cashback/.test(value)) return "cashback";
  if (/fee|commission|comision|comisión|fees/.test(value)) return "fee";
  if (/dividend|dividendo|income/.test(value)) return "income";
  if (/refund|reversal|reembolso/.test(value)) return "income";
  if (/card.*payment|payment.*card|pago.*tarjeta|spend/.test(value)) return "expense";
  if (/out|debit|salida/.test(flow) || flow === "-") return "withdrawal";
  if (/in|credit|entrada/.test(flow) || flow === "+") return "deposit";
  return "other";
}

function signed(value: number | null, type: string, direction: string) {
  if (value === null) return null;
  if (["buy", "deposit", "transfer_in", "reward", "staking", "airdrop", "interest", "cashback", "income"].includes(type)) return Math.abs(value);
  if (["sell", "withdrawal", "transfer_out", "fee", "expense"].includes(type)) return -Math.abs(value);
  if (/out|debit|salida/.test(direction.toLowerCase())) return -Math.abs(value);
  if (/in|credit|entrada/.test(direction.toLowerCase())) return Math.abs(value);
  return value;
}

function movementDirection(amount: number | null, direction: string) {
  const flow = direction.toLowerCase();
  if (/out|debit|salida/.test(flow) || (amount !== null && amount < 0)) return "outgoing" as const;
  if (/in|credit|entrada/.test(flow) || (amount !== null && amount > 0)) return "incoming" as const;
  return "neutral" as const;
}

function stableId(exchange: string, parser: string, row: CsvRow, preferred: string) {
  const id = clean(preferred);
  if (id) return `${exchange}:${id}`;
  const canonical = Object.entries(row).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${headerKey(key)}=${clean(value)}`).join("|");
  return `${exchange}:row:${createHash("sha256").update(`${parser}|${canonical}`).digest("hex").slice(0, 40)}`;
}

type MovementInput = {
  occurredAt: string; transactionType: string; originalType: string; direction: string;
  baseAsset: string | null; baseAmount: number | null; quoteAsset: string | null; quoteAmount: number | null;
  feeAsset: string | null; feeAmount: number | null; price: number | null; priceCurrency: string | null; externalId?: string;
};

function make(exchange: string, parser: string, row: CsvRow, input: MovementInput, file: string): NormalizedMovement {
  const legs: NormalizedLeg[] = [];
  if (input.baseAsset && input.baseAmount !== null && input.baseAmount !== 0) legs.push({ asset: input.baseAsset, amount: Math.abs(input.baseAmount), direction: input.baseAmount >= 0 ? "in" : "out", role: "base" });
  if (input.quoteAsset && input.quoteAmount !== null && input.quoteAmount !== 0) legs.push({ asset: input.quoteAsset, amount: Math.abs(input.quoteAmount), direction: input.quoteAmount >= 0 ? "in" : "out", role: "counterparty" });
  if (input.feeAsset && input.feeAmount !== null && input.feeAmount !== 0) legs.push({ asset: input.feeAsset, amount: Math.abs(input.feeAmount), direction: "out", role: "fee" });
  return {
    externalId: input.externalId || stableId(exchange, parser, row, ""),
    occurredAt: input.occurredAt,
    transactionType: input.transactionType,
    originalType: input.originalType,
    direction: movementDirection(input.baseAmount, input.direction),
    baseAsset: input.baseAsset,
    baseAmount: input.baseAmount,
    quoteAsset: input.quoteAsset,
    quoteAmount: input.quoteAmount,
    feeAsset: input.feeAsset,
    feeAmount: input.feeAmount,
    price: input.price,
    priceCurrency: input.priceCurrency,
    classification: input.transactionType === "other" || (!input.baseAsset && !input.quoteAsset) ? "needs_review" : "classified",
    legs,
    raw: { sourceFile: file, sourceExchange: exchange, row, parser },
  };
}

function parseBitpanda(rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Transaction Type", "Type", "Operation Type") || "unknown";
    const direction = get("In/Out", "Direction");
    const type = classify(original, direction);
    const asset = asAsset(get("Asset", "Cryptocurrency"));
    const fiat = asAsset(get("Fiat", "Currency")) || "EUR";
    const assetAmount = asNumber(get("Amount Asset", "Asset Amount", "Shares", "Quantity"));
    const fiatAmount = asNumber(get("Amount Fiat", "Fiat Amount", "Total", "Amount EUR"));
    const fee = asNumber(get("Fee", "Fees", "Fee Amount"));
    const feeAsset = asAsset(get("Fee asset", "Fee Asset", "Fee Currency"));
    const price = asNumber(get("Asset market price", "Asset Market Price", "Price", "Rate"));
    const priceCurrency = asAsset(get("Asset market price currency", "Asset Market Price Currency", "Price Currency")) || fiat;
    const trade = type === "buy" || type === "sell";
    const baseAsset = trade ? asset : assetAmount !== null && asset ? asset : fiat;
    const baseAmount = trade ? (assetAmount === null ? null : type === "buy" ? Math.abs(assetAmount) : -Math.abs(assetAmount)) : assetAmount !== null && asset ? signed(assetAmount, type, direction) : signed(fiatAmount, type, direction);
    return make("bitpanda", "bitpanda-history", row, {
      occurredAt: asDate(get("Timestamp", "Date", "Time")) || "",
      transactionType: type, originalType: original, direction,
      baseAsset, baseAmount,
      quoteAsset: trade && fiatAmount !== null ? fiat : null,
      quoteAmount: trade && fiatAmount !== null ? (type === "buy" ? -Math.abs(fiatAmount) : Math.abs(fiatAmount)) : null,
      feeAsset, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency,
      externalId: stableId("bitpanda", "bitpanda-history", row, get("Transaction ID", "TransactionID", "PID", "ID")),
    }, file);
  });
}

function parseBinance(rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const pair = get("Pair", "Market", "Symbol", "Trading Pair");
    const side = get("Side").toLowerCase();
    const assets = pairAssets(pair, get("Base Asset", "Base Coin"), get("Quote Asset", "Quote Coin"));
    const coin = asAsset(get("Coin", "Asset", "Currency"));
    const change = asNumber(get("Change", "Net Change", "Balance Change"));
    const amount = asNumber(get("Amount", "Executed", "Executed Quantity", "Quantity", "Volume"));
    const total = asNumber(get("Total", "Quote Amount", "Cost", "Funds"));
    const operation = get("Operation", "Transaction Type", "Type", "Activity");
    const description = get("Remark", "Transaction Description", "Description", "Notes");
    const rawType = operation || side || "unknown";
    const type = pair && (side === "buy" || side === "sell") ? side : classify(rawType, get("Direction", "Cash Flow", "In/Out"), description);
    const fee = asNumber(get("Fee", "Commission", "Transaction Fee"));
    const feeAsset = asAsset(get("Fee Coin", "Fee Currency", "Commission Asset"));
    const price = asNumber(get("Price", "Average Price", "Execution Price"));
    const trade = Boolean(pair && (side === "buy" || side === "sell") && amount !== null && total !== null);
    return make("binance", trade ? "binance-trades" : "binance-account-log", row, {
      occurredAt: asDate(get("UTC_Time", "UTC Time", "Date(UTC)", "Date", "Time", "Timestamp", "Create Time")) || "",
      transactionType: type, originalType: rawType, direction: get("Direction", "Cash Flow", "In/Out"),
      baseAsset: trade ? assets.base : coin || assets.base,
      baseAmount: trade ? (side === "buy" ? Math.abs(amount as number) : -Math.abs(amount as number)) : signed(change ?? amount, type, get("Direction", "Cash Flow", "In/Out")),
      quoteAsset: trade ? assets.quote : null,
      quoteAmount: trade ? (side === "buy" ? -Math.abs(total as number) : Math.abs(total as number)) : null,
      feeAsset, feeAmount: fee === null ? null : -Math.abs(fee), price,
      priceCurrency: asAsset(get("Price Currency", "Quote Currency", "Currency")) || assets.quote || null,
      externalId: stableId("binance", trade ? "binance-trades" : "binance-account-log", row, get("Transaction ID", "TransactionID", "TXID", "TxID", "Trade ID", "TradeId", "Order ID", "OrderId", "ID", "Hash")),
    }, file);
  });
}

function parseCoinbase(rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Transaction Type", "Type", "Transaction", "Activity") || "unknown";
    const description = get("Notes", "Note", "Description", "Details");
    const direction = get("Direction", "Flow");
    const type = classify(original, direction, description);
    const asset = asAsset(get("Asset", "Currency", "Asset Symbol"));
    const qty = asNumber(get("Quantity Transacted", "Quantity", "Amount", "Asset Amount"));
    const subtotal = asNumber(get("Subtotal", "Subtotal (USD)", "Subtotal (EUR)"));
    const total = asNumber(get("Total (inclusive of fees and/or spread)", "Total", "Total (USD)", "Total (EUR)"));
    const fee = asNumber(get("Fees and/or Spread", "Fees", "Fee"));
    const price = asNumber(get("Price at Transaction", "Price", "Spot Price"));
    const priceCurrency = asAsset(get("Price Currency", "Spot Price Currency", "Currency")) || "USD";
    const cash = total ?? subtotal;
    const trade = type === "buy" || type === "sell";
    const counterAsset = asAsset(get("To Asset", "Received Asset", "Destination Asset", "Counter Asset"));
    const counterAmount = asNumber(get("To Amount", "Received Amount", "Destination Amount", "Counter Amount"));
    return make("coinbase", "coinbase-history", row, {
      occurredAt: asDate(get("Timestamp", "Timestamp UTC", "Date", "Time")) || "",
      transactionType: type, originalType: original, direction,
      baseAsset: asset,
      baseAmount: qty === null ? null : type === "sell" ? -Math.abs(qty) : signed(qty, type, direction),
      quoteAsset: counterAsset && counterAmount !== null ? counterAsset : trade && cash !== null ? priceCurrency : null,
      quoteAmount: counterAsset && counterAmount !== null ? (type === "sell" ? Math.abs(counterAmount) : -Math.abs(counterAmount)) : trade && cash !== null ? (type === "buy" ? -Math.abs(cash) : Math.abs(cash)) : null,
      feeAsset: asAsset(get("Fee Currency", "Fees Currency", "Fee Asset")) || (fee !== null && trade ? priceCurrency : null),
      feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency,
      externalId: stableId("coinbase", "coinbase-history", row, get("Transaction ID", "Transaction ID", "ID", "Hash", "Reference")),
    }, file);
  });
}

function parseLedgerExchange(exchange: string, rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Type", "Transaction Type", "Operation", "Business Type", "Sub Type", "Subtype") || "unknown";
    const description = get("Description", "Notes", "Remark", "Details", "Reference");
    const direction = get("Direction", "In/Out", "Cash Flow", "Flow");
    const classified = classify(original, direction, description);
    const pair = get("Pair", "Market", "Trading Pair");
    const side = get("Side").toLowerCase();
    const assets = pairAssets(pair, get("Base Asset", "Base Coin"), get("Quote Asset", "Quote Coin"));
    const asset = asAsset(get("Asset", "Currency", "Coin", "Symbol"));
    const amount = asNumber(get("Amount", "Change", "Balance Change", "Net Amount", "Quantity", "Volume"));
    const total = asNumber(get("Total", "Quote Amount", "Cost", "Funds", "Counter Amount"));
    const trade = Boolean(pair && (side === "buy" || side === "sell") && amount !== null && total !== null);
    const type = trade ? side : classified;
    const fee = asNumber(get("Fee", "Fees", "Commission", "Transaction Fee"));
    const feeAsset = asAsset(get("Fee Asset", "Fee Currency", "Fee Coin", "Commission Asset"));
    const parser = `${exchange}-ledger`;
    return make(exchange, parser, row, {
      occurredAt: asDate(get("Timestamp", "Time", "Date", "Date(UTC)", "Created At", "Created", "UTC Time")) || "",
      transactionType: type, originalType: original, direction,
      baseAsset: trade ? assets.base : asset || assets.base,
      baseAmount: trade ? (side === "buy" ? Math.abs(amount as number) : -Math.abs(amount as number)) : signed(amount, type, direction),
      quoteAsset: trade ? assets.quote : null,
      quoteAmount: trade ? (side === "buy" ? -Math.abs(total as number) : Math.abs(total as number)) : null,
      feeAsset, feeAmount: fee === null ? null : -Math.abs(fee),
      price: asNumber(get("Price", "Average Price", "Execution Price", "Rate")),
      priceCurrency: asAsset(get("Price Currency", "Quote Currency", "Currency")) || assets.quote || null,
      externalId: stableId(exchange, parser, row, get("Transaction ID", "TransactionID", "TXID", "TxID", "Trade ID", "TradeId", "Order ID", "OrderId", "Reference", "RefID", "RefId", "ID", "Hash")),
    }, file);
  });
}

function decodeBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.slice(2)).replace(/^\uFEFF/, "");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = new Uint8Array(bytes.length - 2);
    for (let index = 2; index + 1 < bytes.length; index += 2) { swapped[index - 2] = bytes[index + 1]; swapped[index - 1] = bytes[index]; }
    return new TextDecoder("utf-16le").decode(swapped).replace(/^\uFEFF/, "");
  }
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

export function decodeExchangeCsv(buffer: ArrayBuffer) {
  return decodeBytes(buffer);
}

export function normalizeExchangeCsv(exchangeCode: string, text: string, file = "") {
  const rows = readRows(text);
  const code = exchangeCode.trim().toLowerCase();
  switch (code) {
    case "bitpanda": return parseBitpanda(rows, file);
    case "binance": return parseBinance(rows, file);
    case "coinbase": return parseCoinbase(rows, file);
    case "kraken": return parseLedgerExchange("kraken", rows, file);
    case "crypto.com":
    case "cryptocom": return parseLedgerExchange("crypto.com", rows, file);
    case "kucoin": return parseLedgerExchange("kucoin", rows, file);
    case "bybit": return parseLedgerExchange("bybit", rows, file);
    case "okx": return parseLedgerExchange("okx", rows, file);
    default: throw new Error(`Exchange CSV no soportado: ${exchangeCode}`);
  }
}
