import Link from "next/link";
import "./pricing.css";

export const dynamic = "force-static";

const plans = [
  {
    name: "Gratis",
    price: "0 €",
    period: "para empezar",
    description: "Explora CoinRenta y organiza una primera visión de tu actividad cripto.",
    features: ["Espacio personal", "Importación y organización de datos", "Vista general de movimientos", "Sin compromiso"],
    cta: "Crear cuenta gratis",
    href: "/registro",
  },
  {
    name: "Esencial",
    price: "3,49 €",
    period: "/ mes",
    annual: "o 29,90 € / año",
    description: "Para tener tu actividad consolidada y preparar la revisión fiscal con más contexto.",
    features: ["Todo lo de Gratis", "Más conexiones e importaciones", "Cálculo FIFO", "Resultados fiscales por ejercicio", "Informes y trazabilidad"],
    cta: "Empezar con Esencial",
    href: "/registro?plan=essential",
  },
  {
    name: "Pro",
    price: "7,99 €",
    period: "/ mes",
    annual: "o 79,90 € / año",
    description: "Herramientas avanzadas para revisar, analizar y optimizar tu información cripto.",
    features: ["Todo lo de Esencial", "Análisis fiscal avanzado", "Simulador Tax Loss Harvesting", "Informes avanzados", "Mayor capacidad de trabajo"],
    cta: "Empezar con Pro",
    href: "/registro?plan=pro",
    featured: true,
  },
];

const faqs = [
  ["¿Puedo empezar gratis?", "Sí. Puedes crear una cuenta y empezar a organizar tu información sin contratar un plan de pago."],
  ["¿Puedo cambiar de plan después?", "Sí. La suscripción puede adaptarse a tus necesidades desde tu cuenta."],
  ["¿El precio incluye la presentación de la Renta?", "No. CoinRenta es una herramienta de organización, cálculo y apoyo para revisar información fiscal. No presenta declaraciones ante la Administración ni sustituye a un asesor fiscal."],
  ["¿Hay modalidad anual?", "Sí. Esencial y Pro disponen de una modalidad anual con el precio indicado en esta página."],
];

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-nav">
        <Link className="pricing-brand" href="/" aria-label="CoinRenta, inicio">
          <img src="/logo.png" alt="CoinRenta" />
          <span>Coin<b>Renta</b></span>
        </Link>
        <div className="pricing-nav-actions">
          <Link href="/login">Iniciar sesión</Link>
          <Link className="pricing-nav-cta" href="/registro">Crear cuenta</Link>
        </div>
      </header>

      <section className="pricing-hero">
        <div className="pricing-orb pricing-orb-a" />
        <div className="pricing-orb pricing-orb-b" />
        <div className="pricing-kicker"><i /> PLANES COINRENTA</div>
        <h1>Elige cuánto control<br /><span>necesitas sobre tu cripto.</span></h1>
        <p>Empieza sin coste y pasa a un plan de pago cuando necesites más capacidad, cálculos e informes.</p>
      </section>

      <section className="pricing-grid" aria-label="Planes de precios">
        {plans.map((plan) => (
          <article className={`pricing-card${plan.featured ? " pricing-card-featured" : ""}`} key={plan.name}>
            {plan.featured && <div className="pricing-popular">MÁS COMPLETO</div>}
            <div className="pricing-card-head">
              <span className="pricing-plan-name">{plan.name}</span>
              <p>{plan.description}</p>
            </div>
            <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.period}</span></div>
            {plan.annual && <div className="pricing-annual">{plan.annual}</div>}
            <Link className={`pricing-button${plan.featured ? " pricing-button-primary" : ""}`} href={plan.href}>{plan.cta} <span>→</span></Link>
            <div className="pricing-divider" />
            <p className="pricing-includes">INCLUYE</p>
            <ul>{plan.features.map((feature) => <li key={feature}><b>✓</b>{feature}</li>)}</ul>
          </article>
        ))}
      </section>

      <section className="pricing-trust">
        <div><b>Sin permanencia</b><span>Cambia o cancela cuando quieras.</span></div>
        <div><b>Pago seguro</b><span>Gestionado mediante Paddle.</span></div>
        <div><b>Tus datos son tuyos</b><span>CoinRenta no sustituye tu control sobre la información.</span></div>
      </section>

      <section className="pricing-faq">
        <div className="pricing-kicker"><i /> PREGUNTAS FRECUENTES</div>
        <h2>Antes de empezar.</h2>
        <div className="pricing-faq-list">
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <footer className="pricing-footer">
        <div className="pricing-footer-links">
          <Link href="/">← Volver a CoinRenta</Link>
          <Link href="/legal/terminos">Términos</Link>
          <Link href="/legal/devoluciones">Devoluciones</Link>
          <Link href="/legal/privacidad">Privacidad</Link>
        </div>
        <span>Herramienta de organización y apoyo fiscal. No sustituye el asesoramiento fiscal profesional.</span>
      </footer>
    </main>
  );
}
