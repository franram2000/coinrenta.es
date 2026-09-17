import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WebSettings from "../web-settings";

export const metadata: Metadata = { title: "Configuración", description: "Configura la experiencia y el funcionamiento de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <><header className="app-topbar settings-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Configuración</h1><p>Preferencias de la aplicación, lectura y comportamiento. La información de tu cuenta está en Mi Perfil.</p></div></header><section className="dashboard-content settings-content"><WebSettings /></section></>;
}
