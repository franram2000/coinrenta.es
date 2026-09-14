"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (profile?.role !== "admin") throw new Error("No autorizado");

  return { user, supabase };
}

export async function deleteExchangeConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const connectionId = String(formData.get("connection_id") || "").trim();
  if (!connectionId) return;
  const { data: connection, error: connectionError } = await supabase.from("exchange_connections").select("id").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Conexión no encontrada.");
  const { data: accounts, error: accountsError } = await supabase.from("accounts").select("id").eq("connection_id", connectionId).eq("user_id", user.id);
  if (accountsError) throw new Error(accountsError.message);
  const accountIds = (accounts || []).map((account: { id: string }) => account.id);
  if (accountIds.length) {
    const { error: snapshotError } = await supabase.from("balance_snapshots").delete().eq("user_id", user.id).in("account_id", accountIds);
    if (snapshotError) throw new Error(`No se pudieron borrar los saldos: ${snapshotError.message}`);
    const { error: importsError } = await supabase.from("imports").delete().eq("user_id", user.id).in("account_id", accountIds);
    if (importsError) throw new Error(`No se pudieron borrar las importaciones: ${importsError.message}`);
    const { error: transactionsError } = await supabase.from("transactions").delete().eq("user_id", user.id).in("account_id", accountIds);
    if (transactionsError) throw new Error(`No se pudieron borrar los movimientos: ${transactionsError.message}`);
    const { error: accountsDeleteError } = await supabase.from("accounts").delete().eq("user_id", user.id).in("id", accountIds);
    if (accountsDeleteError) throw new Error(`No se pudo borrar la cuenta: ${accountsDeleteError.message}`);
  }
  const { error: deleteError } = await supabase.from("exchange_connections").delete().eq("id", connectionId).eq("user_id", user.id);
  if (deleteError) throw new Error(`No se pudo borrar la conexión: ${deleteError.message}`);
  revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos"); revalidatePath("/dashboard/fiscalidad");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const displayName = String(formData.get("display_name") || "").trim() || null;
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard"); revalidatePath("/dashboard/configuracion");
}

export async function adminUpdateUser(formData: FormData) {
  const { user } = await requireAdmin();
  const targetId = String(formData.get("user_id") || "").trim();
  const role = String(formData.get("role") || "free").trim();
  const isActive = String(formData.get("is_active") || "true") === "true";

  if (!targetId) throw new Error("Usuario no encontrado");
  if (!["free", "pro", "admin"].includes(role)) throw new Error("Plan/rol no válido");
  if (targetId === user.id && role !== "admin") throw new Error("No puedes quitarte tus permisos de administrador desde tu propia cuenta.");
  if (targetId === user.id && !isActive) throw new Error("No puedes desactivar tu propia cuenta de administrador.");

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role, is_active: isActive }).eq("id", targetId);
  if (error) throw new Error(`No se pudo actualizar el usuario: ${error.message}`);

  revalidatePath("/dashboard/usuarios");
  revalidatePath("/dashboard");
}

export async function adminDeleteUser(formData: FormData) {
  const { user } = await requireAdmin();
  const targetId = String(formData.get("user_id") || "").trim();
  if (!targetId) throw new Error("Usuario no encontrado");
  if (targetId === user.id) throw new Error("No puedes eliminar tu propia cuenta de administrador.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetId, false);
  if (error) throw new Error(`No se pudo eliminar el usuario: ${error.message}`);

  revalidatePath("/dashboard/usuarios");
  revalidatePath("/dashboard");
}
