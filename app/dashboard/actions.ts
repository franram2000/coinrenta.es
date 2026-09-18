"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.role !== "admin") throw new Error("No autorizado");
  return { supabase, user };
}

async function cancelPaddleSubscriptionIfNeeded(paddleSubscriptionId: string | null, subscriptionStatus: string | null) {
  if (!paddleSubscriptionId || !["active", "trialing", "past_due", "paused"].includes(String(subscriptionStatus || ""))) return;
  const paddleKey = process.env.PADDLE_API_KEY || "";
  if (!paddleKey) throw new Error("No se puede eliminar el usuario porque Paddle no está configurado para cancelar su suscripción automáticamente.");

  const environment = process.env.PADDLE_ENVIRONMENT === "sandbox" ? Environment.sandbox : Environment.production;
  const paddle = new Paddle(paddleKey, { environment });
  try {
    const subscription = await paddle.subscriptions.get(paddleSubscriptionId);
    if (subscription?.scheduledChange) {
      await paddle.subscriptions.update(paddleSubscriptionId, { scheduledChange: null });
    }
    await paddle.subscriptions.cancel(paddleSubscriptionId, { effectiveFrom: "immediately" });
  } catch (error) {
    throw new Error(
      `No se pudo cancelar la suscripción de Paddle. El usuario no se ha eliminado. ${error instanceof Error ? error.message : ""}`.trim()
    );
  }
}

export async function deleteExchangeConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const connectionId = String(formData.get("connection_id") || "").trim();
  if (!connectionId) return;
  const { data: connection, error: connectionError } = await supabase.from("exchange_connections").select("id,provider_type,api_secret_id").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Conexión no encontrada.");
  if (String(connection.provider_type || "") === "api" && connection.api_secret_id) {
    const { error: secretError } = await supabase.rpc("delete_exchange_secret", { p_connection_id: connectionId });
    if (secretError) throw new Error(`No se pudo eliminar de forma segura la clave API: ${secretError.message}`);
  }
  const { data: accounts, error: accountsError } = await supabase.from("accounts").select("id").eq("connection_id", connectionId).eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);
  const accountIds = (accounts || []).map((account: { id: string }) => account.id);
  if (accountIds.length) {
    for (const table of ["balance_snapshots", "transactions", "imports"]) {
      const { error } = await supabase.from(table).delete().eq("user_id", user.id).in("account_id", accountIds);
      if (error) throw new Error(`No se pudo borrar ${table}: ${error.message}`);
    }
    const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).in("id", accountIds);
    if (error) throw new Error(`No se pudo borrar la cuenta: ${error.message}`);
  }
  const { error: deleteError } = await supabase.from("exchange_connections").delete().eq("id", connectionId).eq("user_id", user.id);
  if (deleteError) throw new Error(`No se pudo borrar la conexión: ${deleteError.message}`);
  revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos"); revalidatePath("/dashboard/renta");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const displayName = String(formData.get("display_name") || "").trim() || null;
  const countryCode = String(formData.get("country_code") || "ES").trim().toUpperCase();
  const timezone = String(formData.get("timezone") || "Europe/Madrid").trim();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("País no válido.");
  if (!timezone || timezone.length > 100) throw new Error("Zona horaria no válida.");
  const { error } = await supabase.from("profiles").update({ display_name: displayName, country_code: countryCode, timezone }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard"); revalidatePath("/dashboard/configuracion");
}

export async function deleteOwnAccount(formData: FormData) {
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (confirmation !== "ELIMINAR") throw new Error("Escribe ELIMINAR para confirmar el borrado de la cuenta.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("paddle_subscription_id,subscription_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  // Paddle is the only billing provider used by CoinRenta. Cancel immediately
  // before deleting user data so account deletion can never leave billing active.
  const paddleSubscriptionId = String(profile?.paddle_subscription_id || "").trim();
  const subscriptionStatus = String(profile?.subscription_status || "");
  if (paddleSubscriptionId && ["active", "trialing", "past_due", "paused"].includes(subscriptionStatus)) {
    const paddleKey = process.env.PADDLE_API_KEY || "";
    if (!paddleKey) throw new Error("No se puede eliminar la cuenta porque Paddle no está configurado para cancelar la suscripción automáticamente.");

    const paddle = new Paddle(paddleKey, { environment: Environment.sandbox });
    try {
      // A subscription with a pending scheduled change is locked for other
      // changes. Paddle requires the scheduled change to be cleared first.
      const subscription = await paddle.subscriptions.get(paddleSubscriptionId);
      if (subscription?.scheduledChange) {
        await paddle.subscriptions.update(paddleSubscriptionId, { scheduledChange: null });
      }

      await paddle.subscriptions.cancel(paddleSubscriptionId, { effectiveFrom: "immediately" });
    } catch (error) {
      throw new Error(`No se pudo cancelar la suscripción de Paddle. La cuenta no se ha eliminado. ${error instanceof Error ? error.message : ""}`.trim());
    }
  }

  const { data: connections, error: connectionsError } = await supabase
    .from("exchange_connections")
    .select("id,provider_type,api_secret_id")
    .eq("user_id", user.id);
  if (connectionsError) throw new Error(connectionsError.message);

  for (const connection of connections || []) {
    if (String(connection.provider_type || "") === "api" && connection.api_secret_id) {
      const { error } = await supabase.rpc("delete_exchange_secret", { p_connection_id: connection.id });
      if (error) throw new Error(`No se pudo eliminar de forma segura una credencial: ${error.message}`);
    }
  }

  const accountTables = ["balance_snapshots", "transactions", "imports"];
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);

  const accountIds = (accounts || []).map((account: { id: string }) => account.id);
  if (accountIds.length) {
    for (const table of accountTables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("user_id", user.id)
        .in("account_id", accountIds);
      if (error) throw new Error(`No se pudo eliminar ${table}: ${error.message}`);
    }

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("user_id", user.id)
      .in("id", accountIds);
    if (error) throw new Error(`No se pudieron eliminar las cuentas: ${error.message}`);
  }

  const { error: connectionDeleteError } = await supabase
    .from("exchange_connections")
    .delete()
    .eq("user_id", user.id);
  if (connectionDeleteError) throw new Error(`No se pudieron eliminar las conexiones: ${connectionDeleteError.message}`);

  const admin = createAdminClient();
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteUserError) throw new Error(`No se pudo eliminar la cuenta de autenticación: ${deleteUserError.message}`);

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

export async function adminUpdateUser(formData: FormData) {
  const { supabase, user } = await requireAdmin(); const targetId = String(formData.get("user_id") || "").trim(); const role = String(formData.get("role") || "free").trim(); const isActive = String(formData.get("is_active") || "true") === "true";
  if (!targetId) throw new Error("Usuario no encontrado"); if (!["free", "pro", "admin"].includes(role)) throw new Error("Plan/rol no válido");
  if (targetId === user.id && (role !== "admin" || !isActive)) throw new Error("No puedes quitarte o desactivar tus propios permisos de administrador.");
  const { data: target, error: targetError } = await supabase.from("profiles").select("id,role,is_active").eq("id", targetId).maybeSingle();
  if (targetError) throw new Error(targetError.message); if (!target) throw new Error("El usuario no existe.");
  if (target.role === "admin" && (role !== "admin" || !isActive)) {
    const { count, error: countError } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
    if (countError) throw new Error(`No se pudo comprobar los administradores: ${countError.message}`); if ((count ?? 0) <= 1) throw new Error("Debe existir al menos un administrador activo.");
  }
  const { error } = await supabase.from("profiles").update({ role, is_active: isActive }).eq("id", targetId); if (error) throw new Error(`No se pudo actualizar el usuario: ${error.message}`);
  revalidatePath("/dashboard/usuarios"); revalidatePath("/dashboard");
}

export async function adminDeleteUser(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const targetId = String(formData.get("user_id") || "").trim();

  if (!targetId) throw new Error("Usuario no encontrado.");
  if (targetId === user.id) throw new Error("No puedes eliminar tu propia cuenta de administrador.");

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id,role,is_active,paddle_subscription_id,subscription_status")
    .eq("id", targetId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("El usuario no existe.");

  if (target.role === "admin" && target.is_active !== false) {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countError) throw new Error(`No se pudo comprobar los administradores: ${countError.message}`);
    if ((count ?? 0) <= 1) throw new Error("No puedes eliminar al único administrador activo.");
  }

  await cancelPaddleSubscriptionIfNeeded(
    target.paddle_subscription_id || null,
    target.subscription_status || null,
  );

  const admin = createAdminClient();
  const { data: connections, error: connectionsError } = await admin
    .from("exchange_connections")
    .select("id,api_secret_id")
    .eq("user_id", targetId);
  if (connectionsError) throw new Error(`No se pudieron cargar las conexiones del usuario: ${connectionsError.message}`);

  for (const connection of connections || []) {
    if (connection.api_secret_id) {
      const { error } = await admin.rpc("delete_exchange_secret_for_admin", {
        p_connection_id: connection.id,
        p_user_id: targetId,
      });
      if (error) throw new Error(`No se pudo eliminar una credencial API: ${error.message}`);
    }
  }

  const { data: accounts, error: accountsError } = await admin
    .from("accounts")
    .select("id")
    .eq("user_id", targetId);
  if (accountsError) throw new Error(`No se pudieron cargar las cuentas del usuario: ${accountsError.message}`);

  const accountIds = (accounts || []).map((account: { id: string }) => account.id);

  const { data: transactions, error: transactionsLookupError } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", targetId);
  if (transactionsLookupError) throw new Error(`No se pudieron preparar los movimientos del usuario: ${transactionsLookupError.message}`);

  const transactionIds = (transactions || []).map((row: { id: string }) => row.id);

  if (transactionIds.length) {
    for (const table of ["transaction_legs", "tax_disposals"]) {
      const { error } = await admin
        .from(table)
        .delete()
        .eq("user_id", targetId);
      if (error && !String(error.message).toLowerCase().includes("does not exist")) {
        throw new Error(`No se pudo eliminar ${table}: ${error.message}`);
      }
    }

    const { error: legsError } = await admin
      .from("transaction_legs")
      .delete()
      .in("transaction_id", transactionIds);
    if (legsError && !String(legsError.message).toLowerCase().includes("does not exist")) {
      throw new Error(`No se pudieron eliminar los detalles de movimientos: ${legsError.message}`);
    }
  }

  for (const table of ["tax_lots", "tax_years"]) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq("user_id", targetId);
    if (error && !String(error.message).toLowerCase().includes("does not exist")) {
      throw new Error(`No se pudo eliminar ${table}: ${error.message}`);
    }
  }

  for (const table of ["balance_snapshots", "transactions", "imports"]) {
    const query = admin.from(table).delete().eq("user_id", targetId);
    const { error } = accountIds.length
      ? await query.in("account_id", accountIds)
      : await query;
    if (error) throw new Error(`No se pudo eliminar ${table}: ${error.message}`);
  }

  if (accountIds.length) {
    const { error: accountDeleteError } = await admin
      .from("accounts")
      .delete()
      .eq("user_id", targetId)
      .in("id", accountIds);
    if (accountDeleteError) throw new Error(`No se pudieron eliminar las cuentas: ${accountDeleteError.message}`);
  }

  const { error: connectionDeleteError } = await admin
    .from("exchange_connections")
    .delete()
    .eq("user_id", targetId);
  if (connectionDeleteError) throw new Error(`No se pudieron eliminar las conexiones: ${connectionDeleteError.message}`);

  const { error: profileDeleteError } = await admin
    .from("profiles")
    .delete()
    .eq("id", targetId);
  if (profileDeleteError) throw new Error(`No se pudo eliminar el perfil: ${profileDeleteError.message}`);

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(targetId, false);
  if (deleteUserError) throw new Error(`No se pudo eliminar la cuenta de autenticación: ${deleteUserError.message}`);

  revalidatePath("/dashboard/usuarios");
  revalidatePath("/dashboard");
}

