import type { ReactNode } from "react";
import "./dashboard.css";
import "./dashboard-modern.css";
import "./dashboard-layout.css";
import "./help.css";
import "./bitpanda.css";
import "./connections.css";
import "./csv-connections.css";
import "./fiscality.css";
import "./renta/renta.css";
import "./summary.css";
import "./spacing-fix.css";
import "./accessibility.css";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "./dashboard-sidebar";
import DashboardIntro from "@/components/dashboard-intro";
import { repairKrakenBalances } from "./kraken-balance-actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  // Kraken Ledger contains the authoritative running balance. Rebuild the current
  // Kraken snapshot before rendering dashboard sections so the summary never uses
  // the historical transaction sum as the current balance.
  try {
    await repairKrakenBalances();
  } catch {
    // A temporary balance-repair failure must not make the whole dashboard unavailable.
  }

  return <div className="app-shell dashboard-pro-shell"><DashboardIntro /><DashboardSidebar role={profile?.role || "free"} /><main className="app-main">{children}</main></div>;
}
