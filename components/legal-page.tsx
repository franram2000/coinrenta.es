import Link from "next/link";

type LegalSection = {
  title: string;
  children: React.ReactNode;
};

type LegalPageProps = {
  label: string;
  title: string;
  updated: string;
  intro: string;
  activePath: string;
  sections: LegalSection[];
};

const links = [
  ["Aviso legal", "/legal/aviso-legal"],
  ["Privacidad", "/legal/privacidad"],
  ["Cookies", "/legal/cookies"],
  ["Términos", "/legal/terminos"],
  ["Devoluciones", "/legal/devoluciones"],
] as const;

export default function LegalPage({ label, title, updated, intro, activePath, sections }: LegalPageProps) {
  return (
    <main className="legal-shell">
      <div className="legal-orb legal-orb-one" aria-hidden="true" />
      <div className="legal-orb legal-orb-two" aria-hidden="true" />

      <header className="legal-topbar">
        <Link href="/" className="legal-brand" aria-label="Volver a CoinRenta">
          <img
            src="/logo.png"
            alt="CoinRenta"
            className="legal-brand-logo"
            width={34}
            height={34}
            style={{ width: "34px", height: "34px", objectFit: "contain", flex: "0 0 34px" }}
          />
          <span>Coin<span>Renta</span></span>
        </Link>
        <Link href="/" className="legal-back">Volver a la web <span>↗</span></Link>
      </header>

      <div className="legal-container">
        <nav className="legal-nav" aria-label="Documentos legales">
          {links.map(([name, href]) => (
            <Link key={href} href={href} className={href === activePath ? "active" : ""}>
              {name}
            </Link>
          ))}
        </nav>

        <article className="legal-card">
          <div className="legal-hero">
            <span className="legal-kicker">{label}</span>
            <h1>{title}</h1>
            <p>{intro}</p>
            <div className="legal-meta">
              <span>Última actualización</span>
              <strong>{updated}</strong>
            </div>
          </div>

          <div className="legal-content">
            {sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.children}
              </section>
            ))}
          </div>
        </article>

        <footer className="legal-footer">
          <span>© 2026 CoinRenta</span>
          <div>
            <Link href="/legal/privacidad">Privacidad</Link>
            <Link href="/legal/cookies">Cookies</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/devoluciones">Devoluciones</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
