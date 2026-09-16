"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CoinRentaLoader from "@/components/coinrenta-loader";

const TARGET_PATHS = new Set(["/dashboard", "/dashboard/movimientos", "/dashboard/renta"]);

function isTarget(pathname: string | null) {
  return TARGET_PATHS.has(pathname || "");
}

function pageStillLoading(pathname: string) {
  if (pathname === "/dashboard") {
    const page = document.querySelector<HTMLElement>(".summary-page");
    if (!page) return true;
    const result = page.querySelector<HTMLElement>(".summary-result-value");
    return result?.textContent?.trim() === "···";
  }
  return Boolean(document.querySelector(".workspace-loading"));
}

export default function DashboardLoadingGate() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(() => isTarget(pathname));

  useEffect(() => {
    if (!isTarget(pathname)) {
      setVisible(false);
      return;
    }

    setVisible(true);
    let frame = 0;
    let stableFrames = 0;

    const check = () => {
      const loading = pageStillLoading(pathname || "");
      if (loading) {
        stableFrames = 0;
      } else {
        stableFrames += 1;
      }
      if (stableFrames >= 2) setVisible(false);
      frame = window.requestAnimationFrame(check);
    };

    frame = window.requestAnimationFrame(check);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  if (!visible) return null;
  return <CoinRentaLoader contained />;
}
