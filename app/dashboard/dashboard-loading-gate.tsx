"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CoinRentaLoader from "@/components/coinrenta-loader";

const TARGET_PATHS = new Set(["/dashboard", "/dashboard/movimientos", "/dashboard/renta"]);

function isTarget(pathname: string | null) { return TARGET_PATHS.has(pathname || ""); }

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
    const target = isTarget(pathname);
    if (!target) {
      setVisible(false);
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
      return;
    }

    setVisible(true);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    let frame = 0;
    let stableFrames = 0;
    const check = () => {
      const loading = pageStillLoading(pathname || "");
      if (loading) stableFrames = 0;
      else stableFrames += 1;
      if (stableFrames >= 2) setVisible(false);
      frame = window.requestAnimationFrame(check);
    };
    frame = window.requestAnimationFrame(check);

    return () => {
      window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible || !isTarget(pathname)) return;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
    };
  }, [pathname, visible]);

  if (!visible) return null;
  return <>
    <style>{`.app-main:has(.coinrenta-loader-contained) .workspace-loading{opacity:0!important;visibility:hidden!important;pointer-events:none!important}`}</style>
    <CoinRentaLoader contained />
  </>;
}
