import Link from "next/link";

export const dynamic = "force-static";

const featureCards = [
  {
    number: "01",
    eyebrow: "IMPORTA",
    title: "Reúne tu actividad cripto en un solo lugar.",
    text: "Conecta fuentes compatibles o importa archivos CSV. Mantén el origen de cada movimiento para poder revisar tu información con contexto.",
    icon: "import",
  },
  {
    number: "02",
    eyebrow: "NORMALIZA",
    title: "Convierte operaciones dispersas en información útil.",
    text: "Compras, ventas, intercambios, transferencias y comisiones dejan de estar repartidos entre plataformas y archivos difíciles de revisar.",
    icon: "normalize",
  },
  {
    number: "03",
    eyebrow: "PREPARA",
    title: "Llega a la Renta con los datos bajo control.",
    text: "Consulta resultados y movimientos, identifica información pendiente y prepara una base ordenada para revisar tu situación fiscal en España.",
    icon: "prepare",
  },
];

const platformNames = ["EXCHANGES", "CSV", "API", "WALLETS", "MOVIMIENTOS", "RENTA"];

const faqItems = [
  {
    question: "¿Qué es CoinRenta y para quién está pensado?",
    answer: "CoinRenta es una plataforma web para organizar operaciones y posiciones de criptomonedas, consolidar información procedente de distintas fuentes y facilitar la preparación y revisión de datos fiscales. Está pensada para particulares que quieren tener una visión clara de su actividad cripto antes de revisar sus obligaciones tributarias.",
  },
  {
    question: "¿Puedo reunir operaciones de varios exchanges?",
    answer: "Sí. El objetivo de CoinRenta es centralizar información procedente de diferentes fuentes mediante conexiones disponibles e importaciones CSV, manteniendo identificado el origen de los datos para facilitar su revisión.",
  },
  {
    question: "¿CoinRenta presenta mi declaración de la Renta?",
    answer: "No. CoinRenta organiza, consolida y prepara información para facilitar la revisión fiscal. No sustituye a la Agencia Tributaria ni al asesoramiento de un profesional y el usuario debe revisar la información antes de presentar cualquier declaración.",
  },
  {
    question: "¿Qué ocurre con mis claves y permisos de conexión?",
    answer: "CoinRenta está planteada bajo el principio de mínimo privilegio. Cuando una plataforma permite permisos de solo lectura, esa es la opción preferible para consultar información sin habilitar operaciones de retirada o movimiento de fondos.",
  },
  {
    question: "¿Cómo encaja CoinRenta con MiCA, DAC8 y CARF?",
    answer: "CoinRenta se centra en la organización y preparación de información del usuario. La evolución de MiCA, DAC8 y CARF refuerza la importancia de conservar datos completos y trazables sobre la actividad con criptoactivos; la aplicación concreta de cada obligación depende de la situación de cada contribuyente.",
  },
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
        description: "Plataforma española para organizar operaciones de criptomonedas y preparar información para la Renta.",
      },
      {
        "@type": "WebSite",
        "@id": "https://coinrenta.es/#website",
        url: "https://coinrenta.es",
        name: "CoinRenta",
        description: "Controla tus operaciones de criptomonedas y prepara tus datos para la Renta desde un único espacio.",
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
        description: "Aplicación web para consolidar operaciones de criptomonedas, controlar una cartera y preparar información fiscal.",
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

      {/* Intro animation intentionally preserved. */}
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
            <a href="#fiscalidad">Fiscalidad</a>
            <a href="#seguridad">Seguridad</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="lv-actions">
            <Link className="lv-btn lv-btn-ghost" href="/login">Ya tengo una cuenta</Link>
            <Link className="lv-btn" href="/precios" style={{ background: "linear-gradient(135deg, rgba(104,238,229,.16), rgba(15,167,160,.08))", borderColor: "rgba(104,238,229,.38)", color: "#bffaf5", boxShadow: "0 0 24px rgba(104,238,229,.12)" }}>✦ Ver precios <span>↗</span></Link>
            <Link className="lv-btn lv-btn-primary" href="/registro">Comenzar <span>→</span></Link>
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
              <div className="lv-kicker"><i /> Control y fiscalidad de criptomonedas</div>
              <h1 id="hero-title">Tus operaciones cripto.<br /><span>Ordenadas.</span><br /><em>Preparadas para la Renta.</em></h1>
              <p className="lv-hero-copy"><strong>CoinRenta pone orden donde normalmente hay exchanges, wallets, CSV y cientos de movimientos.</strong> Centraliza tu actividad, entiende tus datos y prepara la información que necesitas para revisar tu fiscalidad en España.</p>
              <div className="lv-hero-actions">
                <Link className="lv-btn lv-btn-primary lv-btn-xl" href="/registro">Comenzar <span>↗</span></Link>
                <a className="lv-btn lv-btn-ghost lv-btn-xl" href="#como-funciona">Descubrir cómo funciona <span>↓</span></a>
              </div>
              <div className="lv-proof"><span><b>✓</b> Multi-fuente</span><span><b>✓</b> CSV + conexiones</span><span><b>✓</b> Espacio privado</span></div>
              <p className="hero-disclaimer">Herramienta de organización y apoyo fiscal. No sustituye el asesoramiento fiscal ni la presentación de declaraciones ante la Administración.</p>
            </div>

            <div className="lv-visual" aria-label="Vista conceptual del panel de CoinRenta">
              <div className="visual-halo" />
              <div className="visual-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
              <div className="lv-terminal">
                <div className="lv-terminal-head">
                  <div className="lv-terminal-brand"><img src="/logo.png" alt="" /> <span>COINRENTA / CONTROL</span></div>
                  <div className="lv-live"><i /> INFORMACIÓN CONSOLIDADA</div>
                </div>
                <div className="lv-terminal-body">
                  <div className="dashboard-top-row">
                    <div className="lv-total"><small>Patrimonio consolidado</small><strong>28.416,72 €</strong><span className="lv-up">↑ visión unificada</span></div>
                    <div className="mini-kpi"><small>Movimientos</small><strong>1.284</strong><span>identificados</span></div>
                  </div>
                  <div className="lv-chart-card">
                    <div className="chart-label"><span>Evolución de la cartera</span><b>HISTÓRICO</b></div>
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
              <div className="floating-pill floating-pill-one"><span>✓</span><div><b>Fuentes conectadas</b><small>en un solo espacio</small></div></div>
              <div className="floating-pill floating-pill-two"><span>↗</span><div><b>Datos trazables</b><small>listos para revisar</small></div></div>
            </div>
          </div>
          <div className="hero-scroll" aria-hidden="true"><span /> DESCUBRE COINRENTA</div>
        </section>

        <section className="platform-strip" aria-label="Tipos de información que puedes centralizar"><div className="platform-track">{[...platformNames, ...platformNames].map((item, index) => <span key={`${item}-${index}`}><i /> <strong>{item}</strong></span>)}</div></section>

        <section className="lv-section intro-section" id="como-funciona">
          <div className="lv-container">
            <div className="section-index">01 / CÓMO FUNCIONA</div>
            <div className="lv-section-head wide">
              <div className="lv-kicker">Una forma más seria de gestionar tu actividad cripto.</div>
              <h2>Del movimiento aislado<br /><span>a una visión completa.</span></h2>
              <p>No necesitas recordar qué ocurrió en cada plataforma. CoinRenta está diseñada para reunir la información, darle estructura y ayudarte a detectar qué debes revisar antes de hacer tus cuentas.</p>
            </div>
            <div className="lv-grid3 feature-grid">
              {featureCards.map((card, index) => <article className={`lv-card feature-card delay-${index + 1}`} key={card.number}>
                <div className="feature-card-top"><span>{card.number}</span><b>{card.eyebrow}</b></div>
                <div className={"feature-icon feature-icon-" + card.icon} aria-hidden="true">
                  {card.icon === "import" && (
                    <svg viewBox="0 0 48 48" role="presentation">
                      <path d="M24 6v24" />
                      <path d="m14 20 10 10 10-10" />
                      <path d="M10 36h28" />
                      <path d="M10 40h28" />
                    </svg>
                  )}
                  {card.icon === "normalize" && (
                    <svg viewBox="0 0 48 48" role="presentation">
                      <path d="M6 10h17" />
                      <path d="M6 18h13" />
                      <path d="M6 26h19" />
                      <path d="M26 18h4" />
                      <path d="m28 13 5 5-5 5" />
                      <path d="M35 14h7" />
                      <path d="M35 26h10" />
                    </svg>
                  )}
                  {card.icon === "prepare" && (
                    <svg viewBox="0 0 48 48" role="presentation">
                      <rect x="10" y="7" width="28" height="34" rx="5" />
                      <path d="m16 17 3 3 6-6" />
                      <path d="M27 17h6" />
                      <path d="m16 27 3 3 6-6" />
                      <path d="M27 27h6" />
                      <path d="M16 35h17" />
                    </svg>
                  )}
                </div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <div className="feature-line" />
              </article>)}
            </div>
          </div>
        </section>

        <section className="lv-section visual-section" id="fiscalidad">
          <div className="section-mesh" aria-hidden="true" />
          <div className="lv-container visual-split">
            <div className="visual-copy">
              <div className="section-index">02 / FISCALIDAD CRIPTO</div>
              <div className="lv-kicker">Pensado para el contexto fiscal español</div>
              <h2>Más control sobre<br /><span>lo que tienes que revisar.</span></h2>
              <p>La fiscalidad de los criptoactivos no empieza cuando abres la declaración: empieza mucho antes, cuando necesitas reconstruir qué compraste, qué vendiste, qué intercambiaste, qué transferiste y qué información falta.</p>
              <div className="metric-row"><div><strong>01</strong><span>Importa</span></div><i>→</i><div><strong>02</strong><span>Ordena</span></div><i>→</i><div><strong>03</strong><span>Revisa</span></div></div>
              <Link className="lv-btn lv-btn-primary" href="/registro">Crear mi espacio <span>↗</span></Link>
            </div>
            <div className="stack-visual" aria-hidden="true">
              <div className="stack-card stack-back"><span>FUENTES</span><b>03</b><small>centralizadas</small></div>
              <div className="stack-card stack-mid"><span>MOVIMIENTOS</span><b>1.284</b><small>identificados</small></div>
              <div className="stack-card stack-front">
                <div className="stack-front-head"><span>CONTROL DE CARTERA</span><i>LIVE</i></div>
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
              <div className="lv-section-head"><div className="lv-kicker">Diseñado para tratar tus datos con cuidado</div><h2>Control, privacidad<br /><span>y permisos mínimos.</span></h2><p>Tu actividad financiera merece algo más que una interfaz bonita. CoinRenta está construida para mantener las áreas privadas protegidas, separar los datos por usuario y reducir los permisos de las conexiones externas siempre que la fuente lo permita.</p></div>
              <div className="security-list">
                <div className="security-row"><span>01</span><div><strong>Acceso autenticado</strong><small>Tu espacio de trabajo es privado y requiere autenticación.</small></div><em>AUTH</em></div>
                <div className="security-row"><span>02</span><div><strong>Datos aislados</strong><small>La información de cada usuario permanece separada.</small></div><em>RLS</em></div>
                <div className="security-row"><span>03</span><div><strong>Permisos mínimos</strong><small>Cuando existe la opción, priorizamos conexiones de solo lectura.</small></div><em>READ ONLY</em></div>
                <div className="security-row"><span>04</span><div><strong>Transparencia</strong><small>Privacidad, términos, cookies y aviso legal accesibles desde la plataforma.</small></div><em>LEGAL</em></div>
              </div>
            </div>
          </div>
        </section>

        <section className="lv-section faq-section" id="preguntas">
          <div className="lv-container">
            <div className="section-index">04 / PREGUNTAS</div>
            <div className="lv-section-head faq-head"><div className="lv-kicker">Antes de empezar</div><h2>Las respuestas que<br /><span>realmente importan.</span></h2></div>
            <div className="faq-grid">{faqItems.map((item, index) => <details className="faq-item" key={item.question} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.question}</strong><i>+</i></summary><p>{item.answer}</p></details>)}</div>
          </div>
        </section>

        <section className="lv-section cta-section">
          <div className="cta-aurora" aria-hidden="true" />
          <div className="lv-container"><div className="lv-cta"><div className="cta-logo-orbit" aria-hidden="true"><img src="/logo.png" alt="" /></div><div className="lv-kicker">Empieza con una cartera bajo control</div><h2>Deja de buscar datos.<br /><span>Empieza a entenderlos.</span></h2><p>Centraliza tu actividad cripto, ordena tus movimientos y llega a la revisión fiscal con una base de información mucho más clara.</p><div className="lv-hero-actions" style={{ justifyContent: "center" }}><Link className="lv-btn lv-btn-primary lv-btn-xl" href="/registro">Comenzar <span>↗</span></Link><Link className="lv-btn lv-btn-ghost lv-btn-xl" href="/login">Ya tengo una cuenta</Link></div></div></div>
        </section>
      </main>

      <div className="mobile-cta-bar" aria-label="Acceso rápido a CoinRenta">
        <div><strong>CoinRenta</strong><span>Ordena tu actividad cripto</span></div>
        <Link className="lv-btn lv-btn-primary" href="/registro">Comenzar <span>↗</span></Link>
      </div>

      <footer className="lv-footer"><div className="lv-container footer-main"><div className="footer-brand"><img src="/logo.png" alt="CoinRenta" /><div><strong>CoinRenta</strong><span>Control y fiscalidad de criptomonedas.</span></div></div><div className="footer-copy"><span>© {new Date().getFullYear()} CoinRenta</span><span>Plataforma web para organización y apoyo fiscal cripto.</span></div><div className="footer-links"><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/terminos">Términos</Link><Link href="/legal/cookies">Cookies</Link><Link href="/legal/aviso-legal">Aviso legal</Link></div></div></footer>
    </div>
  );
}
