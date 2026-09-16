"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useMemo, useState } from "react";

type Props = { userId: string; customerEmail: string | null; plan: string; interval: string | null; periodEnd: string | null };
type Tier = "essential" | "pro";

const plans = [
  { key: "free" as const, name: "Free", monthly: "0 €", annual: "0 €", eyebrow: "Para empezar", copy: "Conoce CoinRenta y organiza tu información fiscal.", features: ["Hasta 50 operaciones por año", "Importación de CSV", "Resumen fiscal básico", "Cálculo FIFO"] },
  { key: "essential" as const, name: "Esencial", monthly: "3,49 €", annual: "29,90 €", eyebrow: "Para la mayoría", copy: "Todo lo necesario para llevar tu fiscalidad cripto al día.", features: ["Hasta 1.000 operaciones por año", "Todas las funciones de Free", "Renta y resumen fiscal completo", "Detección de incidencias", "Histórico y conexiones CSV"] },
  { key: "pro" as const, name: "Pro", monthly: "7,99 €", annual: "79,90 €", eyebrow: "Máximo control", copy: "Para carteras activas y usuarios con varios exchanges.", features: ["Hasta 5.000 operaciones por año", "Todas las funciones de Esencial", "Conexiones y sincronización avanzada", "Conciliación y revisión avanzada", "Prioridad en soporte"] },
];

const PRICE_IDS = {
  essential: {
    month: process.env.NEXT_PUBLIC_PADDLE_PRICE_ESSENTIAL_MONTHLY || "pri_01m2nag708jv99wfyg5tas9nj7",
    year: process.env.NEXT_PUBLIC_PADDLE_PRICE_ESSENTIAL_YEARLY || "pri_01m2nak77d41b73gg7edjc6wt5",
  },
  pro: {
    month: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY || "pri_01m2nan6ame0k307m9fy2d18n6",
    year: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY || "pri_01m2napvxh7jx0qgwsp4myrz08",
  },
} as const;

export default function SubscriptionPlans({ userId, customerEmail, plan, interval, periodEnd }: Props) {
  const [billing, setBilling] = useState<"month" | "year">(interval === "year" ? "year" : "month");
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savings = useMemo(() => Math.round((1 - 29.9 / (3.49 * 12)) * 100), []);

  useEffect(() => {
    let cancelled = false;
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";
    if (!token) {
      setError("Falta configurar el Client-side Token de Paddle.");
      return;
    }

    initializePaddle({ token, environment }).then((instance) => {
      if (!cancelled && instance) setPaddle(instance);
    }).catch(() => {
      if (!cancelled) setError("No se pudo inicializar Paddle Checkout.");
    });

    return () => { cancelled = true; };
  }, []);

  function checkout(tier: Tier) {
    setPending(`${tier}-${billing}`); setError(null);
    try {
      if (!paddle) throw new Error("Paddle todavía no está listo. Inténtalo de nuevo en unos segundos.");
      const priceId = PRICE_IDS[tier][billing];
      if (!priceId) throw new Error("El precio de Paddle no está configurado para este plan.");

      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { user_id: userId },
        ...(customerEmail ? { customer: { email: customerEmail } } : {}),
        settings: {
          displayMode: "overlay",
          theme: "dark",
          variant: "one-page",
          successUrl: `${window.location.origin}/dashboard/suscripcion?success=1`,
        },
      });
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
      setPending(null);
    }
  }

  async function portal() {
    setPending("portal"); setError(null);
    try {
      const response = await fetch("/api/paddle/portal", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No se pudo abrir la gestión de la suscripción.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la gestión de la suscripción.");
      setPending(null);
    }
  }

  const paidPlan = plan === "essential" || plan === "pro";
  const end = periodEnd ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(periodEnd)) : null;

  return <>
    <div className="billing-toggle"><button className={billing === "month" ? "selected" : ""} onClick={() => setBilling("month")}>Mensual</button><button className={billing === "year" ? "selected" : ""} onClick={() => setBilling("year")}>Anual <span>AHORRA {savings}%</span></button></div>
    {error && <div className="subscription-error" role="alert">{error}</div>}
    <div className="plan-grid">
      {plans.map((item) => {
        const current = plan === item.key;
        const price = billing === "year" ? item.annual : item.monthly;
        const action = item.key === "free" ? "Plan actual" : current ? "Gestionar suscripción" : `Elegir ${item.name}`;
        const configured = item.key === "free" || Boolean(PRICE_IDS[item.key as Tier]?.[billing]);
        return <article className={`plan-card ${item.key === "essential" ? "featured" : ""} ${current ? "current" : ""}`} key={item.key}>
          {item.key === "essential" && <div className="plan-ribbon">MÁS ELEGIDO</div>}
          <div className="plan-top"><span className="plan-eyebrow">{item.eyebrow}</span>{current && <span className="plan-current">ACTUAL</span>}</div>
          <h2>{item.name}</h2><p className="plan-copy">{item.copy}</p>
          <div className="plan-price"><strong>{price}</strong>{item.key !== "free" && <span>/{billing === "year" ? "año" : "mes"}</span>}</div>
          {billing === "year" && item.key !== "free" && <small className="plan-equivalent">≈ {(item.key === "essential" ? 29.9 / 12 : 79.9 / 12).toFixed(2).replace(".", ",")} €/mes · facturado anualmente</small>}
          <ul>{item.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
          {item.key === "free" ? <button className="plan-button secondary" disabled>{action}</button> : <button className={`plan-button ${item.key === "essential" ? "primary" : "pro"}`} disabled={pending !== null || !configured} onClick={() => current ? portal() : checkout(item.key)}>{pending === `${item.key}-${billing}` || (current && pending === "portal") ? "Abriendo…" : action}</button>}
        </article>;
      })}
    </div>
    {paidPlan && end && <p className="subscription-period">Tu periodo actual termina el <strong>{end}</strong>.</p>}
  </>;
}
