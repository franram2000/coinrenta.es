import type { ReactNode } from "react";
import "./dashboard.css";
import "./dashboard-modern.css";
import "./help.css";
import "./bitpanda.css";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "./dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role || "free";

  return (
    <div className="app-shell dashboard-pro-shell">
      <DashboardSidebar role={role} />
      <main className="app-main">{children}</main>
    </div>
  );
}
