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

  try {
    await syncBitpanda({
      supabase,
      userId: user.id,
      connectionId: connection.id,
      accountId: account.id,
      apiKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo sincronizar Bitpanda.";
    await supabase
      .from("exchange_connections")
      .update({ status: "error", last_sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() })
      .eq("id", connection.id)
      .eq("user_id", user.id);
    throw new Error(message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  revalidatePath("/dashboard/movimientos");
  revalidatePath("/dashboard/fiscalidad");
  return { success: true };
}
