"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncBitpanda } from "@/lib/bitpanda/sync";
import { normalizeBitpandaCsv, parseBitpandaCsv } from "@/lib/bitpanda/csv";

export async function addExchangeConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const exchangeId = String(formData.get("exchange_id") || "");
  const label = String(formData.get("label") || "").trim() || null;
  const apiKey = String(formData.get("api_key") || "").trim();
  const providerType = String(formData.get("provider_type") || "api").toLowerCase();
  if (!exchangeId) return;
  const { data: exchange } = await supabase.from("exchanges").select("code,name").eq("id", exchangeId).eq("is_active", true).maybeSingle();
  if (!exchange) throw new Error("Exchange no encontrado.");
  const code = exchange.code.toLowerCase();
  if (providerType === "api" && code !== "bitpanda") throw new Error("La conexión por API todavía no está disponible para este exchange.");
  if (providerType === "csv" && code !== "bitpanda") throw new Error("La importación CSV todavía no está disponible para este exchange.");
  if (providerType === "api" && !apiKey) throw new Error("Introduce una clave API.");
  const file = formData.get("file");
  if (providerType === "csv" && (!(file instanceof File) || !file.size)) throw new Error("Selecciona un CSV.");

  const { data: connection, error } = await supabase.from("exchange_connections").insert({ user_id: user.id, exchange_id: exchangeId, label, status: "pending", provider_type: providerType }).select("id").single();
  if (error || !connection) throw new Error(error?.message || "No se pudo crear la conexión");
  const { data: account, error: accountError } = await supabase.from("accounts").insert({ user_id: user.id, connection_id: connection.id, account_type: "exchange", name: label || exchange.name || "Nueva cuenta", is_active: true }).select("id").single();
  if (accountError || !account) throw new Error(accountError?.message || "No se pudo crear la cuenta");

  if (providerType === "api") {
    const { error: secretError } = await supabase.rpc("store_exchange_api_key", { p_connection_id: connection.id, p_api_key: apiKey });
    if (secretError) throw new Error(`No se pudo guardar la clave API: ${secretError.message}`);
  } else {
    const csvForm = new FormData();
    csvForm.set("file", file as File);
    csvForm.set("account_id", account.id);
    await importBitpandaCsv(csvForm);
  }
  revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges");
}

export async function deleteExchangeConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const connectionId = String(formData.get("connection_id") || "").trim();
  if (!connectionId) return;

  const { data: connection, error: connectionError } = await supabase
    .from("exchange_connections")
    .select("id, api_secret_id")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Conexión no encontrada.");

  // Remove dependent data explicitly so the connection can be deleted even if
  // the database schema does not cascade every relationship.
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);

  const accountIds = (accounts || []).map((account) => account.id);
  if (accountIds.length) {
    const { error: transactionsError } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .in("account_id", accountIds);
    if (transactionsError) throw new Error(`No se pudieron borrar los movimientos: ${transactionsError.message}`);

    const { error: accountsDeleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("user_id", user.id)
      .in("id", accountIds);
    if (accountsDeleteError) throw new Error(`No se pudo borrar la cuenta: ${accountsDeleteError.message}`);
  }

  const { error: secretError } = await supabase
    .from("exchange_connection_secrets")
    .delete()
    .eq("connection_id", connectionId)
    .eq("user_id", user.id);
  if (secretError) throw new Error(`No se pudo borrar la referencia de credenciales: ${secretError.message}`);

  const { error: deleteError } = await supabase
    .from("exchange_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", user.id);
  if (deleteError) throw new Error(`No se pudo borrar la conexión: ${deleteError.message}`);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  revalidatePath("/dashboard/movimientos");
  revalidatePath("/dashboard/fiscalidad");
}

export async function resyncAllExchanges() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accounts, error: accountsError } = await supabase.from("accounts").select("id,connection_id,exchange_connections(provider_type)").eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);
  const apiAccounts = (accounts || []).filter((account) => {
    const connection = Array.isArray(account.exchange_connections) ? account.exchange_connections[0] : account.exchange_connections;
    return connection?.provider_type === "api";
  });
  const apiAccountIds = apiAccounts.map((account) => account.id);
  if (apiAccountIds.length) {
    const { error: deleteError } = await supabase.from("transactions").delete().eq("user_id", user.id).in("account_id", apiAccountIds);
    if (deleteError) throw new Error(`No se pudieron borrar los movimientos: ${deleteError.message}`);
  }

  const connectionIds = [...new Set(apiAccounts.map((account) => account.connection_id).filter(Boolean))] as string[];
  if (!connectionIds.length) {
    revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos");
    return;
  }
  const { data: connections, error: connectionsError } = await supabase.from("exchange_connections").select("id,exchange_id,status,exchanges(code)").eq("user_id", user.id).in("id", connectionIds);
  if (connectionsError) throw new Error(connectionsError.message);

  for (const connection of connections || []) {
    const exchange = Array.isArray(connection.exchanges) ? connection.exchanges[0] : connection.exchanges;
    if ((exchange?.code || "").toLowerCase() !== "bitpanda") continue;
    const account = apiAccounts.find((item) => item.connection_id === connection.id);
    if (!account) continue;
    const { data: apiKey, error: keyError } = await supabase.rpc("get_exchange_api_key", { p_connection_id: connection.id });
    if (keyError || !apiKey) continue;
    try {
      await supabase.from("exchange_connections").update({ status: "pending", last_sync_status: "pending", last_sync_error: null, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);
      await syncBitpanda({ supabase, userId: user.id, connectionId: connection.id, accountId: account.id, apiKey });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      await supabase.from("exchange_connections").update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);
    }
  }

  revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos"); revalidatePath("/dashboard/fiscalidad");
}

export async function syncBitpandaConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const connectionId = String(formData.get("connection_id") || "");
  const { data: connection, error } = await supabase.from("exchange_connections").select("id,exchange_id,status,exchanges(code,name)").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
  if (error || !connection) throw new Error("Conexión no encontrada");
  const exchange = Array.isArray(connection.exchanges) ? connection.exchanges[0] : connection.exchanges;
  if ((exchange?.code || "").toLowerCase() !== "bitpanda") throw new Error("Esta conexión no es Bitpanda.");
  const { data: account } = await supabase.from("accounts").select("id").eq("connection_id", connectionId).eq("user_id", user.id).maybeSingle();
  if (!account) throw new Error("La conexión no tiene una cuenta asociada.");
  const { data: apiKey, error: keyError } = await supabase.rpc("get_exchange_api_key", { p_connection_id: connectionId });
  if (keyError || !apiKey) throw new Error("No hay una clave API guardada para esta conexión.");
  try {
    await syncBitpanda({ supabase, userId: user.id, connectionId, accountId: account.id, apiKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await supabase.from("exchange_connections").update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", connectionId).eq("user_id", user.id);
    throw new Error(message);
  }
  revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos");
}

export async function importBitpandaCsv(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const file = formData.get("file");
  const accountId = String(formData.get("account_id") || "");
  if (!(file instanceof File) || !file.size) throw new Error("Selecciona un CSV de Bitpanda.");
  if (!accountId) throw new Error("Selecciona la cuenta de Bitpanda.");
  const { data: account } = await supabase.from("accounts").select("id,connection_id,exchange_connections(exchange_id,exchanges(code))").eq("id", accountId).eq("user_id", user.id).maybeSingle();
  if (!account) throw new Error("Cuenta no encontrada.");
  const connection = Array.isArray(account.exchange_connections) ? account.exchange_connections[0] : account.exchange_connections;
  const exchange = Array.isArray(connection?.exchanges) ? connection?.exchanges[0] : connection?.exchanges;
  if ((exchange?.code || "").toLowerCase() !== "bitpanda") throw new Error("La cuenta seleccionada no es Bitpanda.");
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder("windows-1252").decode(buffer);
  const rows = normalizeBitpandaCsv(parseBitpandaCsv(text));
  const { data: importRow, error: importError } = await supabase.from("imports").insert({ user_id:user.id, account_id:accountId, exchange_id:connection?.exchange_id || null, source_type:"csv", file_name:file.name, status:"processing", rows_total:rows.length, rows_processed:0, rows_failed:0 }).select("id").single();
  if(importError||!importRow) throw new Error(importError?.message||"No se pudo registrar la importación");
  try {
    const symbols=[...new Set(rows.flatMap(r=>[r.asset,r.fiat,r.feeAsset].filter(Boolean) as string[]))];
    const {data:existing}=await supabase.from("assets").select("id,symbol").in("symbol",symbols);
    const ids=new Map<string,string>((existing||[]).map((a:any)=>[a.symbol,a.id]));
    for(const symbol of symbols){ if(ids.has(symbol)) continue; const fiat=["EUR","USD","GBP","CHF","PLN","SEK","DKK","NOK"].includes(symbol); const {data,error}=await supabase.from("assets").insert({symbol,name:symbol,asset_type:fiat?"fiat":"crypto"}).select("id").single(); if(error) throw new Error(`No se pudo crear el activo ${symbol}: ${error.message}`); ids.set(symbol,data.id); }
    const transactions=rows.map(r=>({user_id:user.id,account_id:accountId,import_id:importRow.id,external_id:r.externalId,occurred_at:r.occurredAt,transaction_type:r.transactionType,base_asset_id:ids.get(r.asset)||null,base_amount:r.amountAsset??(r.amountFiat??null),quote_asset_id:r.amountAsset!==null?ids.get(r.fiat)||null:null,quote_amount:r.amountAsset!==null?r.amountFiat:null,fee_asset_id:r.feeAsset?ids.get(r.feeAsset)||null:null,fee_amount:r.feeAmount,price:r.price,price_currency:r.priceCurrency,raw_data:r.raw,source:"csv:bitpanda"}));
    for(let i=0;i<transactions.length;i+=250){const {error}=await supabase.from("transactions").upsert(transactions.slice(i,i+250),{onConflict:"account_id,external_id"});if(error)throw new Error(`Error guardando CSV: ${error.message}`);}
    await supabase.from("imports").update({status:"completed",rows_processed:transactions.length,rows_failed:0,imported_at:new Date().toISOString(),error_message:null}).eq("id",importRow.id).eq("user_id",user.id);
  } catch(error) {
    const message=error instanceof Error?error.message:"Error procesando CSV";
    await supabase.from("imports").update({status:"failed",rows_failed:rows.length,error_message:message}).eq("id",importRow.id).eq("user_id",user.id);
    throw new Error(message);
  }
  revalidatePath("/dashboard"); revalidatePath("/dashboard/importar"); revalidatePath("/dashboard/movimientos");
}

export async function createImportRecord(formData: FormData) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const fileName=String(formData.get("file_name")||"").trim(); const exchangeId=String(formData.get("exchange_id")||"").trim()||null; const accountId=String(formData.get("account_id")||"").trim()||null; if(!fileName)return;
  await supabase.from("imports").insert({user_id:user.id,exchange_id:exchangeId,account_id:accountId,source_type:"csv",file_name:fileName,status:"pending",rows_total:0,rows_processed:0,rows_failed:0});
  revalidatePath("/dashboard"); revalidatePath("/dashboard/importar");
}

export async function updateProfile(formData: FormData) { const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const displayName=String(formData.get("display_name")||"").trim()||null;const {error}=await supabase.from("profiles").update({display_name:displayName}).eq("id",user.id);if(error)throw new Error(error.message);revalidatePath("/dashboard");revalidatePath("/dashboard/configuracion"); }

export async function adminUpdateUser(formData: FormData) { const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const {data:me}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(me?.role!=="admin")throw new Error("No autorizado");const targetId=String(formData.get("user_id")||"");const role=String(formData.get("role")||"free");const isActive=String(formData.get("is_active")||"true")==="true";if(!targetId||!["free","pro","admin"].includes(role))return;const {error}=await supabase.from("profiles").update({role,is_active:isActive}).eq("id",targetId);if(error)throw new Error(error.message);revalidatePath("/dashboard/usuarios");revalidatePath("/dashboard"); }
