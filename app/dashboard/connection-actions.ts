"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncBitpanda } from "@/lib/bitpanda/sync";
import { normalizeBitpandaCsv, parseBitpandaCsv } from "@/lib/bitpanda/csv";

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK"]);
const ALLOWED_TYPES = new Set(["buy", "sell", "trade", "deposit", "withdrawal", "transfer_in", "transfer_out", "fee", "reward", "staking", "airdrop", "interest", "cashback", "income", "expense", "other"]);

function normalizeCsvType(value: string, direction: string) {
  const raw = value.toLowerCase().replace(/[ -]+/g, "_");
  if (raw === "buy" || raw.includes("buy")) return "buy";
  if (raw === "sell" || raw.includes("sell")) return "sell";
  if (raw.includes("deposit")) return direction === "outgoing" ? "withdrawal" : "deposit";
  if (raw.includes("withdraw")) return "withdrawal";
  if (raw.includes("transfer")) return direction === "outgoing" ? "transfer_out" : "transfer_in";
  if (raw.includes("staking") || raw.includes("stake")) return "staking";
  if (raw.includes("reward")) return "reward";
  if (raw.includes("interest")) return "interest";
  if (raw.includes("airdrop")) return "airdrop";
  if (raw.includes("cashback")) return "cashback";
  if (raw.includes("fee")) return "fee";
  return ALLOWED_TYPES.has(raw) ? raw : "other";
}

function signed(value: number | null, type: string, direction: string) {
  if (value === null) return null;
  if (["sell", "withdrawal", "transfer_out", "fee", "expense"].includes(type)) return -Math.abs(value);
  if (direction === "outgoing") return -Math.abs(value);
  return Math.abs(value);
}

export async function addBitpandaApiConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const exchangeId = String(formData.get("exchange_id") || "").trim();
  const label = String(formData.get("label") || "").trim() || null;
  const apiKey = String(formData.get("api_key") || "").trim();
  if (!exchangeId) throw new Error("Exchange no encontrado.");
  if (!apiKey) throw new Error("Introduce una clave API.");

  const { data: exchange, error: exchangeError } = await supabase
    .from("exchanges")
    .select("id,code,name")
    .eq("id", exchangeId)
    .eq("is_active", true)
    .maybeSingle();
  if (exchangeError || !exchange) throw new Error(exchangeError?.message || "Exchange no encontrado.");
  if (exchange.code.toLowerCase() !== "bitpanda") throw new Error("La conexión por API todavía no está disponible para este exchange.");

  const { data: connection, error: connectionError } = await supabase
    .from("exchange_connections")
    .insert({ user_id: user.id, exchange_id: exchangeId, label, status: "pending", provider_type: "api" })
    .select("id")
    .single();
  if (connectionError || !connection) throw new Error(connectionError?.message || "No se pudo crear la conexión.");

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, connection_id: connection.id, account_type: "exchange", name: label || exchange.name || "Nueva cuenta", is_active: true })
    .select("id")
    .single();
  if (accountError || !account) throw new Error(accountError?.message || "No se pudo crear la cuenta.");

  const { error: secretError } = await supabase.rpc("store_exchange_api_key", { p_connection_id: connection.id, p_api_key: apiKey });
  if (secretError) throw new Error(`No se pudo guardar la clave API: ${secretError.message}`);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  return { success: true, connectionId: connection.id };
}

export async function syncBitpandaConnection(connectionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: connection, error: connectionError } = await supabase
    .from("exchange_connections")
    .select("id,status,provider_type")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (connectionError || !connection) throw new Error("Conexión no encontrada.");
  if (connection.provider_type !== "api") throw new Error("Esta conexión no usa API.");

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("connection_id", connection.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (accountError || !account) throw new Error("Cuenta de exchange no encontrada.");

  const { data: apiKey, error: keyError } = await supabase.rpc("get_exchange_api_key", { p_connection_id: connection.id });
  if (keyError || !apiKey) throw new Error(`No se pudo recuperar la clave API: ${keyError?.message || "clave no disponible"}`);

  await supabase.from("exchange_connections").update({ status: "pending", last_sync_status: null, last_sync_error: null, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);

  try {
    const result = await syncBitpanda({ supabase, userId: user.id, connectionId: connection.id, accountId: account.id, apiKey: String(apiKey) });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/exchanges");
    revalidatePath("/dashboard/movimientos");
    revalidatePath("/dashboard/fiscalidad");
    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo sincronizar Bitpanda.";
    await supabase.from("exchange_connections").update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/exchanges");
    throw new Error(message);
  }
}

export async function addBitpandaCsvConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const exchangeId = String(formData.get("exchange_id") || "").trim();
  const label = String(formData.get("label") || "").trim() || null;
  const file = formData.get("file");
  if (!exchangeId) throw new Error("Exchange no encontrado.");
  if (!(file instanceof File) || !file.size) throw new Error("Selecciona un CSV de Bitpanda.");

  const { data: exchange, error: exchangeError } = await supabase.from("exchanges").select("id,code,name").eq("id", exchangeId).eq("is_active", true).maybeSingle();
  if (exchangeError || !exchange || exchange.code.toLowerCase() !== "bitpanda") throw new Error("Exchange no encontrado.");

  const { data: connection, error: connectionError } = await supabase
    .from("exchange_connections")
    .insert({ user_id: user.id, exchange_id: exchangeId, label, status: "pending", provider_type: "csv" })
    .select("id")
    .single();
  if (connectionError || !connection) throw new Error(connectionError?.message || "No se pudo crear la conexión.");

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, connection_id: connection.id, account_type: "exchange", name: label || exchange.name || "Histórico Bitpanda", is_active: true })
    .select("id")
    .single();
  if (accountError || !account) throw new Error(accountError?.message || "No se pudo crear la cuenta.");

  const buffer = await file.arrayBuffer();
  const text = new TextDecoder("windows-1252").decode(buffer);
  const rows = normalizeBitpandaCsv(parseBitpandaCsv(text));
  if (!rows.length) throw new Error("El CSV no contiene movimientos.");

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({ user_id: user.id, account_id: account.id, exchange_id: exchange.id, source_type: "csv", file_name: file.name, status: "processing", rows_total: rows.length, rows_processed: 0, rows_failed: 0 })
    .select("id")
    .single();
  if (importError || !importRow) throw new Error(importError?.message || "No se pudo registrar la importación.");

  try {
    const symbols = [...new Set(rows.flatMap((row) => [row.asset, row.fiat, row.feeAsset].filter(Boolean) as string[]))].map((symbol) => symbol.toUpperCase());
    const { data: existing, error: existingError } = await supabase.from("assets").select("id,symbol").in("symbol", symbols);
    if (existingError) throw new Error(existingError.message);
    const localIds = new Map<string, string>((existing || []).map((asset: any) => [String(asset.symbol).toUpperCase(), asset.id]));
    for (const symbol of symbols) {
      if (localIds.has(symbol)) continue;
      const { data, error } = await supabase.from("assets").insert({ symbol, name: symbol, asset_type: FIAT.has(symbol) ? "fiat" : "crypto" }).select("id").single();
      if (error || !data) throw new Error(`No se pudo crear el activo ${symbol}: ${error?.message || "error desconocido"}`);
      localIds.set(symbol, data.id);
    }

    const transactions = rows.map((row) => {
      const transactionType = normalizeCsvType(row.transactionType, row.direction);
      const baseSymbol = String(row.asset || row.fiat || "").toUpperCase();
      const quoteSymbol = String(row.fiat || "EUR").toUpperCase();
      const baseAmount = signed(row.amountAsset ?? row.amountFiat, transactionType, row.direction);
      const quoteAmount = row.amountAsset !== null && row.amountFiat !== null ? Math.abs(row.amountFiat) : null;
      return {
        user_id: user.id,
        account_id: account.id,
        import_id: importRow.id,
        external_id: row.externalId,
        occurred_at: row.occurredAt,
        transaction_type: transactionType,
        base_asset_id: localIds.get(baseSymbol) || null,
        base_amount: baseAmount,
        quote_asset_id: row.amountAsset !== null ? (localIds.get(quoteSymbol) || null) : null,
        quote_amount: quoteAmount,
        fee_asset_id: row.feeAsset ? (localIds.get(String(row.feeAsset).toUpperCase()) || null) : null,
        fee_amount: row.feeAmount,
        price: row.price,
        price_currency: row.priceCurrency || quoteSymbol,
        raw_data: row.raw,
        source: "csv",
      };
    });

    for (let index = 0; index < transactions.length; index += 250) {
      const { error } = await supabase.from("transactions").upsert(transactions.slice(index, index + 250), { onConflict: "account_id,external_id" });
      if (error) throw new Error(`Error guardando CSV de Bitpanda: ${error.message}`);
    }

    const balances = new Map<string, { quantity: number; price: number | null; capturedAt: string }>();
    for (const row of transactions) {
      if (!row.base_asset_id || row.base_amount === null) continue;
      const current = balances.get(row.base_asset_id) || { quantity: 0, price: null, capturedAt: row.occurred_at };
      current.quantity += Number(row.base_amount);
      if (row.price !== null && String(row.price_currency || "").toUpperCase() === "EUR") current.price = Number(row.price);
      if (new Date(row.occurred_at).getTime() > new Date(current.capturedAt).getTime()) current.capturedAt = row.occurred_at;
      balances.set(row.base_asset_id, current);
    }

    const now = new Date().toISOString();
    const snapshots = [...balances.entries()].filter(([, value]) => Math.abs(value.quantity) > 1e-12).map(([assetId, value]) => ({ user_id: user.id, account_id: account.id, asset_id: assetId, captured_at: now, quantity: value.quantity, price_eur: value.price, value_eur: value.price === null ? null : value.quantity * value.price, source: "calculated" }));
    if (snapshots.length) {
      const { error } = await supabase.from("balance_snapshots").insert(snapshots);
      if (error) throw new Error(`Error guardando saldos calculados: ${error.message}`);
    }

    await supabase.from("imports").update({ status: "completed", rows_processed: transactions.length, rows_failed: 0, imported_at: now, error_message: null }).eq("id", importRow.id).eq("user_id", user.id);
    const { error: connectionStatusError } = await supabase.from("exchange_connections").update({ status: "active", last_sync_at: now, last_sync_status: "success", last_sync_error: null, updated_at: now }).eq("id", connection.id).eq("user_id", user.id);
    if (connectionStatusError) throw new Error(`No se pudo activar la conexión: ${connectionStatusError.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el CSV.";
    await supabase.from("imports").update({ status: "failed", rows_failed: rows.length, error_message: message }).eq("id", importRow.id).eq("user_id", user.id);
    await supabase.from("exchange_connections").update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);
    throw new Error(message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  revalidatePath("/dashboard/movimientos");
  revalidatePath("/dashboard/fiscalidad");
  return { success: true, connectionId: connection.id, rows: rows.length };
}
