import Link from "next/link";

export const dynamic = "force-static";

const featureCards = [
  { number: "01", eyebrow: "CONECTA", title: "Todos tus exchanges. Una sola visión.", text: "Importa tus operaciones mediante API o CSV y conserva el origen de cada movimiento para entender exactamente qué ha pasado." },
  { number: "02", eyebrow: "ORDENA", title: "Del caos de operaciones a datos limpios.", text: "Normaliza compras, ventas, swaps, comisiones y transferencias en un único espacio preparado para revisar tu actividad cripto." },
  { number: "03", eyebrow: "REVISA", title: "Detecta lo que merece atención.", text: "Encuentra posiciones, movimientos y datos incompletos antes de cerrar el ejercicio fiscal." },
];

const platformNames = ["BINANCE", "COINBASE", "KRAKEN", "BITPANDA", "BITSTAMP", "CSV / API"];

const faqItems = [
  { question: "¿Qué es CoinRenta?", answer: "CoinRenta es una plataforma para centralizar operaciones de criptomonedas, organizar la información de distintos exchanges y preparar los datos necesarios para revisar tu situación fiscal en España." },
  { question: "¿Puedo importar datos de varios exchanges?", answer: "Sí. CoinRenta está diseñada para trabajar con múltiples fuentes, incluyendo conexiones y archivos CSV, manteniendo cada origen identificado." },
  { question: "¿CoinRenta guarda mis claves de retirada de fondos?", answer: "La plataforma está orientada a conexiones con permisos mínimos y, cuando el proveedor lo permite, acceso de solo lectura para reducir riesgos." },
  { question: "¿CoinRenta presenta automáticamente mi declaración?", answer: "No. CoinRenta organiza y prepara información para facilitar la revisión fiscal. La responsabilidad de revisar y presentar la declaración corresponde al usuario." },
];

function JsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://coinrenta.es/#organization",
        name: "CoinRenta",
        url: "https://coinrenta.es",
        logo: "https://coinrenta.es/logo.png",
        description: "Plataforma para organizar operaciones de criptomonedas y preparar información fiscal.",
      },
      {
        "@type": "WebSite",
        "@id": "https://coinrenta.es/#website",
        url: "https://coinrenta.es",
        name: "CoinRenta",
        description: "Organiza tus criptomonedas y prepara tu información para la Renta.",
        publisher: { "@id": "https://coinrenta.es/#organization" },
        inLanguage: "es-ES",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://coinrenta.es/#app",
        name: "CoinRenta",
        url: "https://coinrenta.es",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: "Aplicación web para centralizar operaciones de criptomonedas, exchanges y datos de fiscalidad.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        publisher: { "@id": "https://coinrenta.es/#organization" },
      },
      {
        "@type": "FAQPage",
        "@id": "https://coinrenta.es/#faq",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}

export default function Home() {
  return (
    <div className="landing-v2">
      <JsonLd />

      <div className="landing-intro" aria-hidden="true">
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

      <div className="landing-noise" aria-hidden="true" />

      <header className="landing-nav">
        <div className="lv-container lv-nav-inner">
          <Link className="lv-brand" href="/" aria-label="CoinRenta, inicio">
            <img src="/logo.png" alt="CoinRenta" />
            <span>Coin<b>Renta</b></span>
          </Link>
          <nav className="lv-links" aria-label="Navegación principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#ventajas">Ventajas</a>
            <a href="#seguridad">Seguridad</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="lv-actions">
            <Link className="lv-btn lv-btn-ghost" href="/login">Entrar</Link>
            <Link className="lv-btn lv-btn-primary" href="/registro">Empezar gratis <span>→</span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lv-hero" aria-labelledby="hero-title">
          <div className="hero-orbit hero-orbit-a" aria-hidden="true" />
          <div className="hero-orbit hero-orbit-b" aria-hidden="true" />
          <div className="hero-grid-lines" aria-hidden="true" />
          <div className="lv-container lv-hero-grid">
            <div className="hero-copy">
              <div className="lv-kicker"><i /> Fiscalidad cripto, sin perderte en el camino</div>
              <h1 id="hero-title">Tus criptos.<br /><span>Tus datos.</span><br /><em>Tu Renta.</em></h1>
              <p className="lv-hero-copy"><strong>CoinRenta convierte el caos de tus operaciones cripto en información que puedes entender.</strong> Centraliza exchanges, importa movimientos y prepara tu información fiscal desde un único espacio.</p>
              <div className="lv-hero-actions">
                <Link className="lv-btn lv-btn-primary lv-btn-xl" href="/registro">Ordenar mis criptos <span>↗</span></Link>
                <a className="lv-btn lv-btn-ghost lv-btn-xl" href="#como-funciona">Ver cómo funciona <span>↓</span></a>
              </div>
              <div className="lv-proof"><span><b>✓</b> Multi-exchange</span><span><b>✓</b> CSV + API</span><span><b>✓</b> Datos privados</span></div>
              <p className="hero-disclaimer">Herramienta de organización y apoyo fiscal. No sustituye el asesoramiento de un profesional.</p>
            </div>

            <div className="lv-visual" aria-label="Vista conceptual del panel de CoinRenta">
              <div className="visual-halo" />
              <div className="visual-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
              <div className="lv-terminal">
                <div className="lv-terminal-head">
                  <div className="lv-terminal-brand"><img src="/logo.png" alt="" /> <span>COINRENTA / RESUMEN</span></div>
                  <div className="lv-live"><i /> DATOS ACTUALIZADOS</div>
                </div>
                <div className="lv-terminal-body">
                  <div className="dashboard-top-row">
                    <div className="lv-total"><small>Patrimonio consolidado</small><strong>28.416,72 €</strong><span className="lv-up">↑ 12,84% este ejercicio</span></div>
                    <div className="mini-kpi"><small>Movimientos</small><strong>1.284</strong><span>normalizados</span></div>
                  </div>
                  <div className="lv-chart-card">
                    <div className="chart-label"><span>Evolución patrimonial</span><b>2025</b></div>
                    <svg viewBox="0 0 700 200" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="heroArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38d7cb" stopOpacity=".35" /><stop offset="1" stopColor="#38d7cb" stopOpacity="0" /></linearGradient>
                        <filter id="heroGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                      </defs>
                      <path className="chart-grid" d="M0 35H700 M0 85H700 M0 135H700 M0 185H700" />
                      <path className="chart-area" d="M0 158 C48 150 64 134 108 140 S162 158 208 124 S261 136 302 109 S355 127 398 88 S449 103 493 76 S542 94 586 55 S644 61 700 24 V200 H0Z" />
                      <path className="chart-line" filter="url(#heroGlow)" d="M0 158 C48 150 64 134 108 140 S162 158 208 124 S261 136 302 109 S355 127 398 88 S449 103 493 76 S542 94 586 55 S644 61 700 24" />
                      <circle className="chart-point" cx="586" cy="55" r="5" />
                    </svg>
                  </div>
                  <div className="lv-assets">
                    <div className="lv-asset"><span className="asset-mark asset-btc">₿</span><div><b>BTC</b><small>Bitcoin</small></div><strong>12.840,00 €</strong></div>
                    <div className="lv-asset"><span className="asset-mark asset-eth">◆</span><div><b>ETH</b><small>Ethereum</small></div><strong>8.416,20 €</strong></div>
                    <div className="lv-asset"><span className="asset-mark asset-usdc">$</span><div><b>USDC</b><small>USD Coin</small></div><strong>7.160,52 €</strong></div>
                  </div>
                </div>
              </div>
              <div className="floating-pill floating-pill-one"><span>✓</span><div><b>3 exchanges</b><small>conectados</small></div></div>
              <div className="floating-pill floating-pill-two"><span>↗</span><div><b>+2.418,63 €</b><small>resultado revisable</small></div></div>
            </div>
          </div>
          <div className="hero-scroll" aria-hidden="true"><span /> DESCUBRE COINRENTA</div>
        </section>

        <section className="platform-strip" aria-label="Fuentes compatibles"><div className="platform-track">{[...platformNames, ...platformNames].map((exchange, index) => <span key={`${exchange}-${index}`}><i /> <strong>{exchange}</strong></span>)}</div></section>

        <section className="lv-section intro-section" id="como-funciona">
          <div className="lv-container">
            <div className="section-index">01 / CÓMO FUNCIONA</div>
            <div className="lv-section-head wide">
              <div className="lv-kicker">Menos perseguir datos. Más controlar tu cartera.</div>
              <h2>De muchas operaciones<br /><span>a una sola lectura.</span></h2>
              <p>CoinRenta está construida para que puedas reunir movimientos de múltiples fuentes, darles contexto y revisar tu información antes de la declaración.</p>
            </div>
            <div className="lv-grid3 feature-grid">
              {featureCards.map((card, index) => <article className={`lv-card feature-card delay-${index + 1}`} key={card.number}>
                <div className="feature-card-top"><span>{card.number}</span><b>{card.eyebrow}</b></div>
                <div className="feature-icon"><i /><i /><i /></div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <div className="feature-line" />
              </article>)}
            </div>
          </div>
        </section>

        <section className="lv-section visual-section" id="ventajas">
          <div className="section-mesh" aria-hidden="true" />
          <div className="lv-container visual-split">
            <div className="visual-copy">
              <div className="section-index">02 / TU CARTERA</div>
              <div className="lv-kicker">Una cartera. Todas tus plataformas.</div>
              <h2>Que tus datos<br /><span>hablen claro.</span></h2>
              <p>Consulta tus saldos, activos y movimientos desde una visión consolidada. Cada fuente conserva su identidad para que puedas entender de dónde sale cada dato.</p>
              <div className="metric-row"><div><strong>1</strong><span>visión</span></div><i>→</i><div><strong>∞</strong><span>fuentes</span></div><i>→</i><div><strong>✓</strong><span>control</span></div></div>
              <Link className="lv-btn lv-btn-primary" href="/registro">Crear mi espacio <span>↗</span></Link>
            </div>
            <div className="stack-visual" aria-hidden="true">
              <div className="stack-card stack-back"><span>EXCHANGES</span><b>3</b><small>conectados</small></div>
              <div className="stack-card stack-mid"><span>ACTIVOS</span><b>12</b><small>posiciones</small></div>
              <div className="stack-card stack-front">
                <div className="stack-front-head"><span>VALOR TOTAL</span><i>LIVE</i></div>
                <strong>28.416,72 €</strong>
                <div className="stack-bars"><i style={{ height: "44%" }} /><i style={{ height: "68%" }} /><i style={{ height: "52%" }} /><i style={{ height: "82%" }} /><i style={{ height: "61%" }} /><i style={{ height: "93%" }} /></div>
                <div className="stack-foot"><span>BTC · 45,2%</span><span>ETH · 29,6%</span><span>USDC · 25,2%</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="lv-section security-section" id="seguridad">
          <div className="lv-container">
            <div className="section-index">03 / SEGURIDAD Y PRIVACIDAD</div>
            <div className="security-grid">
              <div className="lv-section-head"><div className="lv-kicker">Seguridad primero</div><h2>Tus datos.<br /><span>Tu espacio.</span></h2><p>La aplicación está planteada para separar los datos por usuario y proteger las áreas privadas mediante autenticación y políticas de acceso. Para conexiones de terceros, trabaja con el principio de mínimo privilegio.</p></div>
              <div className="security-list">
                <div className="security-row"><span>01</span><div><strong>Acceso autenticado</strong><small>Tu panel privado no es público.</small></div><em>AUTH</em></div>
                <div className="security-row"><span>02</span><div><strong>Datos aislados</strong><small>Cada usuario trabaja con sus propios datos.</small></div><em>RLS</em></div>
                <div className="security-row"><span>03</span><div><strong>Permisos mínimos</strong><small>Preferencia por conexiones de solo lectura.</small></div><em>READ ONLY</em></div>
                <div className="security-row"><span>04</span><div><strong>Transparencia</strong><small>Política de privacidad, términos y cookies accesibles.</small></div><em>LEGAL</em></div>
              </div>
            </div>
          </div>
        </section>

        <section className="lv-section faq-section" id="preguntas">
          <div className="lv-container">
            <div className="section-index">04 / PREGUNTAS</div>
            <div className="lv-section-head faq-head"><div className="lv-kicker">Preguntas frecuentes</div><h2>Lo importante,<br /><span>sin letra pequeña.</span></h2></div>
            <div className="faq-grid">{faqItems.map((item, index) => <details className="faq-item" key={item.question} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.question}</strong><i>+</i></summary><p>{item.answer}</p></details>)}</div>
          </div>
        </section>

        <section className="lv-section cta-section">
          <div className="cta-aurora" aria-hidden="true" />
          <div className="lv-container"><div className="lv-cta"><div className="cta-logo-orbit" aria-hidden="true"><img src="/logo.png" alt="" /></div><div className="lv-kicker">El desorden sale caro</div><h2>Pon tus criptos<br /><span>en orden.</span></h2><p>Empieza gratis y construye tu espacio de control antes de que llegue el momento de hacer cuentas.</p><div className="lv-hero-actions" style={{ justifyContent: "center" }}><Link className="lv-btn lv-btn-primary lv-btn-xl" href="/registro">Crear mi cuenta gratis <span>↗</span></Link><Link className="lv-btn lv-btn-ghost lv-btn-xl" href="/login">Ya tengo cuenta</Link></div></div></div>
        </section>
      </main>

      <footer className="lv-footer"><div className="lv-container footer-main"><div className="footer-brand"><img src="/logo.png" alt="CoinRenta" /><div><strong>CoinRenta</strong><span>Tu cripto, bajo control.</span></div></div><div className="footer-copy"><span>© {new Date().getFullYear()} CoinRenta</span><span>Plataforma web para organización y apoyo fiscal cripto.</span></div><div className="footer-links"><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/terminos">Términos</Link><Link href="/legal/cookies">Cookies</Link><Link href="/legal/aviso-legal">Aviso legal</Link></div></div></footer>
    </div>
  );
}
