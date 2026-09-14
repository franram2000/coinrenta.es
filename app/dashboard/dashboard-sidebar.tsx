"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CoinRentaLogo from "@/components/coinrenta-logo";
import LogoutButton from "@/components/logout-button";

const nav = [
  ["▦", "Resumen", "/dashboard"],
  ["↔", "Conexiones", "/dashboard/exchanges"],
  ["≋", "Movimientos", "/dashboard/movimientos"],
  ["€", "Renta", "/dashboard/renta"],
  ["?", "Ayuda", "/dashboard/ayuda"],
  ["⚙", "Configuración", "/dashboard/configuracion"],
] as const;

type NavItem = readonly [string, string, string];

export default function DashboardSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const items: readonly NavItem[] = role === "admin"
    ? [...nav, ["♙", "Usuarios", "/dashboard/usuarios"] as const]
    : nav;

  const activeFor = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <aside className="app-sidebar">
        <CoinRentaLogo />
        <div className="sidebar-nav-label">Panel</div>
        <nav className="app-nav" aria-label="Navegación principal">
          {nav.map(([icon, label, href]) => <Link className={`app-nav-item ${activeFor(href) ? "active" : ""}`} href={href} key={href}><span>{icon}</span>{label}</Link>)}
          {role === "admin" && <Link className={`app-nav-item admin-nav ${activeFor("/dashboard/usuarios") ? "active" : ""}`} href="/dashboard/usuarios"><span>♙</span>Usuarios</Link>}
        </nav>
        <div className="sidebar-bottom"><LogoutButton /></div>
      </aside>

      <button type="button" className="mobile-menu-toggle" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="mobile-dashboard-menu" onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true" />
      </button>

      <button type="button" className={`mobile-menu-overlay ${open ? "open" : ""}`} aria-label="Cerrar menú" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />

      <aside id="mobile-dashboard-menu" className={`mobile-menu-panel ${open ? "open" : ""}`} aria-label="Menú móvil" aria-hidden={!open}>
        <div className="mobile-menu-head">
          <CoinRentaLogo />
          <button type="button" className="mobile-menu-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="mobile-menu-label">Panel</div>
        <nav className="mobile-menu-nav" aria-label="Navegación móvil">
          {items.map(([icon, label, href]) => <Link className={`app-nav-item ${activeFor(href) ? "active" : ""}`} href={href} key={href} onClick={() => setOpen(false)}><span>{icon}</span>{label}</Link>)}
        </nav>
        <div className="mobile-menu-logout"><LogoutButton /></div>
      </aside>
    </>
  );
}
