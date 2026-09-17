"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CoinRentaLogo from "@/components/coinrenta-logo";
import LogoutButton from "@/components/logout-button";
import UiIcon, { type UiIconName } from "@/components/ui-icon";

type NavItem = { icon: UiIconName; label: string; href: string };

const nav: NavItem[] = [
  { icon: "dashboard", label: "Resumen", href: "/dashboard" },
  { icon: "connections", label: "Conexiones", href: "/dashboard/exchanges" },
  { icon: "movements", label: "Movimientos", href: "/dashboard/movimientos" },
  { icon: "renta", label: "Renta", href: "/dashboard/renta" },
  { icon: "reports", label: "Informes", href: "/dashboard/informes" },
  { icon: "help", label: "Ayuda", href: "/dashboard/ayuda" },
  { icon: "settings", label: "Configuración", href: "/dashboard/configuracion" },
  { icon: "profile", label: "Mi Perfil", href: "/dashboard/perfil" },
];

export default function DashboardSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { if (!open) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown); }, [open]);

  const items: NavItem[] = role === "admin" ? [...nav, { icon: "users", label: "Usuarios", href: "/dashboard/usuarios" }] : nav;
  const activeFor = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const renderItem = (item: NavItem, mobile = false) => <Link className={`app-nav-item ${activeFor(item.href) ? "active" : ""}`} href={item.href} key={item.href} onClick={mobile ? () => setOpen(false) : undefined}><span className="nav-icon" aria-hidden="true"><UiIcon name={item.icon} size={20}/></span>{item.label}</Link>;

  return <>
    <aside className="app-sidebar">
      <CoinRentaLogo /><div className="sidebar-nav-label">Panel</div>
      <nav className="app-nav" aria-label="Navegación principal">{items.map((item) => renderItem(item))}</nav>
      <div className="sidebar-bottom"><LogoutButton /></div>
    </aside>
    <button type="button" className="mobile-menu-toggle" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="mobile-dashboard-menu" onClick={() => setOpen((value) => !value)}><span aria-hidden="true" /></button>
    <button type="button" className={`mobile-menu-overlay ${open ? "open" : ""}`} aria-label="Cerrar menú" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <aside id="mobile-dashboard-menu" className={`mobile-menu-panel ${open ? "open" : ""}`} aria-label="Menú móvil" aria-hidden={!open}>
      <div className="mobile-menu-head"><CoinRentaLogo /><button type="button" className="mobile-menu-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button></div>
      <div className="mobile-menu-label">Panel</div>
      <nav className="mobile-menu-nav" aria-label="Navegación móvil">{items.map((item) => renderItem(item, true))}</nav>
      <div className="mobile-menu-logout"><LogoutButton /></div>
    </aside>
  </>;
}
