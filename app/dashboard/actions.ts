"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addExchangeConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const exchangeId = String(formData.get("exchange_id") || "");
  const label = String(formData.get("label") || "").trim() || null;
  if (!exchangeId) return;

  const { data: connection, error } = await supabase
    .from("exchange_connections")
    .insert({ user_id: user.id, exchange_id: exchangeId, label, status: "pending" })
    .select("id")
    .single();

  if (!error && connection) {
    await supabase.from("accounts").insert({
      user_id: user.id,
      connection_id: connection.id,
      account_type: "exchange",
      name: label || "Nueva cuenta",
      is_active: true,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
}

export async function createImportRecord(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fileName = String(formData.get("file_name") || "").trim();
  const exchangeId = String(formData.get("exchange_id") || "").trim() || null;
  const accountId = String(formData.get("account_id") || "").trim() || null;
  if (!fileName) return;

  await supabase.from("imports").insert({
    user_id: user.id,
    exchange_id: exchangeId,
    account_id: accountId,
    source_type: "csv",
    file_name: fileName,
    status: "pending",
    rows_total: 0,
    rows_processed: 0,
    rows_failed: 0,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/importar");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") || "").trim() || null;
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/configuracion");
}
