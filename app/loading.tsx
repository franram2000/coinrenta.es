export default function Loading() {
  return (
    <main className="app-loading" aria-busy="true" aria-live="polite">
      <style>{`
        .app-loading{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#07101c;color:#dce5ef}
        .app-loading-card{width:min(520px,100%);padding:30px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:#0b1422;box-shadow:0 20px 70px rgba(0,0,0,.28)}
        .app-loading-mark{width:40px;height:40px;border-radius:12px;margin-bottom:20px;background:linear-gradient(135deg,#0fa7a0,#6de0d7);box-shadow:0 0 0 7px rgba(15,167,160,.08)}
        .app-loading-line{height:13px;border-radius:6px;background:rgba(255,255,255,.07)}
        .app-loading-line.big{width:210px;height:18px}
        .app-loading-line.small{width:280px;margin-top:9px;background:rgba(255,255,255,.045)}
        .app-loading-bar{height:7px;margin-top:25px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.04)}
        .app-loading-bar::after{content:"";display:block;width:38%;height:100%;background:linear-gradient(90deg,transparent,#0fa7a0,transparent);animation:app-loading-slide 1.25s ease-in-out infinite}
        .app-loading-status{display:flex;align-items:center;gap:10px;margin-top:15px;color:#8290a5;font-size:11px}
        .app-loading-dot{width:7px;height:7px;border-radius:50%;background:#0fa7a0;box-shadow:0 0 0 4px rgba(15,167,160,.08);animation:app-loading-pulse 1.4s ease-in-out infinite}
        @keyframes app-loading-slide{0%{transform:translateX(-140%)}100%{transform:translateX(390%)}}
        @keyframes app-loading-pulse{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:1;transform:scale(1)}}
      `}</style>
      <section className="app-loading-card">
        <div className="app-loading-mark" aria-hidden="true" />
        <div className="app-loading-line big" aria-hidden="true" />
        <div className="app-loading-line small" aria-hidden="true" />
        <div className="app-loading-bar" aria-hidden="true" />
        <div className="app-loading-status"><span className="app-loading-dot" />Cargando CoinRenta…</div>
      </section>
    </main>
  );
}
