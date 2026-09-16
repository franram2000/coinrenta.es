"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LegalQuickLink() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <Link
      href="/legal/devoluciones"
      aria-label="Consultar política de desistimiento y devoluciones"
      style={{
        position: "fixed",
        right: 22,
        bottom: 22,
        zIndex: 9996,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 42,
        padding: "0 14px",
        border: "1px solid rgba(104,238,229,.34)",
        borderRadius: 999,
        background: "rgba(7,14,26,.88)",
        color: "#bffaf5",
        boxShadow: "0 10px 30px rgba(0,0,0,.32), 0 0 24px rgba(104,238,229,.10)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        fontSize: 11,
        fontWeight: 800,
        textDecoration: "none",
      }}
    >
      <span aria-hidden="true" style={{ color: "#68eee5", fontSize: 15, lineHeight: 1 }}>↩</span>
      <span>Devoluciones</span>
    </Link>
  );
}
