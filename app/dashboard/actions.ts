"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.role !== "admin") throw new Error("No autorizado");
  return { user };
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
  const admin = createAdminClient();
  if (targetId === user.id && (role !== "admin" || !isActive)) throw new Error("No puedes quitarte o desactivar tus propios permisos de administrador.");

  const { data: target } = await admin.from("profiles").select("id,role,is_active").eq("id", targetId).maybeSingle();
  if (!target) throw new Error("El usuario no existe.");
  if (target.role === "admin" && role !== "admin") {
    const { count, error: countError } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
    if (countError) throw new Error(`No se pudo comprobar los administradores: ${countError.message}`);
    if ((count ?? 0) <= 1) throw new Error("Debe existir al menos un administrador activo.");
  }
  if (target.role === "admin" && !isActive) {
    const { count, error: countError } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
    if (countError) throw new Error(`No se pudo comprobar los administradores: ${countError.message}`);
    if ((count ?? 0) <= 1) throw new Error("Debe existir al menos un administrador activo.");
  }

  const { error } = await admin.from("profiles").update({ role, is_active: isActive }).eq("id", targetId);
  if (error) throw new Error(`No se pudo actualizar el usuario: ${error.message}`);
  revalidatePath("/dashboard/usuarios"); revalidatePath("/dashboard");
}

export async function adminDeleteUser(formData: FormData) {
  const { user } = await requireAdmin();
  const targetId = String(formData.get("user_id") || "").trim();
  if (!targetId) throw new Error("Usuario no encontrado");
  if (targetId === user.id) throw new Error("No puedes eliminar tu propia cuenta de administrador.");
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id,role,is_active").eq("id", targetId).maybeSingle();
  if (!target) throw new Error("El usuario no existe.");
  if (target.role === "admin" && target.is_active !== false) {
    const { count, error: countError } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
    if (countError) throw new Error(`No se pudo comprobar los administradores: ${countError.message}`);
    if ((count ?? 0) <= 1) throw new Error("No puedes eliminar al único administrador activo.");
  }
  const { error } = await admin.auth.admin.deleteUser(targetId, false);
  if (error) throw new Error(`No se pudo eliminar el usuario: ${error.message}`);
  revalidatePath("/dashboard/usuarios"); revalidatePath("/dashboard");
}
