"use client";

import { useMemo, useState } from "react";

type Props = { plan: string; interval: string | null; periodEnd: string | null };
type Tier = "essential" | "pro";

const plans = [
  { key: "free" as const, name: "Free", monthly: "0 €", annual: "0 €", eyebrow: "Para empezar", copy: "Conoce CoinRenta y organiza tu información fiscal.", features: ["Hasta 50 operaciones por año", "Importación de CSV", "Resumen fiscal básico", "Cálculo FIFO"] },
  { key: "essential" as const, name: "Esencial", monthly: "3,49 €", annual: "29,90 €", eyebrow: "Para la mayoría", copy: "Todo lo necesario para llevar tu fiscalidad cripto al día.", features: ["Hasta 1.000 operaciones por año", "Todas las funciones de Free", "Renta y resumen fiscal completo", "Detección de incidencias", "Histórico y conexiones CSV"] },
  { key: "pro" as const, name: "Pro", monthly: "7,99 €", annual: "79,90 €", eyebrow: "Máximo control", copy: "Para carteras activas y usuarios con varios exchanges.", features: ["Hasta 5.000 operaciones por año", "Todas las funciones de Esencial", "Conexiones y sincronización avanzada", "Conciliación y revisión avanzada", "Prioridad en soporte"] },
];

export default function SubscriptionPlans({ plan, interval, periodEnd }: Props) {
  const [billing, setBilling] = useState<"month" | "year">(interval === "year" ? "year" : "month");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savings = useMemo(() => Math.round((1 - 29.9 / (3.49 * 12)) * 100), []);

  async function checkout(tier: Tier) {
    setPending(`${tier}-${billing}`); setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: tier, interval: billing }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No se pudo iniciar el pago.");
      window.location.assign(data.url);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo iniciar el pago."); setPending(null); }
  }

  async function portal() {
    setPending("portal"); setError(null);
    try { const response = await fetch("/api/stripe/portal", { method: "POST" }); const data = await response.json(); if (!response.ok || !data.url) throw new Error(data.error || "No se pudo abrir la gestión de la suscripción."); window.location.assign(data.url); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo abrir la gestión de la suscripción."); setPending(null); }
  }

  const paidPlan = plan === "essential" || plan === "pro";
  const end = periodEnd ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(periodEnd)) : null;

  return <>
    <div className="billing-toggle"><button className={billing === "month" ? "selected" : ""} onClick={() => setBilling("month")}>Mensual</button><button className={billing === "year" ? "selected" : ""} onClick={() => setBilling("year")}>Anual <span>AHORRA {savings}%</span></button></div>
    {error && <div className="subscription-error" role="alert">{error}</div>}
    <div className="plan-grid">
      {plans.map((item) => { const current = plan === item.key; const price = billing === "year" ? item.annual : item.monthly; const action = item.key === "free" ? "Plan actual" : current ? "Gestionar suscripción" : `Elegir ${item.name}`; return <article className={`plan-card ${item.key === "essential" ? "featured" : ""} ${current ? "current" : ""}`} key={item.key}>
        {item.key === "essential" && <div className="plan-ribbon">MÁS ELEGIDO</div>}
        <div className="plan-top"><span className="plan-eyebrow">{item.eyebrow}</span>{current && <span className="plan-current">ACTUAL</span>}</div>
        <h2>{item.name}</h2><p className="plan-copy">{item.copy}</p>
        <div className="plan-price"><strong>{price}</strong>{item.key !== "free" && <span>/{billing === "year" ? "año" : "mes"}</span>}</div>
        {billing === "year" && item.key !== "free" && <small className="plan-equivalent">≈ {(item.key === "essential" ? 29.9 / 12 : 79.9 / 12).toFixed(2).replace(".", ",")} €/mes · facturado anualmente</small>}
        <ul>{item.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
        {item.key === "free" ? <button className="plan-button secondary" disabled>{action}</button> : <button className={`plan-button ${item.key === "essential" ? "primary" : "pro"}`} disabled={pending !== null} onClick={() => current ? portal() : checkout(item.key)}>{pending === `${item.key}-${billing}` || (current && pending === "portal") ? "Abriendo…" : action}</button>}
      </article>; })}
    </div>
    {paidPlan && end && <p className="subscription-period">Tu periodo actual termina el <strong>{end}</strong>.</p>}
  </>;
}
