export default function Loading() {
  return (
    <main className="dashboard-content workspace-page renta-page" aria-busy="true" aria-live="polite">
      <style>{`
        .renta-loading-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:16px}
        .renta-loading-title{width:220px;height:30px;border-radius:8px;background:linear-gradient(90deg,rgba(255,255,255,.06) 25%,rgba(255,255,255,.11) 37%,rgba(255,255,255,.06) 63%);background-size:400% 100%;animation:renta-shimmer 1.2s ease-in-out infinite}
        .renta-loading-subtitle{width:300px;height:14px;margin-top:10px;border-radius:6px;background:rgba(255,255,255,.045)}
        .renta-loading-years{display:flex;gap:6px;flex-wrap:wrap;max-width:470px}
        .renta-loading-year{width:52px;height:33px;border-radius:9px;background:rgba(255,255,255,.045)}
        .renta-loading-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:15px}
        .renta-loading-card{height:112px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.045) 25%,rgba(255,255,255,.075) 37%,rgba(255,255,255,.045) 63%);background-size:400% 100%;animation:renta-shimmer 1.2s ease-in-out infinite}
        .renta-loading-panel{height:230px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.065) 37%,rgba(255,255,255,.04) 63%);background-size:400% 100%;animation:renta-shimmer 1.2s ease-in-out infinite}
        .renta-loading-status{display:flex;align-items:center;gap:9px;margin-top:14px;color:#7F8DA3;font-size:11px}
        .renta-loading-dot{width:7px;height:7px;border-radius:50%;background:var(--cr-primary);box-shadow:0 0 0 4px var(--cr-primary-soft);animation:renta-pulse 1.4s ease-in-out infinite}
        @keyframes renta-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
        @keyframes renta-pulse{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}
        @media(max-width:900px){.renta-loading-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.renta-loading-hero{align-items:flex-start;flex-direction:column}}
        @media(max-width:560px){.renta-loading-grid{grid-template-columns:1fr}}
      `}</style>
      <section className="renta-loading-hero panel-card">
        <div>
          <div className="renta-loading-title" />
          <div className="renta-loading-subtitle" />
          <div className="renta-loading-status"><span className="renta-loading-dot" />Preparando el ejercicio fiscal…</div>
        </div>
        <div className="renta-loading-years" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => <span key={index} className="renta-loading-year" />)}
        </div>
      </section>
      <section className="renta-loading-grid" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="renta-loading-card" />)}
      </section>
      <section className="renta-loading-panel" aria-hidden="true" />
      <div className="renta-loading-status"><span className="renta-loading-dot" />Comprobando movimientos y calculando FIFO</div>
    </main>
  );
}
