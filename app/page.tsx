import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const exchanges = ["BINANCE", "COINBASE", "KRAKEN", "BITPANDA", "BITSTAMP", "CSV / API"];
const movements = [
  ["BUY", "BTC / EUR", "+1.284,40 €"],
  ["SWAP", "ETH → USDC", "+684,20 €"],
  ["SELL", "SOL / EUR", "+412,80 €"],
  ["FEE", "BNB", "−8,40 €"],
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/dashboard");

  return (
    <div className="landing-v2">
      <link rel="stylesheet" href="/landing.css" />
      <header className="landing-nav">
        <Link className="lv-brand" href="/" aria-label="CoinRenta, inicio"><img src="/logo.png" alt="" /><span>Coin<b>Renta</b></span></Link>
        <nav className="lv-links" aria-label="Navegación principal"><a href="#como-funciona">Cómo funciona</a><a href="#ventajas">Ventajas</a><a href="#seguridad">Seguridad</a></nav>
        <div className="lv-actions"><Link className="lv-btn lv-btn-ghost" href="/login">Entrar</Link><Link className="lv-btn lv-btn-primary" href="/registro">Empezar gratis →</Link></div>
      </header>

      <main>
        <section className="lv-hero">
          <div className="lv-container lv-hero-grid">
            <div>
              <div className="lv-kicker"><i /> Fiscalidad cripto sin anestesia</div>
              <h1>LA RENTA<br /><em>NO PERDONA.</em></h1>
              <p className="lv-hero-copy"><strong>Tus criptos tampoco deberían hacerlo.</strong> Centraliza exchanges, importa movimientos y pon orden a toda tu actividad cripto desde un único sitio.</p>
              <div className="lv-hero-actions"><Link className="lv-btn lv-btn-primary" href="/registro">Ordenar mis criptos →</Link><Link className="lv-btn lv-btn-ghost" href="#como-funciona">Ver cómo funciona</Link></div>
              <div className="lv-proof"><span><b>✓</b> Multi-exchange</span><span><b>✓</b> CSV + API</span><span><b>✓</b> Espacio privado</span></div>
            </div>
            <div className="lv-visual">
              <div className="lv-visual-glow" />
              <div className="lv-terminal">
                <div className="lv-terminal-head"><div className="lv-dots"><i /><i /><i /></div><div className="lv-live">● DATOS ACTUALIZADOS</div></div>
                <div className="lv-terminal-body">
                  <div className="lv-total"><small>Patrimonio consolidado</small><strong>28.416,72 €</strong><span className="lv-up">↑ 12,84% este ejercicio</span></div>
                  <div className="lv-chart"><svg viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0fa7a0" stopOpacity=".32"/><stop offset="1" stopColor="#0fa7a0" stopOpacity="0"/></linearGradient></defs><path d="M0 150 C45 143 55 118 90 126 S140 137 175 101 S225 113 260 92 S310 109 345 70 S400 88 435 58 S490 75 520 42 S565 50 600 18 V180 H0Z" fill="url(#area)"/><path d="M0 150 C45 143 55 118 90 126 S140 137 175 101 S225 113 260 92 S310 109 345 70 S400 88 435 58 S490 75 520 42 S565 50 600 18" fill="none" stroke="#51dcd3" strokeWidth="3"/></svg></div>
                  <div className="lv-assets"><div className="lv-asset"><b>BTC</b><span>12.840,00 €</span></div><div className="lv-asset"><b>ETH</b><span>8.416,20 €</span></div><div className="lv-asset"><b>USDC</b><span>7.160,52 €</span></div></div>
                </div>
              </div>
              <div className="lv-float"><b>+2.418,63 €</b> · resultado revisable</div>
            </div>
          </div>
          <div className="lv-ticker"><div className="lv-ticker-track">{[...exchanges, ...exchanges].map((exchange, i) => <span key={`${exchange}-${i}`}>● <strong>{exchange}</strong></span>)}</div></div>
        </section>

        <section className="lv-section" id="como-funciona"><div className="lv-container"><div className="lv-section-head center"><div className="lv-kicker">Sin humo. Sin caos.</div><h2>De 14 CSV y 5 exchanges a una sola pantalla.</h2><p>CoinRenta está pensada para que dejes de perseguir operaciones por todas partes y empieces a ver tu cartera como lo que es: un sistema.</p></div><div className="lv-grid3"><article className="lv-card"><div className="lv-num">01 / CONECTA</div><h3>Trae tus datos.</h3><p>Conecta tus exchanges mediante API o importa sus CSV. Mantén cada fuente identificada.</p></article><article className="lv-card"><div className="lv-num">02 / ORDENA</div><h3>Unifica el caos.</h3><p>Movimientos, cuentas, activos y ejercicios quedan preparados en un único espacio.</p></article><article className="lv-card"><div className="lv-num">03 / REVISA</div><h3>Ve al grano.</h3><p>Detecta huecos, duplicados y operaciones que necesitan atención antes de cerrar el ejercicio.</p></article></div></div></section>

        <section className="lv-section lv-section-dark" id="ventajas"><div className="lv-container lv-split"><div><div className="lv-big-stat">1<span>→</span>∞</div><div className="lv-section-head"><div className="lv-kicker">Multi-exchange</div><h2>Una cartera.<br />Todas tus plataformas.</h2><p>Binance, Coinbase, Kraken, Bitpanda, Bitstamp y tus propios CSV. Cada movimiento conserva su origen para que puedas reconstruir qué pasó.</p></div><Link className="lv-btn lv-btn-primary" href="/registro">Quiero tenerlo todo controlado →</Link></div><div className="lv-list">{movements.map(([type, name, value]) => <div className="lv-list-row" key={`${type}-${name}`}><div className="lv-list-icon">{type[0]}</div><div><strong>{name}</strong><small>{type} · ejercicio 2025</small></div><em>{value}</em></div>)}<div className="lv-list-row"><div className="lv-list-icon">✓</div><div><strong>4 fuentes sincronizadas</strong><small>Última actualización: ahora</small></div><em>OK</em></div></div></div></section>

        <section className="lv-section" id="seguridad"><div className="lv-container lv-split"><div className="lv-section-head"><div className="lv-kicker">Seguridad primero</div><h2>Tus datos.<br />Tu espacio.</h2><p>La aplicación separa los datos por usuario y protege las áreas privadas mediante autenticación y políticas de acceso. Para las conexiones API, la idea es trabajar con permisos de solo lectura.</p></div><div className="lv-list"><div className="lv-list-row"><div className="lv-list-icon">01</div><div><strong>Acceso autenticado</strong><small>Tu dashboard no es público.</small></div><em>PROTEGIDO</em></div><div className="lv-list-row"><div className="lv-list-icon">02</div><div><strong>Datos aislados</strong><small>Cada cuenta ve sus propios datos.</small></div><em>RLS</em></div><div className="lv-list-row"><div className="lv-list-icon">03</div><div><strong>API de solo lectura</strong><small>Sin permisos de retirada de fondos.</small></div><em>READ ONLY</em></div></div></div></section>

        <section className="lv-section"><div className="lv-container"><div className="lv-cta"><div className="lv-kicker">El desorden sale caro</div><h2>Pon tus criptos<br /><span style={{ color: "#61e5dc" }}>en orden.</span></h2><p>Empieza gratis y construye tu espacio fiscal antes de que llegue el momento de hacer cuentas.</p><div className="lv-hero-actions" style={{ justifyContent: "center" }}><Link className="lv-btn lv-btn-primary" href="/registro">Crear mi cuenta gratis →</Link><Link className="lv-btn lv-btn-ghost" href="/login">Ya tengo cuenta</Link></div></div></div></section>
      </main>
      <footer className="lv-footer"><div className="lv-container lv-footer-row"><span>© {new Date().getFullYear()} CoinRenta · Tu cripto, bajo control.</span><span><Link href="/legal/privacidad">Privacidad</Link> · <Link href="/legal/terminos">Términos</Link> · <Link href="/legal/cookies">Cookies</Link></span></div></footer>
    </div>
  );
}
