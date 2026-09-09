import { bitpandaApi, type BitpandaOperation, type BitpandaOperationTransaction } from "./api";

const ALLOWED_TYPES = new Set(["buy", "sell", "trade", "deposit", "withdrawal", "transfer_in", "transfer_out", "fee", "reward", "staking", "airdrop", "interest", "cashback", "income", "expense", "other"]);
const FIAT_SYMBOLS = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK"]);

function n(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function signed(value: unknown, flow: unknown) {
  const amount = n(value) ?? 0;
  return String(flow || "").toUpperCase() === "OUTGOING" ? -Math.abs(amount) : Math.abs(amount);
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizeType(operationType: unknown, transactionType: unknown, flow: unknown): string {
  const raw = String(transactionType || operationType || "other").toLowerCase().replace(/[ -]+/g, "_");
  if (raw.includes("buy")) return "buy";
  if (raw.includes("sell")) return "sell";
  if (raw.includes("deposit")) return "deposit";
  if (raw.includes("withdraw")) return "withdrawal";
  if (raw.includes("staking") || raw.includes("stake")) return "staking";
  if (raw.includes("reward")) return "reward";
  if (raw.includes("airdrop")) return "airdrop";
  if (raw.includes("interest")) return "interest";
  if (raw.includes("cashback")) return "cashback";
  if (raw.includes("fee")) return "fee";
  if (raw.includes("transfer")) return String(flow || "").toUpperCase() === "OUTGOING" ? "transfer_out" : "transfer_in";
  if (ALLOWED_TYPES.has(raw)) return raw;
  return String(flow || "").toUpperCase() === "OUTGOING" ? "withdrawal" : "deposit";
}

function operationTransactions(operation: BitpandaOperation): BitpandaOperationTransaction[] {
  if (Array.isArray(operation.transactions) && operation.transactions.length) return operation.transactions;
  const fallback: BitpandaOperationTransaction = {
    transaction_id: operation.operation_id || operation.operationId,
    asset_id: operation.assetId,
    amount: operation.amount,
    transaction_type: operation.operation_type || operation.operationType,
    timestamp: operation.timestamp,
  };
  return [fallback];
}

function operationId(operation: BitpandaOperation, index: number) {
  return operation.operation_id || operation.operationId || `operation-${index + 1}`;
}

function txId(tx: BitpandaOperationTransaction, operation: BitpandaOperation, index: number) {
  return tx.transaction_id || tx.transactionId || `${operationId(operation, index)}-${index}`;
}

function txAssetId(tx: BitpandaOperationTransaction) {
  return tx.asset_id || tx.assetId || "";
}

function txCurrencyId(tx: BitpandaOperationTransaction) {
  return tx.currency_id || tx.currencyId || "";
}

function txAmount(tx: BitpandaOperationTransaction) {
  return n(tx.asset_amount?.value ?? tx.amount);
}

function txFee(tx: BitpandaOperationTransaction) {
  return n(tx.fee_amount?.value);
}

function txTime(tx: BitpandaOperationTransaction, operation: BitpandaOperation) {
  return tx.credited_at || tx.timestamp || operation.timestamp || new Date().toISOString();
}

export async function syncBitpanda({
  supabase,
  userId,
  connectionId,
  accountId,
  apiKey,
}: {
  supabase: any;
  userId: string;
  connectionId: string;
  accountId: string;
  apiKey: string;
}) {
  const [portfolioResponse, operations] = await Promise.all([
    bitpandaApi.portfolio(apiKey),
    bitpandaApi.operations(apiKey),
  ]);

  const holdings = Array.isArray(portfolioResponse)
    ? portfolioResponse
    : Array.isArray((portfolioResponse as any)?.data)
      ? (portfolioResponse as any).data
      : [];

  const operationRows = operations || [];
  const assetIdsFromApi = [
    ...holdings.map((holding: any) => holding.assetId),
    ...operationRows.flatMap((operation: BitpandaOperation) => operationTransactions(operation).flatMap((tx) => [txAssetId(tx), txCurrencyId(tx), tx.fee_amount?.asset_id]).filter(Boolean)),
  ];

  const [assetCatalog, currencyCatalog] = await Promise.all([
    bitpandaApi.assets(apiKey, assetIdsFromApi),
    bitpandaApi.currencies(apiKey),
  ]);

  const symbolByExternalId = new Map<string, string>();
  const nameByExternalId = new Map<string, string>();
  const typeByExternalId = new Map<string, string>();
  for (const asset of assetCatalog || []) {
    if (!asset?.id) continue;
    symbolByExternalId.set(asset.id, String(asset.symbol || asset.name || asset.id).toUpperCase());
    nameByExternalId.set(asset.id, asset.name || asset.symbol || asset.id);
    typeByExternalId.set(asset.id, String(asset.type || "").toLowerCase());
  }
  for (const currency of currencyCatalog || []) {
    if (!currency?.id) continue;
    symbolByExternalId.set(currency.id, String(currency.symbol || currency.name || currency.id).toUpperCase());
    nameByExternalId.set(currency.id, currency.name || currency.symbol || currency.id);
    typeByExternalId.set(currency.id, "currency");
  }

  const symbols = new Set<string>();
  for (const id of assetIdsFromApi) {
    const symbol = symbolByExternalId.get(id);
    if (symbol) symbols.add(symbol);
  }
  for (const holding of holdings) {
    const symbol = symbolByExternalId.get(holding.assetId);
    if (symbol) symbols.add(symbol);
  }

  const { data: existingAssets, error: existingAssetsError } = await supabase
    .from("assets")
    .select("id,symbol,name,asset_type")
    .in("symbol", [...symbols]);
  if (existingAssetsError) throw new Error(`No se pudieron cargar los activos locales: ${existingAssetsError.message}`);

  const localAssetIds = new Map<string, string>();
  for (const asset of existingAssets || []) localAssetIds.set(String(asset.symbol).toUpperCase(), asset.id);

  for (const symbol of symbols) {
    if (localAssetIds.has(symbol)) continue;
    const externalId = [...symbolByExternalId.entries()].find(([, value]) => value === symbol)?.[0];
    const type = externalId ? typeByExternalId.get(externalId) : "";
    const assetType = FIAT_SYMBOLS.has(symbol) || type === "currency" ? "fiat" : "crypto";
    const { data, error } = await supabase
      .from("assets")
      .insert({
        symbol,
        name: externalId ? nameByExternalId.get(externalId) || symbol : symbol,
        asset_type: assetType,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`No se pudo crear el activo ${symbol}: ${error?.message || "error desconocido"}`);
    localAssetIds.set(symbol, data.id);
  }

  const rows: any[] = [];
  for (let operationIndex = 0; operationIndex < operationRows.length; operationIndex += 1) {
    const operation = operationRows[operationIndex];
    const operationType = operation.operation_type || operation.operationType;
    const operationTransactionsList = operationTransactions(operation);
    for (let txIndex = 0; txIndex < operationTransactionsList.length; txIndex += 1) {
      const tx = operationTransactionsList[txIndex];
      const externalAssetId = txAssetId(tx);
      const externalCurrencyId = txCurrencyId(tx);
      const symbol = symbolByExternalId.get(externalAssetId) || symbolByExternalId.get(externalCurrencyId);
      if (!symbol || !localAssetIds.get(symbol)) continue;

      const amount = txAmount(tx);
      const fee = txFee(tx);
      const flow = tx.flow || "";
      const transactionType = normalizeType(operationType, tx.transaction_type || tx.transactionType, flow);
      const rate = n(tx.trade?.to_eur_rate ?? tx.trade?.rate_with_fee ?? tx.trade?.rate);
      const quoteSymbol = symbolByExternalId.get(externalCurrencyId) || "EUR";
      const quoteAmount = amount !== null && rate !== null ? Math.abs(amount) * Math.abs(rate) : null;
      const feeAssetId = tx.fee_amount?.asset_id ? localAssetIds.get(symbolByExternalId.get(tx.fee_amount.asset_id) || "") : null;

      rows.push({
        user_id: userId,
        account_id: accountId,
        external_id: `bitpanda:${operationId(operation, operationIndex)}:${txId(tx, operation, txIndex)}`,
        occurred_at: txTime(tx, operation),
        transaction_type: transactionType,
        base_asset_id: localAssetIds.get(symbol),
        base_amount: amount === null ? null : signed(amount, flow),
        quote_asset_id: localAssetIds.get(quoteSymbol) || null,
        quote_amount: quoteAmount,
        fee_asset_id: feeAssetId,
        fee_amount: fee,
        price: rate,
        price_currency: quoteSymbol,
        raw_data: { operation, transaction: tx },
        source: "api",
      });
    }
  }

  let processed = 0;
  for (let index = 0; index < rows.length; index += 250) {
    const chunk = rows.slice(index, index + 250);
    const { error } = await supabase
      .from("transactions")
      .upsert(chunk, { onConflict: "account_id,external_id" });
    if (error) throw new Error(`Error guardando movimientos Bitpanda: ${error.message}`);
    processed += chunk.length;
  }

  const now = new Date().toISOString();
  const snapshotRows = [];
  for (const holding of holdings) {
    const symbol = symbolByExternalId.get(holding.assetId);
    const quantity = n(holding.quantity);
    const value = n(holding.value);
    if (!symbol || !localAssetIds.get(symbol) || quantity === null) continue;
    const price = quantity !== 0 && value !== null ? value / quantity : null;
    snapshotRows.push({
      user_id: userId,
      account_id: accountId,
      asset_id: localAssetIds.get(symbol),
      captured_at: now,
      quantity,
      price_eur: price,
      value_eur: value,
      source: "api",
    });
  }

  if (snapshotRows.length) {
    const { error } = await supabase.from("balance_snapshots").insert(snapshotRows);
    if (error) throw new Error(`Error guardando saldos Bitpanda: ${error.message}`);
  }

  const { error: connectionError } = await supabase
    .from("exchange_connections")
    .update({
      status: "active",
      last_sync_at: now,
      last_sync_status: "success",
      last_sync_error: null,
      updated_at: now,
    })
    .eq("id", connectionId)
    .eq("user_id", userId);
  if (connectionError) throw new Error(`No se pudo actualizar el estado de la conexión: ${connectionError.message}`);

  return { transactions: processed, snapshots: snapshotRows.length };
}
