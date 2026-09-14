"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function DashboardIntro() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const enteredDashboard = previousPath.current === null || !previousPath.current.startsWith("/dashboard");
    if (enteredDashboard && pathname.startsWith("/dashboard")) {
      setKey((value) => value + 1);
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), 3000);
      previousPath.current = pathname;
      return () => window.clearTimeout(timer);
    }
    previousPath.current = pathname;
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="landing-intro dashboard-intro" key={key} aria-hidden="true">
      <div className="intro-aura" />
      <div className="intro-mist intro-mist-a" />
      <div className="intro-mist intro-mist-b" />
      <div className="intro-logo-wrap">
        <div className="intro-ring intro-ring-a" />
        <div className="intro-ring intro-ring-b" />
        <img src="/logo.png" alt="" className="intro-logo" />
      </div>
      <p>COINRENTA</p>
    </div>
  );
}
