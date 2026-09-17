"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

function paddleBase() { return process.env.PADDLE_API_BASE_URL || "https://sandbox-api.paddle.com"; }

async function paddleRequest(path: string, init: RequestInit = {}) {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("No está configurado el acceso de Paddle para cancelar la suscripción.");
  const response = await fetch(`${paddleBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error?.detail || result?.error?.message || `Paddle devolvió HTTP ${response.status}.`);
  }
  return result;
}

async function paddleCancelSubscription(subscriptionId: string) {
  const encodedId = encodeURIComponent(subscriptionId);
  const current = await paddleRequest(`/subscriptions/${encodedId}`);
  const scheduledChange = current?.data?.scheduled_change ?? current?.data?.scheduledChange ?? null;

  if (scheduledChange) {
    await paddleRequest(`/subscriptions/${encodedId}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_change: null }),
    });
  }

  await paddleRequest(`/subscriptions/${encodedId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ effective_from: "immediately" }),
  });
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const displayName = String(formData.get("display_name") || "").trim() || null;
  const countryCode = String(formData.get("country_code") || "ES").trim().toUpperCase();
  const timezone = String(formData.get("timezone") || "Europe/Madrid").trim();
  if (displayName && displayName.length > 120) throw new Error("El nombre visible es demasiado largo.");
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("País no válido.");
  if (!timezone || timezone.length > 100) throw new Error("Zona horaria no válida.");
  const { error } = await supabase.from("profiles").update({ display_name: displayName, country_code: countryCode, timezone }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracion");
}

export async function deleteOwnAccount(formData: FormData) {
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (confirmation !== "ELIMINAR") throw new Error("Escribe ELIMINAR para confirmar el borrado de la cuenta.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("paddle_subscription_id,subscription_status").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const status = String(profile?.subscription_status || "");
  const activeStates = ["active", "trialing", "paused"];
  if (profile?.paddle_subscription_id && activeStates.includes(status)) {
    try {
      await paddleCancelSubscription(String(profile.paddle_subscription_id));
    } catch (error) {
      throw new Error(`No se pudo cancelar la suscripción de Paddle. La cuenta no se ha eliminado. ${error instanceof Error ? error.message : ""}`.trim());
    }
  }

  const { data: connections, error: connectionsError } = await supabase.from("exchange_connections").select("id,provider_type,api_secret_id").eq("user_id", user.id);
  if (connectionsError) throw new Error(connectionsError.message);
  for (const connection of connections || []) {
    if (String(connection.provider_type || "") === "api" && connection.api_secret_id) {
      const { error } = await supabase.rpc("delete_exchange_secret", { p_connection_id: connection.id });
      if (error) throw new Error(`No se pudo eliminar de forma segura una credencial: ${error.message}`);
    }
  }

  const { data: accounts, error: accountsError } = await supabase.from("accounts").select("id").eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);
  const accountIds = (accounts || []).map((account: { id: string }) => account.id);
  if (accountIds.length) {
    for (const table of ["balance_snapshots", "transactions", "imports"]) {
      const { error } = await supabase.from(table).delete().eq("user_id", user.id).in("account_id", accountIds);
      if (error) throw new Error(`No se pudo eliminar ${table}: ${error.message}`);
    }
    const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).in("id", accountIds);
    if (error) throw new Error(`No se pudieron eliminar las cuentas: ${error.message}`);
  }

  const { error: connectionDeleteError } = await supabase.from("exchange_connections").delete().eq("user_id", user.id);
  if (connectionDeleteError) throw new Error(`No se pudieron eliminar las conexiones: ${connectionDeleteError.message}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) throw new Error("La eliminación segura de la cuenta no está configurada.");
  const admin = createSupabaseAdmin(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteUserError) throw new Error(`No se pudo eliminar la cuenta de autenticación: ${deleteUserError.message}`);

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
