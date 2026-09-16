"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LegalQuickLink() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <Link className="legal-quick-link" href="/legal/devoluciones" aria-label="Consultar política de desistimiento y devoluciones">
      <span aria-hidden="true">↩</span>
      <span>Devoluciones</span>
    </Link>
  );
}
