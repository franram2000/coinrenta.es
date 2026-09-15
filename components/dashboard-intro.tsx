"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import CoinRentaLoader from "@/components/coinrenta-loader";

export default function DashboardIntro() {
  const searchParams = useSearchParams();
  const initialEntry = searchParams.get("intro") === "1";
  const [visible, setVisible] = useState(initialEntry);

  const complete = useCallback(() => {
    setVisible(false);
    try { window.sessionStorage.removeItem("coinrenta_pending_entry"); } catch {}
    try {
      window.dispatchEvent(new CustomEvent("coinrenta-entry-ready"));
      if (window.location.search.includes("intro=1")) window.history.replaceState({}, "", "/dashboard");
    } catch {}
  }, []);

  if (!visible) return null;
  return <CoinRentaLoader duration={3000} onComplete={complete} />;
}
