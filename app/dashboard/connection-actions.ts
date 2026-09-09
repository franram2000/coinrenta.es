"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncBitpanda } from "@/lib/bitpanda/sync";

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

  const { error: secretError } = await supabase.rpc("store_exchange_api_key", {
    p_connection_id: connection.id,
    p_api_key: apiKey,
  });
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
    .select("id,exchange_id,status,provider_type")
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

  const { data: apiKey, error: keyError } = await supabase.rpc("get_exchange_api_key", {
    p_connection_id: connection.id,
  });
  if (keyError || !apiKey) throw new Error(`No se pudo recuperar la clave API: ${keyError?.message || "clave no disponible"}`);

  await supabase
    .from("exchange_connections")
    .update({ status: "pending", last_sync_status: "pending", last_sync_error: null, updated_at: new Date().toISOString() })
    .eq("id", connection.id)
    .eq("user_id", user.id);

  try {
    const result = await syncBitpanda({
      supabase,
      userId: user.id,
      connectionId: connection.id,
      accountId: account.id,
      apiKey: String(apiKey),
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/exchanges");
    revalidatePath("/dashboard/movimientos");
    revalidatePath("/dashboard/fiscalidad");
    return { success: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo sincronizar Bitpanda.";
    await supabase
      .from("exchange_connections")
      .update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() })
      .eq("id", connection.id)
      .eq("user_id", user.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/exchanges");
    throw new Error(message);
  }
}
