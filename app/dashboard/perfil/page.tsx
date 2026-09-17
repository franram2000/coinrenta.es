import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reconcileSubscription } from "@/lib/paddle/billing";
import ProfilePanel from "../profile-panel";

type ProfileRow = {
  display_name: string | null;
  country_code: string | null;
  timezone: string | null;
  role: string | null;
  subscription_plan: string | null;
  subscription_interval: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
};

export const metadata: Metadata = { title: "Mi Perfil", description: "Gestiona tu información personal, seguridad y suscripción de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try { await reconcileSubscription(user.id, user.email || null); } catch (error) { console.error("Paddle profile reconciliation error", error); }

  const { data: profileData, error } = await supabase.from("profiles").select("display_name,country_code,timezone,role,subscription_plan,subscription_interval,subscription_status,subscription_current_period_end").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  const profile = profileData as ProfileRow | null;
  const plan = profile?.role === "admin" ? "admin" : profile?.subscription_plan || "free";

  return <><header className="app-topbar profile-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Mi Perfil</h1><p>Tu información personal, seguridad y suscripción, reunidas en un solo lugar.</p></div></header><section className="dashboard-content profile-content"><ProfilePanel email={user.email || ""} emailVerified={Boolean(user.email_confirmed_at)} displayName={profile?.display_name || null} country={profile?.country_code || "ES"} timezone={profile?.timezone || "Europe/Madrid"} role={profile?.role || "free"} plan={plan} interval={profile?.subscription_interval || null} status={profile?.subscription_status || null} periodEnd={profile?.subscription_current_period_end || null} createdAt={user.created_at} /></section></>;
}
