import { createHash } from "node:crypto";

export type CsvRow = Record<string, string>;
export type NormalizedMovement = {
  externalId: string; occurredAt: string; transactionType: string; originalType: string;
  direction: "incoming" | "outgoing" | "neutral"; baseAsset: string | null; baseAmount: number | null;
  quoteAsset: string | null; quoteAmount: number | null; feeAsset: string | null; feeAmount: number | null;
  price: number | null; priceCurrency: string | null; classification: "classified" | "needs_review";
  raw: { sourceFile: string; sourceExchange: string; row: CsvRow; parser: string };
};

export const CSV_SUPPORTED_EXCHANGES = new Set(["bitpanda", "binance", "coinbase", "kraken", "crypto.com", "cryptocom", "kucoin", "bybit", "okx"]);
const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD"]);
const QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "EUR", "USD", "GBP", "TRY", "BRL", "AUD", "CAD", "JPY", "CHF", "BTC", "ETH", "BNB"];

const clean = (value: unknown) => String(value ?? "").replace(/^\uFEFF/, "").trim();
const headerKey = (value: string) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function asNumber(value: unknown) {
  let raw = clean(value).replace(/\s/g, "").replace(/[^0-9,().+\-]/g, "");
  if (!raw || raw === "-") return null;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()]/g, "");
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else raw = raw.replace(/,/g, ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function asAsset(value: unknown) {
  const v = clean(value).toUpperCase().replace(/\s+/g, "");
  return v || null;
}

function asDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && raw.length >= 10) {
    const d = new Date(n < 2000000000 ? n * 1000 : n);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function parseLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cell); cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out;
}

function readRows(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.map((line, index) => ({ line, index })).filter((x) => x.line.trim());
  if (!nonEmpty.length) throw new Error("El CSV está vacío.");
  const headerInfo = nonEmpty.find((x) => {
    const k = headerKey(x.line);
    return k.includes("transactionid") || k.includes("txid") || k.includes("timestamp") || k.includes("utctime") || k.includes("transactiontype") || k.includes("businesstype") || k.includes("ordertype") || k.includes("subtype");
  }) || nonEmpty[0];
  const delimiter = headerInfo.line.includes(";") ? ";" : headerInfo.line.includes("\t") ? "\t" : ",";
  const headers = parseLine(headerInfo.line, delimiter).map(clean);
  if (headers.length < 2) throw new Error("No se ha podido identificar la cabecera del CSV.");
  const rows: CsvRow[] = [];
  for (let i = headerInfo.index + 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const cells = parseLine(lines[i], delimiter);
    const row: CsvRow = {};
    headers.forEach((h, j) => { row[h] = clean(cells[j]); });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }
  return rows;
}

function rowMap(row: CsvRow) {
  const values = new Map(Object.entries(row).map(([k, v]) => [headerKey(k), clean(v)]));
  return (...names: string[]) => {
    for (const name of names) {
      const value = values.get(headerKey(name));
      if (value) return value;
    }
    return "";
  };
}

function pairAssets(pair: string, base: string, quote: string) {
  const b = asAsset(base), q = asAsset(quote);
  if (b && q) return { base: b, quote: q };
  const p = clean(pair).replace(/[\s_\/-]/g, "").toUpperCase();
  const candidate = QUOTES.find((x) => p.endsWith(x) && p.length > x.length);
  return candidate ? { base: p.slice(0, -candidate.length), quote: candidate } : { base: b, quote: q };
}

function classify(type: string, direction = "", description = "") {
  const value = `${type} ${description}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-\s]+/g, "_");
  const flow = direction.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/buy|purchase|bought|compra|comprado|comprada/.test(value)) return "buy";
  if (/sell|sold|venta|vendido|vendida/.test(value)) return "sell";
  if (/convert|conversion|swap|conversiones|convertir/.test(value)) return "trade";
  if (/withdraw|cash_out|removal|entnahme|retirada/.test(value)) return "withdrawal";
  if (/deposit|receive|received|cash_in|deposito|depósito|entrada/.test(value)) return "deposit";
  if (/transfer/.test(value)) return flow.includes("out") ? "transfer_out" : flow.includes("in") ? "transfer_in" : "transfer";
  if (/staking|stake|earn/.test(value)) return "staking";
  if (/reward|bonus|referral/.test(value)) return "reward";
  if (/airdrop|fork/.test(value)) return "airdrop";
  if (/interest|yield|interes|interés/.test(value)) return "interest";
  if (/cashback/.test(value)) return "cashback";
  if (/fee|commission|comision|comisión|fees/.test(value)) return "fee";
  if (/dividend|dividendo/.test(value)) return "income";
  if (/refund|reversal|reembolso/.test(value)) return "income";
  if (/card.*payment|payment.*card|pago.*tarjeta/.test(value)) return "expense";
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
  const f = direction.toLowerCase();
  if (/out|debit|salida/.test(f) || (amount !== null && amount < 0)) return "outgoing" as const;
  if (/in|credit|entrada/.test(f) || (amount !== null && amount > 0)) return "incoming" as const;
  return "neutral" as const;
}

function stableId(exchange: string, parser: string, row: CsvRow, preferred: string) {
  const id = clean(preferred);
  if (id) return `${exchange}:${id}`;
  const canonical = Object.entries(row).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${headerKey(k)}=${clean(v)}`).join("|");
  return `${exchange}:row:${createHash("sha256").update(`${parser}|${canonical}`).digest("hex").slice(0, 40)}`;
}

function make(exchange: string, parser: string, row: CsvRow, input: Omit<NormalizedMovement, "externalId" | "direction" | "classification" | "raw">) {
  return { ...input, externalId: stableId(exchange, parser, row, ""), direction: movementDirection(input.baseAmount, input.direction), classification: input.transactionType === "other" ? "needs_review" : "classified", raw: { sourceFile: "", sourceExchange: exchange, row, parser } } satisfies NormalizedMovement;
}

function bitpanda(rows: CsvRow[], file: string) {
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
    const feeAsset = asAsset(get("Fee Asset", "Fee Currency"));
    const price = asNumber(get("Asset Market Price", "Price", "Rate"));
    const priceCurrency = asAsset(get("Asset Market Price Currency", "Price Currency", "Currency")) || fiat;

    // En BUY/SELL jamás se usa Amount Fiat como sustituto de la cantidad del activo.
    // Amount Fiat es el contravalor y solo debe ir al quoteAsset/quoteAmount.
    const isTrade = type === "buy" || type === "sell";
    const baseAsset = isTrade ? asset : (assetAmount !== null && asset ? asset : fiat);
    const baseAmount = isTrade
      ? (assetAmount === null ? null : type === "buy" ? Math.abs(assetAmount) : -Math.abs(assetAmount))
      : assetAmount !== null && asset ? signed(assetAmount, type, direction) : signed(fiatAmount, type, direction);
    const quoteAmount = isTrade && fiatAmount !== null ? (type === "buy" ? -Math.abs(fiatAmount) : Math.abs(fiatAmount)) : null;
    const parser = "bitpanda-history";
    const m = make("bitpanda", parser, row, {
      occurredAt: asDate(get("Timestamp", "Date", "Time")) || "",
      transactionType: type,
      originalType: original,
      direction,
      baseAsset,
      baseAmount,
      quoteAsset: isTrade ? fiat : null,
      quoteAmount,
      feeAsset,
      feeAmount: fee === null ? null : -Math.abs(fee),
      price,
      priceCurrency,
    });
    m.externalId = stableId("bitpanda", parser, row, get("Transaction ID", "TransactionID", "PID", "ID"));
    m.raw.sourceFile = file;
    return m;
  });
}

function binance(rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Transaction Type", "Type", "Operation", "Side", "Remark", "Transaction Description") || "unknown";
    const description = get("Remark", "Transaction Description", "Description", "Notes");
    const direction = get("Direction", "Cash Flow", "In/Out", "Change Direction");
    const pair = get("Pair", "Symbol", "Trading Pair");
    const assets = pairAssets(pair, get("Base Asset", "Base Coin"), get("Quote Asset", "Quote Coin"));
    const coin = asAsset(get("Coin", "Asset", "Currency"));
    const amount = asNumber(get("Amount", "Quantity", "Executed Quantity", "Volume"));
    const change = asNumber(get("Change", "Net Change"));
    const type = classify(`${original} ${description}`, direction);
    const total = asNumber(get("Total", "Quote Amount", "Cost", "Funds"));
    const fee = asNumber(get("Fee", "Commission", "Transaction Fee"));
    const feeAsset = asAsset(get("Fee Coin", "Fee Currency", "Commission Asset"));
    const price = asNumber(get("Price", "Average Price", "Execution Price"));
    let baseAsset = coin || assets.base;
    let baseAmount = signed(change ?? amount, type, direction);
    let quoteAmount: number | null = null;
    if (assets.base && assets.quote && amount !== null && total !== null && (type === "buy" || type === "sell")) {
      baseAsset = assets.base;
      baseAmount = type === "buy" ? Math.abs(amount) : -Math.abs(amount);
      quoteAmount = type === "buy" ? -Math.abs(total) : Math.abs(total);
    }
    const parser = pair ? "binance-trades" : "binance-ledger";
    const m = make("binance", parser, row, { occurredAt: asDate(get("UTC Time", "Date(UTC)", "Date", "Time", "Timestamp", "Create Time")) || "", transactionType: type, originalType: original, direction, baseAsset, baseAmount, quoteAsset: quoteAmount !== null ? assets.quote : null, quoteAmount, feeAsset, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency: asAsset(get("Price Currency", "Quote Currency")) || assets.quote });
    m.externalId = stableId("binance", parser, row, get("Transaction ID", "TransactionID", "TXID", "TxID", "Trade ID", "TradeId", "Order ID", "OrderId", "ID")); m.raw.sourceFile = file; return m;
  });
}

function coinbase(rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Transaction Type", "Type", "Transaction") || "unknown";
    const description = get("Notes", "Note", "Description", "Details");
    const direction = get("Direction", "Flow");
    const type = classify(original, direction, description);
    const asset = asAsset(get("Asset", "Currency", "Asset Symbol"));
    const qty = asNumber(get("Quantity Transacted", "Quantity", "Amount", "Asset Amount"));
    const subtotal = asNumber(get("Subtotal", "Subtotal (USD)", "Subtotal (EUR)"));
    const total = asNumber(get("Total (inclusive of fees and/or spread)", "Total", "Total (USD)", "Total (EUR)"));
    const fee = asNumber(get("Fees and/or Spread", "Fees", "Fee"));
    const price = asNumber(get("Price at Transaction", "Price", "Spot Price"));
    const priceCurrency = asAsset(get("Price Currency", "Currency")) || "USD";
    const cash = total ?? subtotal;
    const m = make("coinbase", "coinbase-statement", row, { occurredAt: asDate(get("Timestamp", "Date", "Created At", "Time")) || "", transactionType: type, originalType: original, direction, baseAsset: asset, baseAmount: signed(qty, type, direction), quoteAsset: qty !== null && (type === "buy" || type === "sell") ? priceCurrency : null, quoteAmount: qty !== null && cash !== null ? (type === "buy" ? -Math.abs(cash) : type === "sell" ? Math.abs(cash) : cash) : null, feeAsset: fee !== null ? priceCurrency : null, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency });
    m.externalId = stableId("coinbase", "coinbase-statement", row, get("Transaction ID", "ID", "Reference", "Hash")); m.raw.sourceFile = file; return m;
  });
}

function kraken(rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Type", "Transaction Type") || "unknown";
    const subtype = get("Subtype", "Sub Type");
    const direction = get("Direction", "Flow");
    const pair = pairAssets(get("Pair", "Symbol"), get("Base Asset"), get("Quote Asset"));
    const amount = asNumber(get("Amount", "Vol", "Volume", "Quantity"));
    const cost = asNumber(get("Cost", "Total", "Funds"));
    const fee = asNumber(get("Fee", "Fees"));
    const asset = asAsset(get("Asset", "Currency")) || pair.base;
    const side = get("Side");
    const type = original.toLowerCase() === "trade" ? (side.toLowerCase() === "sell" ? "sell" : "buy") : classify(original, direction, subtype);
    let baseAsset = asset;
    let baseAmount = signed(amount, type, direction);
    let quoteAmount: number | null = null;
    if (original.toLowerCase() === "trade" && pair.base && pair.quote && amount !== null && cost !== null) {
      baseAsset = pair.base; baseAmount = side.toLowerCase() === "sell" ? -Math.abs(amount) : Math.abs(amount); quoteAmount = side.toLowerCase() === "sell" ? Math.abs(cost) : -Math.abs(cost);
    }
    const parser = original.toLowerCase() === "trade" ? "kraken-trades" : "kraken-ledger";
    const m = make("kraken", parser, row, { occurredAt: asDate(get("Time", "Timestamp", "Date")) || "", transactionType: type, originalType: subtype ? `${original} / ${subtype}` : original, direction, baseAsset, baseAmount, quoteAsset: quoteAmount !== null ? pair.quote : null, quoteAmount, feeAsset: fee !== null ? asset : null, feeAmount: fee === null ? null : -Math.abs(fee), price: asNumber(get("Price", "Rate")), priceCurrency: pair.quote });
    m.externalId = stableId("kraken", parser, row, get("Txid", "TXID", "Transaction ID", "Refid", "Reference ID", "Ordertxid", "Trade ID", "ID")); m.raw.sourceFile = file; return m;
  });
}

function generic(exchange: string, rows: CsvRow[], file: string) {
  return rows.map((row) => {
    const get = rowMap(row);
    const original = get("Transaction Type", "Type", "Business Type", "Sub Type", "Category", "Activity", "Operation", "Transaction Description", "Description") || "unknown";
    const direction = get("Direction", "Cash Flow", "Flow", "In/Out", "Side");
    const description = get("Transaction Description", "Description", "Remark", "Notes");
    const type = classify(original, direction, description);
    const pair = pairAssets(get("Pair", "Symbol", "Instrument"), get("Base Asset", "Base Coin"), get("Quote Asset", "Quote Coin"));
    const coin = asAsset(get("Coin", "Asset", "Currency")) || pair.base;
    const amount = asNumber(get("Change", "Net Change", "Amount", "Quantity", "Volume", "Balance Change"));
    const total = asNumber(get("Total", "Quote Amount", "Cost", "Funds", "Counter Amount"));
    const fee = asNumber(get("Fee", "Fees", "Commission", "Transaction Fee"));
    const feeAsset = asAsset(get("Fee Asset", "Fee Currency", "Commission Asset"));
    const price = asNumber(get("Price", "Average Price", "Execution Price", "Rate"));
    let baseAsset = coin;
    let baseAmount = signed(amount, type, direction);
    let quoteAsset: string | null = null;
    let quoteAmount: number | null = null;
    if (pair.base && pair.quote && amount !== null && total !== null && (type === "buy" || type === "sell")) {
      baseAsset = pair.base; baseAmount = type === "buy" ? Math.abs(amount) : -Math.abs(amount); quoteAsset = pair.quote; quoteAmount = type === "buy" ? -Math.abs(total) : Math.abs(total);
    }
    const parser = `${exchange}-generic`;
    const m = make(exchange, parser, row, { occurredAt: asDate(get("Timestamp", "Time", "Date", "Created At", "UTC Time", "Date(UTC)")) || "", transactionType: type, originalType: original, direction, baseAsset, baseAmount, quoteAsset, quoteAmount, feeAsset, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency: asAsset(get("Price Currency", "Quote Currency", "Currency")) || pair.quote });
    m.externalId = stableId(exchange, parser, row, get("Transaction ID", "TransactionID", "TXID", "TxID", "Trade ID", "Order ID", "OrderId", "ID", "Hash", "Reference")); m.raw.sourceFile = file; return m;
  });
}

export function normalizeExchangeCsv(exchange: string, rows: CsvRow[], fileName = "") {
  const code = exchange.trim().toLowerCase();
  let movements: NormalizedMovement[];
  if (code === "bitpanda") movements = bitpanda(rows, fileName);
  else if (code === "binance") movements = binance(rows, fileName);
  else if (code === "coinbase") movements = coinbase(rows, fileName);
  else if (code === "kraken") movements = kraken(rows, fileName);
  else if (CSV_SUPPORTED_EXCHANGES.has(code)) movements = generic(code, rows, fileName);
  else throw new Error(`Exchange no soportado: ${exchange}`);
  return movements.map((m) => ({ ...m, raw: { ...m.raw, sourceFile: fileName, sourceExchange: code } }));
}

export function decodeExchangeCsv(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return parseText(new TextDecoder("utf-16le").decode(bytes.slice(2)));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return parseText(new TextDecoder("utf-16be").decode(bytes.slice(2)));
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const text = (utf8.match(/�/g) || []).length > 2 ? new TextDecoder("windows-1252").decode(bytes) : utf8;
  return parseText(text);
}

function parseText(text: string) {
  return readRows(text);
}
