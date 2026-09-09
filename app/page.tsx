const faqs = [
  {
    question: "¿Qué es CoinRenta?",
    answer:
      "CoinRenta es una herramienta para centralizar operaciones con criptomonedas y preparar la información que necesitas para revisar su tratamiento fiscal en España.",
  },
  {
    question: "¿Tengo que conectar mis exchanges?",
    answer:
      "No. Puedes conectar un exchange mediante API o importar manualmente los CSV de tus movimientos. La idea es que elijas la forma más cómoda de aportar tus datos.",
  },
  {
    question: "¿CoinRenta guarda mis claves API?",
    answer:
      "Las credenciales se plantean con una arquitectura separada y orientada a la seguridad. Nunca necesitas dar permisos de retirada de fondos para el funcionamiento normal de una conexión de datos.",
  },
  {
    question: "¿Puedo usar varios exchanges?",
    answer:
      "Sí. Puedes centralizar operaciones procedentes de distintos exchanges y fuentes para trabajar con una única visión de tus movimientos y del ejercicio fiscal.",
  },
  {
    question: "¿Sirve para operaciones cripto a cripto?",
    answer:
      "La estructura de CoinRenta está pensada para conservar cada pata de una operación, de forma que los intercambios, comisiones, depósitos y retiradas puedan normalizarse correctamente.",
  },
  {
    question: "¿CoinRenta sustituye a un asesor fiscal?",
    answer:
      "No. CoinRenta es una herramienta de organización y cálculo. La revisión final de tu situación fiscal corresponde a ti y, cuando proceda, a un profesional tributario.",
  },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="CoinRenta">
      <span className="brand-mark" aria-hidden="true">₿</span>
      {!compact && <span className="brand-name">Coin<span>Renta</span></span>}
    </span>
  );
}

function CheckIcon() {
  return <span className="check" aria-hidden="true">✓</span>;
}

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "CoinRenta",
        "url": "https://coinrenta.es",
        "inLanguage": "es-ES",
        "description": "Herramienta para organizar y calcular la información fiscal de operaciones con criptomonedas.",
      },
      {
        "@type": "SoftwareApplication",
        "name": "CoinRenta",
        "applicationCategory": "FinanceApplication",
        "operatingSystem": "Web",
        "url": "https://coinrenta.es",
        "description": "Aplicación web para centralizar movimientos de criptomonedas y preparar información para la declaración de la Renta.",
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a className="skip-link" href="#contenido">Saltar al contenido</a>

      <header className="site-header">
        <nav className="container nav" aria-label="Navegación principal">
          <a href="#inicio" aria-label="CoinRenta, inicio"><Logo /></a>
          <div className="nav-links">
            <a href="#funciones">Funciones</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#seguridad">Seguridad</a>
            <a href="#faq">Preguntas frecuentes</a>
          </div>
          <div className="nav-actions">
            <a className="btn btn-secondary" href="#acceso">Iniciar sesión</a>
            <a className="btn btn-primary" href="#empezar">Empezar gratis</a>
          </div>
          <details className="mobile-nav">
            <summary aria-label="Abrir menú">☰</summary>
            <div className="mobile-menu">
              <a href="#funciones">Funciones</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#seguridad">Seguridad</a>
              <a href="#faq">Preguntas frecuentes</a>
              <a href="#empezar">Empezar gratis</a>
            </div>
          </details>
        </nav>
      </header>

      <main id="contenido">
        <section className="hero" id="inicio" aria-labelledby="hero-title">
          <div className="container hero-grid">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> Fiscalidad cripto, sin caos</div>
              <h1 id="hero-title">Tu cripto.<br /><em>Lista para la Renta.</em></h1>
              <p className="hero-copy">
                Centraliza tus movimientos de criptomonedas, conecta tus exchanges o importa sus CSV y convierte todos tus datos en una visión fiscal clara, ordenada y fácil de revisar.
              </p>
              <div className="hero-actions" id="empezar">
                <a className="btn btn-primary btn-large" href="#acceso">Empezar gratis →</a>
                <a className="btn btn-secondary btn-large" href="#como-funciona">Ver cómo funciona</a>
              </div>
              <div className="hero-trust" aria-label="Ventajas principales">
                <span><i /> Sin custodia de fondos</span>
                <span><i /> Importación CSV</span>
                <span><i /> Múltiples exchanges</span>
              </div>
            </div>

            <div className="dashboard-wrap" aria-label="Vista previa del panel de CoinRenta">
              <div className="dashboard">
                <div className="dashboard-top">
                  <div className="dash-brand"><span className="dash-brand-mark">₿</span> CoinRenta</div>
                  <div className="dash-pill">Ejercicio 2025</div>
                </div>
                <div className="dashboard-body">
                  <div className="dash-grid">
                    <div className="dash-card">
                      <div className="dash-label">Resultado fiscal estimado</div>
                      <div className="dash-value">+2.418,63 €</div>
                      <div className="dash-meta">↑ +18,4% frente al coste</div>
                      <div className="chart" aria-hidden="true">
                        <span className="bar" /><span className="bar" /><span className="bar" /><span className="bar" /><span className="bar" />
                        <span className="bar" /><span className="bar" /><span className="bar" /><span className="bar" /><span className="bar" />
                      </div>
                    </div>
                    <div className="dash-card">
                      <div className="dash-label">Activos</div>
                      <div className="asset-list">
                        <div className="asset"><div className="asset-main"><span className="asset-icon">BTC</span><div><div className="asset-name">Bitcoin</div><div className="asset-symbol">0,1842 BTC</div></div></div><div><div className="asset-value">12.840 €</div><div className="asset-change">+8,2%</div></div></div>
                        <div className="asset"><div className="asset-main"><span className="asset-icon">ETH</span><div><div className="asset-name">Ethereum</div><div className="asset-symbol">1,84 ETH</div></div></div><div><div className="asset-value">4.390 €</div><div className="asset-change">+4,7%</div></div></div>
                        <div className="asset"><div className="asset-main"><span className="asset-icon">USD</span><div><div className="asset-name">USDC</div><div className="asset-symbol">2.540 USDC</div></div></div><div><div className="asset-value">2.171 €</div><div className="asset-change">+0,3%</div></div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="funciones" aria-labelledby="functions-title">
          <div className="container">
            <div className="section-head center">
              <div className="section-kicker">Todo en un solo sitio</div>
              <h2 id="functions-title">Menos hojas de cálculo.<br />Más control.</h2>
              <p className="section-lead">CoinRenta convierte miles de movimientos en información entendible para que puedas centrarte en revisar, no en cuadrar datos.</p>
            </div>
            <div className="feature-grid">
              <article className="feature-card"><div className="feature-icon">↗</div><h3>Conecta tus exchanges</h3><p>Centraliza datos de varias plataformas y mantén cada cuenta separada para poder auditar el origen de tus movimientos.</p></article>
              <article className="feature-card"><div className="feature-icon">CSV</div><h3>Importa tus CSV</h3><p>Sube los archivos exportados por tu exchange cuando no quieras conectar una API o cuando necesites trabajar con históricos.</p></article>
              <article className="feature-card"><div className="feature-icon">€</div><h3>Convierte a EUR</h3><p>Normaliza operaciones y valoraciones para trabajar con una referencia común y consultar tus resultados de forma clara.</p></article>
              <article className="feature-card"><div className="feature-icon">⌁</div><h3>Reconcilia movimientos</h3><p>Relaciona compras, ventas, transferencias y comisiones para reducir duplicados y detectar movimientos que necesitan revisión.</p></article>
              <article className="feature-card"><div className="feature-icon">▣</div><h3>Trabaja por ejercicio</h3><p>Separa los datos por año fiscal y conserva el contexto necesario para volver atrás y revisar una operación concreta.</p></article>
              <article className="feature-card"><div className="feature-icon">✓</div><h3>Revisa antes de presentar</h3><p>Consulta incidencias, datos pendientes y resultados antes de utilizar la información en tu declaración.</p></article>
            </div>
          </div>
        </section>

        <section className="section process" id="como-funciona" aria-labelledby="process-title">
          <div className="container">
            <div className="section-head center"><div className="section-kicker">Cómo funciona</div><h2 id="process-title">De los movimientos a los datos claros.</h2><p className="section-lead">Un flujo sencillo para pasar del caos de tus exchanges a una base de datos fiscal ordenada.</p></div>
            <div className="step-grid">
              <article className="step"><span className="step-number">01</span><h3>Conecta o importa</h3><p>Conecta una fuente de datos mediante API o importa sus CSV. Puedes trabajar con varias plataformas a la vez.</p></article>
              <article className="step"><span className="step-number">02</span><h3>CoinRenta normaliza</h3><p>Los movimientos se convierten a un formato común para poder relacionarlos, detectar incidencias y mantener trazabilidad.</p></article>
              <article className="step"><span className="step-number">03</span><h3>Revisa tu ejercicio</h3><p>Consulta tu situación, revisa operaciones pendientes y prepara una visión consolidada antes de presentar tu información fiscal.</p></article>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="sources-title">
          <div className="container">
            <div className="source-grid">
              <article className="source-card">
                <div className="section-kicker">Fuentes</div><h3 id="sources-title">Unifica tus plataformas</h3>
                <p>La aplicación está pensada para crecer con conectores y formatos distintos sin romper el modelo de datos.</p>
                <div className="source-list"><span className="source-tag">Binance</span><span className="source-tag">Coinbase</span><span className="source-tag">Kraken</span><span className="source-tag">Bitstamp</span><span className="source-tag">Bitpanda</span><span className="source-tag">CSV / Excel</span></div>
              </article>
              <article className="source-card">
                <div className="section-kicker">Diseñado para crecer</div><h3>Una base que no se queda pequeña</h3>
                <p>Operaciones, patas de transacción, balances, precios, lotes y resultados fiscales se mantienen separados para que el sistema pueda evolucionar sin perder trazabilidad.</p>
                <div className="source-list"><span className="source-tag">Multi-exchange</span><span className="source-tag">Histórico</span><span className="source-tag">Trazabilidad</span><span className="source-tag">EUR</span></div>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="seguridad" aria-labelledby="security-title">
          <div className="container security">
            <div>
              <div className="section-kicker">Seguridad primero</div>
              <h2 id="security-title">Tu información financiera merece una arquitectura seria.</h2>
              <p className="section-lead">CoinRenta se ha planteado desde el principio para separar autenticación, datos de usuario y credenciales de conexión.</p>
            </div>
            <div className="security-panel">
              <div className="security-check"><CheckIcon /><div><strong>Sin custodia de criptomonedas</strong><span>La aplicación trabaja con datos y movimientos, no con retiradas de fondos.</span></div></div>
              <div className="security-check"><CheckIcon /><div><strong>Credenciales aisladas</strong><span>Las credenciales de API no forman parte de las tablas públicas de la aplicación.</span></div></div>
              <div className="security-check"><CheckIcon /><div><strong>Acceso por usuario</strong><span>Los datos están preparados para que cada cuenta solo pueda consultar sus propios registros.</span></div></div>
              <div className="security-check"><CheckIcon /><div><strong>Diseño preparado para auditoría</strong><span>Cada movimiento conserva su origen para facilitar la revisión y detectar inconsistencias.</span></div></div>
            </div>
          </div>
        </section>

        <section className="section" id="faq" aria-labelledby="faq-title">
          <div className="container">
            <div className="section-head center"><div className="section-kicker">Preguntas frecuentes</div><h2 id="faq-title">Lo importante, sin letra pequeña.</h2></div>
            <div className="faq-grid">
              {faqs.map((faq) => <details className="faq-item" key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="section" id="acceso" aria-labelledby="cta-title">
          <div className="container">
            <div className="cta">
              <h2 id="cta-title">Pon orden a tu cripto.</h2>
              <p>Centraliza tus movimientos y empieza a preparar tus datos para la Renta desde un único sitio.</p>
              <div className="hero-actions"><a className="btn btn-primary btn-large" href="mailto:hola@coinrenta.es">Quiero empezar →</a></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-row">
          <div><Logo compact={false} /> <span> · © {new Date().getFullYear()} CoinRenta</span></div>
          <div className="footer-links"><a href="#inicio">Inicio</a><a href="#funciones">Funciones</a><a href="#seguridad">Seguridad</a><a href="#faq">FAQ</a></div>
        </div>
      </footer>
    </>
  );
}
