export default function Loading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-live="polite">
      <style>{`
        .dashboard-loading{min-height:calc(100vh - 32px);display:grid;place-items:center;padding:32px;box-sizing:border-box}
        .dashboard-loading-card{width:min(620px,100%);padding:32px;border:1px solid var(--cr-border,rgba(255,255,255,.08));border-radius:20px;background:var(--cr-surface,#0b1422);box-shadow:0 18px 60px rgba(0,0,0,.22)}
        .dashboard-loading-brand{display:flex;align-items:center;gap:12px}
        .dashboard-loading-mark{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--cr-primary,#0fa7a0),rgba(109,224,215,.35));box-shadow:0 0 0 6px var(--cr-primary-soft,rgba(15,167,160,.08))}
        .dashboard-loading-title{height:18px;width:170px;border-radius:7px;background:rgba(255,255,255,.08)}
        .dashboard-loading-subtitle{height:11px;width:260px;margin-top:9px;border-radius:6px;background:rgba(255,255,255,.045)}
        .dashboard-loading-progress{height:7px;margin-top:26px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.045)}
        .dashboard-loading-progress::after{content:"";display:block;width:42%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent,var(--cr-primary,#0fa7a0),transparent);animation:dashboard-loading-progress 1.25s ease-in-out infinite}
        .dashboard-loading-status{display:flex;align-items:center;gap:10px;margin-top:16px;color:#8a99ad;font-size:11px}
        .dashboard-loading-dot{width:7px;height:7px;border-radius:50%;background:var(--cr-primary,#0fa7a0);box-shadow:0 0 0 4px var(--cr-primary-soft,rgba(15,167,160,.08));animation:dashboard-loading-pulse 1.4s ease-in-out infinite}
        .dashboard-loading-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}
        .dashboard-loading-block{height:72px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.075) 37%,rgba(255,255,255,.04) 63%);background-size:400% 100%;animation:dashboard-loading-shimmer 1.2s ease-in-out infinite}
        @keyframes dashboard-loading-progress{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}
        @keyframes dashboard-loading-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
        @keyframes dashboard-loading-pulse{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}
        @media(max-width:600px){.dashboard-loading{padding:18px}.dashboard-loading-card{padding:24px}.dashboard-loading-grid{grid-template-columns:1fr}}
      `}</style>
      <section className="dashboard-loading-card">
        <div className="dashboard-loading-brand">
          <span className="dashboard-loading-mark" aria-hidden="true" />
          <div>
            <div className="dashboard-loading-title" aria-hidden="true" />
            <div className="dashboard-loading-subtitle" aria-hidden="true" />
          </div>
        </div>
        <div className="dashboard-loading-progress" aria-hidden="true" />
        <div className="dashboard-loading-status"><span className="dashboard-loading-dot" />Cargando tu información y preparando la página…</div>
        <div className="dashboard-loading-grid" aria-hidden="true">
          <div className="dashboard-loading-block" />
          <div className="dashboard-loading-block" />
          <div className="dashboard-loading-block" />
        </div>
      </section>
    </main>
  );
}
