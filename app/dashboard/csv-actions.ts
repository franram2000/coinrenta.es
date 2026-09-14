"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CSV_SUPPORTED_EXCHANGES, decodeExchangeCsv, normalizeExchangeCsv, type NormalizedMovement } from "@/lib/exchanges/csv";
import { repairAllCsvBalances } from "./balance-repair";

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD"]);
const supportedCode = (value: string) => value.trim().toLowerCase();
const movementKey = (movement: NormalizedMovement) => movement.externalId || [movement.occurredAt, movement.transactionType, movement.baseAsset, movement.baseAmount, movement.quoteAsset, movement.quoteAmount, movement.feeAsset, movement.feeAmount, movement.originalType].join("|");

async function ensureAssets(supabase: any, symbols: string[]) {
  const unique = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  const ids = new Map<string, string>();
  if (!unique.length) return ids;
  const { data: existing, error } = await supabase.from("assets").select("id,symbol").in("symbol", unique);
  if (error) throw new Error(`No se pudieron cargar los activos: ${error.message}`);
  for (const asset of existing || []) ids.set(String(asset.symbol).toUpperCase(), String(asset.id));
  for (const symbol of unique) {
    if (ids.has(symbol)) continue;
    const { data, error: insertError } = await supabase.from("assets").insert({ symbol, name: symbol, asset_type: FIAT.has(symbol) ? "fiat" : "crypto" }).select("id,symbol").single();
    if (insertError || !data) throw new Error(`No se pudo crear el activo ${symbol}: ${insertError?.message || "error desconocido"}`);
    ids.set(symbol, String(data.id));
  }
  return ids;
}

async function getOrCreateCsvAccount(supabase: any, userId: string, exchange: { id: string; name?: string | null }, label: string | null) {
  let query = supabase
    .from("exchange_connections")
    .select("id,label,status,updated_at,accounts(id,name,is_active)")
    .eq("user_id", userId)
    .eq("exchange_id", exchange.id)
    .eq("provider_type", "csv")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (label) query = query.eq("label", label);
  else query = query.is("label", null);
  const { data: existing, error } = await query;
  if (error) throw new Error(`No se pudieron comprobar las conexiones CSV: ${error.message}`);

  for (const connection of existing || []) {
    const account = (connection.accounts || []).find((item: any) => item?.is_active !== false) || connection.accounts?.[0];
    if (account?.id) {
      return { connectionId: String(connection.id), accountId: String(account.id), created: false };
    }
  }

  const { data: connection, error: connectionError } = await supabase.from("exchange_connections").insert({
    user_id: userId,
    exchange_id: exchange.id,
    label,
    status: "pending",
    provider_type: "csv",
  }).select("id").single();
  if (connectionError || !connection) throw new Error(connectionError?.message || "No se pudo crear la conexión.");

  const { data: account, error: accountError } = await supabase.from("accounts").insert({
    user_id: userId,
    connection_id: connection.id,
    account_type: "exchange",
    name: label || exchange.name || "Cuenta CSV",
    is_active: true,
  }).select("id").single();
  if (accountError || !account) throw new Error(accountError?.message || "No se pudo crear la cuenta.");
  return { connectionId: String(connection.id), accountId: String(account.id), created: true };
}

export async function importCsvConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const exchangeId = String(formData.get("exchange_id") || "").trim();
  const label = String(formData.get("label") || "").trim() || null;
  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (!exchangeId) throw new Error("Exchange no encontrado.");
  if (!files.length) throw new Error("Selecciona al menos un CSV.");

  const { data: exchange, error: exchangeError } = await supabase.from("exchanges").select("id,code,name").eq("id", exchangeId).eq("is_active", true).maybeSingle();
  if (exchangeError || !exchange) throw new Error(exchangeError?.message || "Exchange no encontrado.");
  const exchangeCode = supportedCode(exchange.code);
  if (!CSV_SUPPORTED_EXCHANGES.has(exchangeCode)) throw new Error(`La importación CSV de ${exchange.name || exchangeCode} todavía no está disponible.`);

  const perFile: { file: File; movements: NormalizedMovement[] }[] = [];
  const uniqueByKey = new Map<string, NormalizedMovement>();
  for (const file of files) {
    const movements = normalizeExchangeCsv(exchangeCode, decodeExchangeCsv(await file.arrayBuffer()), file.name);
    if (!movements.length) throw new Error(`No se han encontrado movimientos en ${file.name}.`);
    const local: NormalizedMovement[] = [];
    for (const movement of movements) {
      if (!movement.occurredAt || !Number.isFinite(new Date(movement.occurredAt).getTime())) throw new Error(`La fila de ${file.name} tiene una fecha no interpretable. Se ha detenido la importación para no guardar datos incorrectos.`);
      const key = movementKey(movement);
      if (uniqueByKey.has(key)) continue;
      uniqueByKey.set(key, movement);
      local.push(movement);
    }
    if (local.length) perFile.push({ file, movements: local });
  }
  const unique = [...uniqueByKey.values()];
  const symbols = unique.flatMap((movement) => [movement.baseAsset, movement.quoteAsset, movement.feeAsset].filter((value): value is string => Boolean(value)));

  const accountRef = await getOrCreateCsvAccount(supabase, user.id, { id: String(exchange.id), name: exchange.name }, label);
  try {
    const assetIds = await ensureAssets(supabase, symbols);
    for (const { file, movements } of perFile) {
      const { data: importRow, error: importError } = await supabase.from("imports").insert({
        user_id: user.id,
        account_id: accountRef.accountId,
        exchange_id: exchange.id,
        source_type: "csv",
        file_name: file.name,
        status: "processing",
        rows_total: movements.length,
        rows_processed: 0,
        rows_failed: 0,
      }).select("id").single();
      if (importError || !importRow) throw new Error(importError?.message || `No se pudo registrar ${file.name}.`);

      const transactions = movements.map((movement) => ({
        user_id: user.id,
        account_id: accountRef.accountId,
        import_id: importRow.id,
        external_id: movement.externalId,
        occurred_at: movement.occurredAt,
        transaction_type: movement.transactionType,
        base_asset_id: movement.baseAsset ? assetIds.get(movement.baseAsset) || null : null,
        base_amount: movement.baseAmount,
        quote_asset_id: movement.quoteAsset ? assetIds.get(movement.quoteAsset) || null : null,
        quote_amount: movement.quoteAmount,
        fee_asset_id: movement.feeAsset ? assetIds.get(movement.feeAsset) || null : null,
        fee_amount: movement.feeAmount,
        price: movement.price,
        price_currency: movement.priceCurrency,
        raw_data: { ...movement.raw, original_type: movement.originalType, classification: movement.classification },
        source: "csv",
      }));
      for (let index = 0; index < transactions.length; index += 250) {
        const { error } = await supabase.from("transactions").upsert(transactions.slice(index, index + 250), { onConflict: "account_id,external_id" });
        if (error) throw new Error(`Error guardando ${file.name}: ${error.message}`);
      }
      const { error: doneError } = await supabase.from("imports").update({ status: "completed", rows_processed: transactions.length, rows_failed: 0, imported_at: new Date().toISOString(), error_message: null }).eq("id", importRow.id).eq("user_id", user.id);
      if (doneError) throw new Error(`No se pudo cerrar ${file.name}: ${doneError.message}`);
    }

    await supabase.from("exchange_connections").update({ status: "active", last_sync_at: new Date().toISOString(), last_sync_status: "success", last_sync_error: null, updated_at: new Date().toISOString() }).eq("id", accountRef.connectionId).eq("user_id", user.id);
    // A single reconciliation engine is responsible for all exchanges. This also repairs older imports.
    await repairAllCsvBalances();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/exchanges");
    revalidatePath("/dashboard/movimientos");
    revalidatePath("/dashboard/renta");
    return { success: true, connectionId: accountRef.connectionId, rows: unique.length, files: perFile.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el CSV.";
    await supabase.from("exchange_connections").update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", accountRef.connectionId).eq("user_id", user.id);
    throw new Error(message);
  }
}

export async function refreshCsvConnections() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await repairAllCsvBalances();
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  revalidatePath("/dashboard/movimientos");
  revalidatePath("/dashboard/renta");
}
