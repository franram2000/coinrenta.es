"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.role !== "admin") throw new Error("No autorizado");
  return { supabase, user };
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

  const { data: profile, error: profileError } = await supabase.from("profiles").select("stripe_customer_id,stripe_subscription_id,subscription_status").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const subscriptionId = String(profile?.stripe_subscription_id || "").trim();
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  if (subscriptionId && stripeSecret && ["active", "trialing", "past_due", "unpaid"].includes(String(profile?.subscription_status || ""))) {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${stripeSecret}` },
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message || "No se pudo cancelar la suscripción de Stripe. La cuenta no se ha eliminado.");
  }

  const { data: connections, error: connectionsError } = await supabase.from("exchange_connections").select("id,provider_type,api_secret_id").eq("user_id", user.id);
  if (connectionsError) throw new Error(connectionsError.message);
  for (const connection of connections || []) {
    if (String(connection.provider_type || "") === "api" && connection.api_secret_id) {
      const { error } = await supabase.rpc("delete_exchange_secret", { p_connection_id: connection.id });
      if (error) throw new Error(`No se pudo eliminar de forma segura una credencial: ${error.message}`);
    }
  }

  const accountTables = ["balance_snapshots", "transactions", "imports"];
  const { data: accounts, error: accountsError } = await supabase.from("accounts").select("id").eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);
  const accountIds = (accounts || []).map((account: { id: string }) => account.id);
  if (accountIds.length) {
    for (const table of accountTables) {
      const { error } = await supabase.from(table).delete().eq("user_id", user.id).in("account_id", accountIds);
      if (error) throw new Error(`No se pudo eliminar ${table}: ${error.message}`);
    }
    const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).in("id", accountIds);
    if (error) throw new Error(`No se pudieron eliminar las cuentas: ${error.message}`);
  }
  const { error: connectionDeleteError } = await supabase.from("exchange_connections").delete().eq("user_id", user.id);
  if (connectionDeleteError) throw new Error(`No se pudieron eliminar las conexiones: ${connectionDeleteError.message}`);

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  );
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteUserError) throw new Error(`No se pudo eliminar la cuenta de autenticación: ${deleteUserError.message}`);

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

export async function adminUpdateUser(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const targetId = String(formData.get("user_id") || "").trim(); const role = String(formData.get("role") || "free").trim(); const isActive = String(formData.get("is_active") || "true") === "true";
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
  const { supabase, user } = await requireAdmin(); const targetId = String(formData.get("user_id") || "").trim();
  if (!targetId) throw new Error("Usuario no encontrado"); if (targetId === user.id) throw new Error("No puedes eliminar tu propia cuenta de administrador.");
  const { data: target, error: targetError } = await supabase.from("profiles").select("id,role,is_active").eq("id", targetId).maybeSingle();
  if (targetError) throw new Error(targetError.message); if (!target) throw new Error("El usuario no existe.");
  if (target.role === "admin" && target.is_active !== false) {
    const { count, error: countError } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
    if (countError) throw new Error(`No se pudo comprobar los administradores: ${countError.message}`); if ((count ?? 0) <= 1) throw new Error("No puedes eliminar al único administrador activo.");
  }
  const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", targetId); if (error) throw new Error(`No se pudo desactivar el usuario: ${error.message}`);
  revalidatePath("/dashboard/usuarios"); revalidatePath("/dashboard");
}
