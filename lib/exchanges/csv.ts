import crypto from "node:crypto";

export type CsvRow = Record<string, string>;

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
  raw: { sourceFile: string; sourceExchange: string; row: CsvRow; parser: string };
};

export const CSV_SUPPORTED_EXCHANGES = new Set([
  "bitpanda",
  "binance",
  "coinbase",
  "kraken",
  "crypto.com",
  "cryptocom",
  "kucoin",
  "bybit",
  "okx",
]);

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD"]);
const QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "EUR", "USD", "GBP", "TRY", "BRL", "AUD", "CAD", "JPY", "CHF", "BTC", "ETH", "BNB"];

function clean(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function key(value: string) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function number(value: unknown): number | null {
  const raw = clean(value).replace(/\s/g, "").replace(/[^0-9,().+-]/g, "");
  if (!raw || raw === "-") return null;
  const negativeParens = raw.startsWith("(") && raw.endsWith(")");
  const valueWithoutParens = raw.replace(/[()]/g, "");
  const normalized = valueWithoutParens.includes(",") && valueWithoutParens.includes(".")
    ? valueWithoutParens.lastIndexOf(",") > valueWithoutParens.lastIndexOf(".")
      ? valueWithoutParens.replace(/\./g, "").replace(",", ".")
      : valueWithoutParens.replace(/,/g, "")
    : valueWithoutParens.replace(/,/g, ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negativeParens ? -Math.abs(parsed) : parsed;
}

function normalizeAsset(value: unknown): string | null {
  const result = clean(value).toUpperCase().replace(/\s+/g, "");
  return result || null;
}

function parseDate(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw.length >= 10) {
    const milliseconds = numeric < 2_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function decodeCsv(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.slice(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.slice(2));
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if ((utf8.match(/�/g) || []).length > 2) return new TextDecoder("windows-1252").decode(bytes);
  return utf8;
}

function readRows(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const headerIndex = lines.findIndex((line) => {
    const normalized = key(line);
    return line.trim() && (normalized.includes("transactionid") || normalized.includes("txid") || normalized.includes("timestamp") || normalized.includes("utctime"));
  });
  const index = headerIndex >= 0 ? headerIndex : lines.findIndex((line) => line.trim());
  if (index < 0) throw new Error("El CSV está vacío.");
  const header = lines[index];
  const delimiter = header.includes(";") ? ";" : header.includes("\t") ? "\t" : ",";
  const headers = parseLine(header, delimiter).map(clean);
  if (headers.length < 2) throw new Error("No se ha podido identificar la cabecera del CSV.");
  const rows: CsvRow[] = [];
  for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
    if (!lines[rowIndex].trim()) continue;
    const cells = parseLine(lines[rowIndex], delimiter);
    const row: CsvRow = {};
    headers.forEach((headerName, cellIndex) => {
      row[headerName] = clean(cells[cellIndex]);
    });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }
  return rows;
}

function mapRow(row: CsvRow) {
  const mapped = new Map(Object.entries(row).map(([name, value]) => [key(name), clean(value)]));
  const get = (...names: string[]) => {
    for (const name of names) {
      const value = mapped.get(key(name));
      if (value) return value;
    }
    return "";
  };
  return { mapped, get };
}

function pairAssets(pair: string, base?: string, quote?: string) {
  const suppliedBase = normalizeAsset(base);
  const suppliedQuote = normalizeAsset(quote);
  if (suppliedBase && suppliedQuote) return { base: suppliedBase, quote: suppliedQuote };
  const normalized = pair.replace(/[\s_/-]/g, "").toUpperCase();
  const found = QUOTES.find((candidate) => normalized.endsWith(candidate) && normalized.length > candidate.length);
  if (found) return { base: normalized.slice(0, -found.length), quote: found };
  return { base: suppliedBase, quote: suppliedQuote };
}

function classify(rawType: string, direction = "", description = "") {
  const value = `${rawType} ${description}`.toLowerCase().replace(/[-\s]+/g, "_");
  const flow = direction.toLowerCase();
  if (value.includes("buy") || value.includes("purchase") || value.includes("bought")) return "buy";
  if (value.includes("sell") || value.includes("sold")) return "sell";
  if (value.includes("convert") || value.includes("conversion")) return "trade";
  if (value.includes("withdraw")) return "withdrawal";
  if (value.includes("deposit") || value.includes("receive") || value.includes("received")) return "deposit";
  if (value.includes("transfer")) return flow.includes("out") ? "transfer_out" : flow.includes("in") ? "transfer_in" : "transfer";
  if (value.includes("staking") || value.includes("stake") || value.includes("earn")) return "staking";
  if (value.includes("reward") || value.includes("bonus") || value.includes("referral")) return "reward";
  if (value.includes("airdrop") || value.includes("fork")) return "airdrop";
  if (value.includes("interest") || value.includes("yield")) return "interest";
  if (value.includes("cashback")) return "cashback";
  if (value.includes("fee") || value.includes("commission")) return "fee";
  if (value.includes("dividend")) return "income";
  if (value.includes("refund") || value.includes("reversal")) return "income";
  if (value.includes("card") && value.includes("payment")) return "expense";
  if (flow.includes("out") || flow.includes("debit") || flow === "-" || flow === "negative") return "withdrawal";
  if (flow.includes("in") || flow.includes("credit") || flow === "+" || flow === "positive") return "deposit";
  return "other";
}

function signedMovement(value: number | null, transactionType: string, direction: string) {
  if (value === null) return null;
  if (transactionType === "buy" || transactionType === "deposit" || transactionType === "transfer_in" || transactionType === "reward" || transactionType === "staking" || transactionType === "airdrop" || transactionType === "interest" || transactionType === "cashback" || transactionType === "income") return Math.abs(value);
  if (transactionType === "sell" || transactionType === "withdrawal" || transactionType === "transfer_out" || transactionType === "fee" || transactionType === "expense") return -Math.abs(value);
  if (direction.toLowerCase().includes("out") || direction.toLowerCase().includes("debit")) return -Math.abs(value);
  return value;
}

function directionOf(baseAmount: number | null, direction: string) {
  if (direction.toLowerCase().includes("out") || direction.toLowerCase().includes("debit") || (baseAmount !== null && baseAmount < 0)) return "outgoing" as const;
  if (direction.toLowerCase().includes("in") || direction.toLowerCase().includes("credit") || (baseAmount !== null && baseAmount > 0)) return "incoming" as const;
  return "neutral" as const;
}

function stableId(exchange: string, parser: string, row: CsvRow, preferred: string) {
  const id = clean(preferred);
  if (id) return `${exchange}:${id}`;
  const canonical = Object.entries(row).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${key(name)}=${clean(value)}`).join("|");
  return `${exchange}:row:${crypto.createHash("sha256").update(`${parser}|${canonical}`).digest("hex").slice(0, 40)}`;
}

function makeMovement(exchange: string, parser: string, row: CsvRow, input: Omit<NormalizedMovement, "externalId" | "raw" | "direction">) {
  return {
    ...input,
    externalId: stableId(exchange, parser, row, ""),
    direction: directionOf(input.baseAmount, input.direction === "neutral" ? "" : input.direction),
    raw: { sourceFile: "", sourceExchange: exchange, row, parser },
  } satisfies NormalizedMovement;
}

function bitpanda(rows: CsvRow[], fileName: string): NormalizedMovement[] {
  return rows.map((row) => {
    const { get } = mapRow(row);
    const originalType = get("Transaction Type", "Type", "Operation Type") || "unknown";
    const directionRaw = get("In/Out", "Direction");
    const type = classify(originalType, directionRaw);
    const asset = normalizeAsset(get("Asset", "Cryptocurrency"));
    const fiat = normalizeAsset(get("Fiat", "Currency")) || "EUR";
    const assetAmount = number(get("Amount Asset", "Asset Amount", "Amount"));
    const fiatAmount = number(get("Amount Fiat", "Fiat Amount", "Total", "Amount EUR"));
    const fee = number(get("Fee", "Fees", "Fee Amount"));
    const feeAsset = normalizeAsset(get("Fee Asset", "Fee Currency"));
    const price = number(get("Asset Market Price", "Price", "Rate"));
    const priceCurrency = normalizeAsset(get("Asset Market Price Currency", "Price Currency", "Currency")) || fiat;
    let baseAmount = signedMovement(assetAmount, type, directionRaw);
    let quoteAmount: number | null = null;
    if (assetAmount !== null && fiatAmount !== null && (type === "buy" || type === "sell")) quoteAmount = type === "buy" ? -Math.abs(fiatAmount) : Math.abs(fiatAmount);
    if (assetAmount === null && fiatAmount !== null) baseAmount = signedMovement(fiatAmount, type, directionRaw);
    const parser = "bitpanda-history";
    const movement = makeMovement("bitpanda", parser, row, { occurredAt: parseDate(get("Timestamp", "Date", "Time")) || "", transactionType: type, originalType, direction: directionRaw, baseAsset: asset || fiat, baseAmount, quoteAsset: assetAmount !== null ? fiat : null, quoteAmount, feeAsset, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency, classification: type === "other" ? "needs_review" : "classified" });
    movement.externalId = stableId("bitpanda", parser, row, get("Transaction ID", "TransactionID", "PID", "ID"));
    movement.raw.sourceFile = fileName;
    return movement;
  });
}

function binanceRows(rows: CsvRow[], fileName: string): NormalizedMovement[] {
  return rows.map((row) => {
    const { get } = mapRow(row);
    const originalType = get("Transaction Type", "Type", "Side", "Operation", "Remark", "Transaction Description") || "unknown";
    const description = get("Remark", "Transaction Description", "Description", "Notes");
    const directionRaw = get("Direction", "Cash Flow", "In/Out", "Change Direction");
    const pair = get("Pair", "Symbol", "Trading Pair");
    const baseSupplied = get("Base Asset", "Base Coin");
    const quoteSupplied = get("Quote Asset", "Quote Coin");
    const assets = pairAssets(pair, baseSupplied, quoteSupplied);
    const coin = normalizeAsset(get("Coin", "Asset", "Currency"));
    const amount = number(get("Amount", "Quantity", "Change", "Executed Quantity", "Volume"));
    const change = number(get("Change", "Net Change"));
    const rawType = `${originalType} ${description}`.toLowerCase();
    const type = classify(rawType, directionRaw);
    const price = number(get("Price", "Average Price", "Execution Price"));
    const total = number(get("Total", "Quote Amount", "Cost", "Funds"));
    const fee = number(get("Fee", "Commission", "Transaction Fee"));
    const feeAsset = normalizeAsset(get("Fee Coin", "Fee Currency", "Commission Asset"));
    let baseAsset = coin || assets.base;
    let baseAmount = change !== null && rawType.includes("deposit") === false && rawType.includes("withdraw") === false && !pair ? change : signedMovement(amount, type, directionRaw);
    let quoteAsset = assets.quote;
    let quoteAmount: number | null = null;
    if (assets.base && assets.quote && amount !== null && total !== null && (type === "buy" || type === "sell")) {
      baseAsset = assets.base;
      baseAmount = type === "buy" ? Math.abs(amount) : -Math.abs(amount);
      quoteAmount = type === "buy" ? -Math.abs(total) : Math.abs(total);
    }
    if (!baseAsset && quoteAsset) baseAsset = quoteAsset;
    const parser = pair && (type === "buy" || type === "sell" || type === "trade") ? "binance-trades" : "binance-ledger";
    const preferredId = get("Transaction ID", "TransactionID", "TXID", "TxID", "Trade ID", "TradeId", "Order ID", "OrderId", "ID");
    const movement = makeMovement("binance", parser, row, { occurredAt: parseDate(get("UTC Time", "Date(UTC)", "Date", "Time", "Timestamp", "Create Time")) || "", transactionType: type, originalType, direction: directionRaw, baseAsset, baseAmount, quoteAsset, quoteAmount, feeAsset, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency: quoteAsset || normalizeAsset(get("Price Currency", "Quote Asset")), classification: type === "other" && amount === null && change === null ? "needs_review" : type === "other" ? "needs_review" : "classified" });
    movement.externalId = stableId("binance", parser, row, preferredId);
    movement.raw.sourceFile = fileName;
    return movement;
  });
}

function coinbase(rows: CsvRow[], fileName: string): NormalizedMovement[] {
  return rows.map((row) => {
    const { get } = mapRow(row);
    const originalType = get("Transaction Type", "Type", "Transaction");
    const description = get("Notes", "Note", "Description", "Details");
    const directionRaw = get("Direction", "Flow");
    const type = classify(originalType, directionRaw, description);
    const asset = normalizeAsset(get("Asset", "Currency", "Asset Symbol"));
    const quantity = number(get("Quantity Transacted", "Quantity", "Amount", "Asset Amount"));
    const subtotal = number(get("Subtotal", "Subtotal (USD)", "Subtotal (EUR)"));
    const total = number(get("Total (inclusive of fees and/or spread)", "Total", "Total (USD)", "Total (EUR)"));
    const fee = number(get("Fees and/or Spread", "Fees", "Fee"));
    const price = number(get("Price at Transaction", "Price", "Spot Price"));
    const priceCurrency = normalizeAsset(get("Price Currency", "Currency")).toUpperCase() || "USD";
    const quoteAsset = priceCurrency;
    let baseAmount = signedMovement(quantity, type, directionRaw);
    let quoteAmount: number | null = null;
    if (quantity !== null && (type === "buy" || type === "sell")) {
      const cash = total ?? subtotal;
      if (cash !== null) quoteAmount = type === "buy" ? -Math.abs(cash) : Math.abs(cash);
      baseAmount = type === "buy" ? Math.abs(quantity) : -Math.abs(quantity);
    }
    const parser = "coinbase-statement";
    const movement = makeMovement("coinbase", parser, row, { occurredAt: parseDate(get("Timestamp", "Date", "Created At", "Time")) || "", transactionType: type, originalType: originalType || "unknown", direction: directionRaw, baseAsset: asset, baseAmount, quoteAsset: quoteAmount !== null ? quoteAsset : null, quoteAmount, feeAsset: fee !== null ? quoteAsset : null, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency, classification: type === "other" && quantity === null ? "needs_review" : type === "other" ? "needs_review" : "classified" });
    movement.externalId = stableId("coinbase", parser, row, get("Transaction ID", "Transaction ID", "ID", "Reference", "Hash"));
    movement.raw.sourceFile = fileName;
    return movement;
  });
}

function kraken(rows: CsvRow[], fileName: string): NormalizedMovement[] {
  return rows.map((row) => {
    const { get } = mapRow(row);
    const originalType = get("Type", "Transaction Type");
    const subtype = get("Subtype", "Sub Type");
    const directionRaw = get("Direction", "Flow");
    const type = classify(originalType, directionRaw, subtype);
    const asset = normalizeAsset(get("Asset", "Currency"));
    const pair = pairAssets(get("Pair", "Symbol"), get("Base Asset"), get("Quote Asset"));
    const amount = number(get("Amount", "Vol", "Volume", "Quantity"));
    const cost = number(get("Cost", "Total", "Funds"));
    const fee = number(get("Fee", "Fees"));
    const price = number(get("Price", "Rate"));
    const effectiveType = originalType.toLowerCase() === "trade" ? (String(get("Type")).toLowerCase().includes("sell") || String(get("Side")).toLowerCase() === "sell" ? "sell" : "buy") : type;
    let baseAsset = asset || pair.base;
    let baseAmount = signedMovement(amount, effectiveType, directionRaw);
    let quoteAsset = pair.quote;
    let quoteAmount: number | null = null;
    if (String(originalType).toLowerCase() === "trade" && pair.base && pair.quote && amount !== null && cost !== null) {
      baseAsset = pair.base;
      baseAmount = String(get("Side", "Type")).toLowerCase().includes("sell") ? -Math.abs(amount) : Math.abs(amount);
      quoteAmount = String(get("Side", "Type")).toLowerCase().includes("sell") ? Math.abs(cost) : -Math.abs(cost);
    }
    const parser = String(originalType).toLowerCase() === "trade" ? "kraken-trades" : "kraken-ledger";
    const movement = makeMovement("kraken", parser, row, { occurredAt: parseDate(get("Time", "Timestamp", "Date")) || "", transactionType: effectiveType, originalType: `${originalType}${subtype ? ` / ${subtype}` : ""}`.trim() || "unknown", direction: directionRaw, baseAsset, baseAmount, quoteAsset: quoteAmount !== null ? quoteAsset : null, quoteAmount, feeAsset: fee !== null ? asset : null, feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency: quoteAsset, classification: effectiveType === "other" && amount === null ? "needs_review" : "classified" });
    movement.externalId = stableId("kraken", parser, row, get("Txid", "TXID", "Transaction ID", "Refid", "Reference ID", "Ordertxid", "Trade ID", "ID"));
    movement.raw.sourceFile = fileName;
    return movement;
  });
}

function genericLedger(exchange: string, rows: CsvRow[], fileName: string, parser: string): NormalizedMovement[] {
  return rows.map((row) => {
    const { get } = mapRow(row);
    const originalType = get("Transaction Type", "Type", "Business Type", "Sub Type", "Category", "Activity", "Operation", "Transaction Description", "Description") || "unknown";
    const directionRaw = get("Direction", "Cash Flow", "Flow", "In/Out", "Side");
    const description = get("Transaction Description", "Description", "Remark", "Notes");
    const type = classify(originalType, directionRaw, description);
    const pair = pairAssets(get("Pair", "Symbol", "Instrument"), get("Base Asset", "Base Coin"), get("Quote Asset", "Quote Coin"));
    const asset = normalizeAsset(get("Asset", "Coin", "Currency", "Token")) || pair.base;
    const amount = number(get("Amount", "Change", "Quantity", "Size", "Volume", "Executed Quantity", "Funds"));
    const total = number(get("Total", "Quote Amount", "Cost", "Funds", "Notional"));
    const fee = number(get("Fee", "Fees", "Transaction Fee", "Commission"));
    const feeAsset = normalizeAsset(get("Fee Asset", "Fee Currency", "Fee Coin"));
    const price = number(get("Price", "Average Price", "Execution Price"));
    const isTrade = Boolean(pair.base && pair.quote && (type === "buy" || type === "sell" || String(originalType).toLowerCase().includes("trade")));
    let baseAmount = signedMovement(amount, type, directionRaw);
    let quoteAmount: number | null = null;
    if (isTrade && amount !== null && total !== null) {
      baseAmount = type === "sell" ? -Math.abs(amount) : Math.abs(amount);
      quoteAmount = type === "sell" ? Math.abs(total) : -Math.abs(total);
    }
    const movement = makeMovement(exchange, parser, row, { occurredAt: parseDate(get("Timestamp", "Time", "UTC Time", "Date", "Created Time", "Create Time")) || "", transactionType: type, originalType, direction: directionRaw, baseAsset: asset, baseAmount, quoteAsset: isTrade ? pair.quote : null, quoteAmount, feeAsset: feeAsset || (fee !== null && isTrade ? pair.quote : null), feeAmount: fee === null ? null : -Math.abs(fee), price, priceCurrency: normalizeAsset(get("Price Currency", "Quote Currency")) || pair.quote, classification: type === "other" ? "needs_review" : "classified" });
    movement.externalId = stableId(exchange, parser, row, get("Transaction ID", "TransactionID", "TxID", "TXID", "Trade ID", "Order ID", "OrderId", "ID", "Reference ID"));
    movement.raw.sourceFile = fileName;
    return movement;
  });
}

function detectParser(exchange: string, rows: CsvRow[]) {
  const allKeys = new Set(rows.slice(0, 5).flatMap((row) => Object.keys(row).map(key)));
  if (exchange === "bitpanda" && (allKeys.has("transactionid") || allKeys.has("transactiontype"))) return "bitpanda";
  if (exchange === "binance" && (allKeys.has("utctime") || allKeys.has("dateutc") || allKeys.has("coin") || allKeys.has("pair"))) return "binance";
  if (exchange === "coinbase" && (allKeys.has("quantitytransacted") || allKeys.has("priceattransaction") || allKeys.has("transactiontype"))) return "coinbase";
  if (exchange === "kraken" && (allKeys.has("txid") || allKeys.has("refid") || allKeys.has("ordertype") || allKeys.has("subtype"))) return "kraken";
  if (exchange === "cryptocom" || exchange === "crypto.com") return "generic";
  if (exchange === "kucoin" && (allKeys.has("businesstype") || allKeys.has("feecurrency") || allKeys.has("funds") || allKeys.has("symbol"))) return "generic";
  if (exchange === "bybit" && (allKeys.has("accounttype") || allKeys.has("transactiontype") || allKeys.has("utc time") || allKeys.has("cashflow"))) return "generic";
  if (exchange === "okx" && (allKeys.has("subtype") || allKeys.has("balancestatement") || allKeys.has("account") || allKeys.has("currency"))) return "generic";
  return "generic";
}

export function normalizeExchangeCsv(exchangeCode: string, text: string, fileName: string): NormalizedMovement[] {
  const exchange = exchangeCode.toLowerCase().trim().replace(/_/g, "-");
  if (!CSV_SUPPORTED_EXCHANGES.has(exchange)) throw new Error(`El CSV de ${exchangeCode} todavía no está soportado.`);
  const rows = readRows(text);
  if (!rows.length) throw new Error(`El archivo ${fileName} no contiene registros.`);
  const parser = detectParser(exchange, rows);
  let movements: NormalizedMovement[];
  if (exchange === "bitpanda") movements = bitpanda(rows, fileName);
  else if (exchange === "binance") movements = binanceRows(rows, fileName);
  else if (exchange === "coinbase") movements = coinbase(rows, fileName);
  else if (exchange === "kraken") movements = kraken(rows, fileName);
  else movements = genericLedger(exchange, rows, fileName, `${exchange}-generic`);

  const valid = movements.filter((movement) => movement.occurredAt || movement.baseAmount !== null || movement.quoteAmount !== null || movement.feeAmount !== null);
  if (!valid.length) throw new Error(`No se ha podido interpretar ningún movimiento de ${fileName}. Comprueba que has exportado el informe de transacciones/ledger y no un informe vacío.`);
  return valid.map((movement) => ({ ...movement, raw: { ...movement.raw, sourceFile: fileName, sourceExchange: exchange, parser } }));
}

export function decodeExchangeCsv(buffer: ArrayBuffer) {
  return decodeCsv(buffer);
}
