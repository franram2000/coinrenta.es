import Link from "next/link";

const guides = [
  ["Binance", "Crea una API Key con permisos de lectura y desactiva trading/retiros.", "https://www.binance.com/"],
  ["Coinbase", "En Coinbase Advanced, crea una API key de solo lectura y copia las credenciales en CoinRenta.", "https://www.coinbase.com/"],
  ["Kraken", "Genera una API Key sin permisos de retirada ni operaciones y úsala para sincronizar el histórico.", "https://www.kraken.com/"],
  ["Bitstamp", "Crea una API key limitada a lectura de cuenta y operaciones, sin permisos de retirada.", "https://www.bitstamp.net/"],
  ["Bitpanda", "Consulta la sección de API de tu cuenta y utiliza únicamente permisos de lectura para CoinRenta.", "https://www.bitpanda.com/"],
];

export default function HelpPage() {
  return <>
    <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Ayuda</h1><p>Guías para conectar tus exchanges, importar datos y resolver las dudas más habituales.</p></div></header>
    <section className="dashboard-content help-page">
      <div className="help-hero"><span className="section-kicker">Centro de ayuda</span><h2>¿En qué podemos ayudarte?</h2><p>Todo lo que necesitas para configurar CoinRenta y trabajar con tus datos fiscales.</p></div>
      <section className="help-section"><div className="panel-head"><div><span className="section-kicker">Conexiones</span><h3>Conecta tus exchanges</h3><p>Siempre que sea posible utiliza claves de solo lectura. CoinRenta nunca necesita permisos para retirar fondos.</p></div></div><div className="help-guide-grid">{guides.map(([name,text,url])=><article className="help-guide panel-card" key={name}><div className="help-guide-icon">↻</div><h3>{name}</h3><p>{text}</p><a href={url} target="_blank" rel="noreferrer">Abrir {name} ↗</a><ol><li>Accede a seguridad/API.</li><li>Crea una clave nueva.</li><li>Activa solo permisos de lectura.</li><li>Añade la conexión en CoinRenta.</li></ol></article>)}</div></section>
      <section className="help-section"><div className="panel-head"><div><span className="section-kicker">Preguntas frecuentes</span><h3>Dudas frecuentes</h3></div></div><div className="faq-list"><details><summary>¿CoinRenta puede retirar mis fondos?</summary><p>No. Las conexiones deben utilizar permisos de lectura. No necesitas habilitar retiros ni trading.</p></details><details><summary>¿Qué pasa si tengo varias cuentas en un mismo exchange?</summary><p>Puedes crear varias conexiones y cuentas para mantenerlas separadas y ver el patrimonio consolidado.</p></details><details><summary>¿Puedo usar CSV si no quiero conectar una API?</summary><p>Sí. Puedes importar los históricos que te proporcione cada plataforma.</p></details><details><summary>¿El cálculo fiscal sustituye a un asesor?</summary><p>No. CoinRenta organiza y calcula información; la revisión final de tus obligaciones fiscales corresponde al usuario y, cuando proceda, a su asesor.</p></details></div></section>
      <section className="help-section help-contact panel-card"><div><span className="section-kicker">¿No encuentras la respuesta?</span><h3>Habla con nosotros</h3><p>Escríbenos y te ayudaremos con tu cuenta o con la conexión de un exchange.</p></div><a className="btn btn-primary" href="mailto:info@coinrenta.es">Contactar con info@coinrenta.es</a></section>
      <section className="help-section legal-links"><div className="panel-head"><div><span className="section-kicker">Documentación</span><h3>Información legal</h3></div></div><div><Link href="/legal/aviso-legal">Aviso legal</Link><Link href="/legal/privacidad">Política de privacidad</Link><Link href="/legal/cookies">Política de cookies</Link><Link href="/legal/terminos">Términos de servicio</Link><Link href="/legal/devoluciones" className="help-legal-featured">Desistimiento y devoluciones ↗</Link></div></section>
    </section>
  </>;
}
