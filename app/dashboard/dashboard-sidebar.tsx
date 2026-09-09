"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CoinRentaLogo from "@/components/coinrenta-logo";
import LogoutButton from "@/components/logout-button";

const nav = [
  ["▦", "Resumen", "/dashboard"],
  ["↔", "Conexiones", "/dashboard/exchanges"],
  ["≋", "Movimientos", "/dashboard/movimientos"],
  ["€", "Fiscalidad", "/dashboard/fiscalidad"],
  ["?", "Ayuda", "/dashboard/ayuda"],
  ["⚙", "Configuración", "/dashboard/configuracion"],
] as const;

export default function DashboardSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const plan = role === "admin" ? "Admin" : role === "pro" ? "Pro" : "Free";
  const hasPro = role !== "free";

  return (
    <aside className="app-sidebar">
      <CoinRentaLogo />
      <div className="sidebar-nav-label">Panel</div>
      <nav className="app-nav" aria-label="Navegación principal">
        {nav.map(([icon, label, href]) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link className={`app-nav-item ${active ? "active" : ""}`} href={href} key={href}>
              <span>{icon}</span>{label}
            </Link>
          );
        })}
        {role === "admin" && (
          <Link className={`app-nav-item admin-nav ${pathname.startsWith("/dashboard/usuarios") ? "active" : ""}`} href="/dashboard/usuarios">
            <span>♙</span>Usuarios
          </Link>
        )}
      </nav>
      <div className="sidebar-pro-card">
        <div className="pro-card-title"><span className="pro-crown">♛</span><strong>Plan {plan}</strong><span className="plan-active">Activo</span></div>
        <p>{hasPro ? "Acceso completo a las funcionalidades." : "Funciones esenciales. Pásate a Pro para desbloquear informes y automatizaciones."}</p>
        <Link className="btn btn-outline-full" href="/dashboard/configuracion">{hasPro ? "Gestionar suscripción" : "Ver Plan Pro"}</Link>
      </div>
      <div className="sidebar-bottom"><LogoutButton /></div>
    </aside>
  );
}
