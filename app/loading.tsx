export default function Loading() {
  return (
    <main className="coinrenta-loading" aria-busy="true" aria-live="polite">
      <style>{`
        .coinrenta-loading{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 38%,rgba(15,167,160,.14),transparent 34%),linear-gradient(135deg,#050b14 0%,#071321 52%,#050b14 100%);color:#eef7f6}
        .coinrenta-loading::before,.coinrenta-loading::after{content:"";position:absolute;border-radius:999px;filter:blur(2px);pointer-events:none}
        .coinrenta-loading::before{width:440px;height:440px;border:1px solid rgba(109,224,215,.09);box-shadow:0 0 110px rgba(15,167,160,.12);animation:cr-orbit 8s linear infinite}
        .coinrenta-loading::after{width:640px;height:640px;border:1px solid rgba(109,224,215,.05);animation:cr-orbit-reverse 14s linear infinite}
        .coinrenta-loading-card{position:relative;width:min(520px,calc(100vw - 44px));padding:42px 38px 34px;text-align:center;border:1px solid rgba(255,255,255,.09);border-radius:28px;background:linear-gradient(180deg,rgba(12,25,39,.86),rgba(8,17,29,.92));backdrop-filter:blur(18px);box-shadow:0 28px 90px rgba(0,0,0,.38),0 0 0 1px rgba(15,167,160,.025) inset}
        .coinrenta-logo-wrap{position:relative;display:grid;place-items:center;width:104px;height:104px;margin:0 auto 22px}
        .coinrenta-logo-glow{position:absolute;inset:9px;border-radius:50%;background:rgba(15,167,160,.16);filter:blur(18px);animation:cr-glow 2.1s ease-in-out infinite}
        .coinrenta-logo-ring{position:absolute;inset:0;border:1px solid rgba(109,224,215,.26);border-radius:50%;animation:cr-ring 2.8s ease-in-out infinite}
        .coinrenta-logo{position:relative;width:76px;height:76px;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(0,0,0,.32))}
        .coinrenta-brand{font-size:31px;font-weight:900;letter-spacing:-.055em;line-height:1}.coin{color:#f4fbfa}.renta{color:#6de0d7}
        .coinrenta-tagline{margin-top:10px;color:#91a3b8;font-size:12px;letter-spacing:.02em}
        .coinrenta-progress{height:7px;margin:30px 0 18px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.055);box-shadow:inset 0 0 0 1px rgba(255,255,255,.025)}
        .coinrenta-progress::after{content:"";display:block;width:34%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent,#0fa7a0,#6de0d7,transparent);box-shadow:0 0 20px rgba(109,224,215,.32);animation:cr-progress 1.35s cubic-bezier(.4,0,.2,1) infinite}
        .coinrenta-status{display:flex;justify-content:center;align-items:center;gap:9px;color:#b4c1cf;font-size:11px;font-weight:650}
        .coinrenta-dot{width:7px;height:7px;border-radius:50%;background:#6de0d7;box-shadow:0 0 0 4px rgba(109,224,215,.10),0 0 16px rgba(109,224,215,.42);animation:cr-pulse 1.2s ease-in-out infinite}
        .coinrenta-substatus{margin-top:8px;color:#667991;font-size:10px}
        .coinrenta-spark{position:absolute;width:4px;height:4px;border-radius:50%;background:#6de0d7;box-shadow:0 0 14px rgba(109,224,215,.8);animation:cr-float 3.4s ease-in-out infinite}
        .s1{top:18%;left:15%}.s2{top:23%;right:17%;animation-delay:.8s}.s3{bottom:19%;left:20%;animation-delay:1.4s}.s4{bottom:22%;right:14%;animation-delay:2.1s}
        @keyframes cr-progress{0%{transform:translateX(-160%)}100%{transform:translateX(390%)}}
        @keyframes cr-pulse{0%,100%{transform:scale(.82);opacity:.5}50%{transform:scale(1);opacity:1}}
        @keyframes cr-glow{0%,100%{opacity:.65;transform:scale(.92)}50%{opacity:1;transform:scale(1.04)}}
        @keyframes cr-ring{0%,100%{transform:scale(.94);opacity:.45}50%{transform:scale(1);opacity:1}}
        @keyframes cr-orbit{from{transform:rotate(0deg) scale(1)}to{transform:rotate(360deg) scale(1)}}
        @keyframes cr-orbit-reverse{from{transform:rotate(360deg) scale(1)}to{transform:rotate(0deg) scale(1)}}
        @keyframes cr-float{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(-12px);opacity:1}}
        @media(max-width:600px){.coinrenta-loading-card{padding:34px 24px 28px}.coinrenta-logo-wrap{width:92px;height:92px}.coinrenta-logo{width:68px;height:68px}.coinrenta-brand{font-size:27px}}
        @media(prefers-reduced-motion:reduce){.coinrenta-loading::before,.coinrenta-loading::after,.coinrenta-logo-glow,.coinrenta-logo-ring,.coinrenta-progress::after,.coinrenta-dot,.coinrenta-spark{animation:none}}
      `}</style>
      <span className="coinrenta-spark s1" aria-hidden="true" /><span className="coinrenta-spark s2" aria-hidden="true" /><span className="coinrenta-spark s3" aria-hidden="true" /><span className="coinrenta-spark s4" aria-hidden="true" />
      <section className="coinrenta-loading-card">
        <div className="coinrenta-logo-wrap">
          <span className="coinrenta-logo-glow" aria-hidden="true" />
          <span className="coinrenta-logo-ring" aria-hidden="true" />
          <img className="coinrenta-logo" src="/logo.png" alt="CoinRenta" />
        </div>
        <div className="coinrenta-brand"><span className="coin">Coin</span><span className="renta">Renta</span></div>
        <div className="coinrenta-tagline">Preparando tu información fiscal</div>
        <div className="coinrenta-progress" aria-hidden="true" />
        <div className="coinrenta-status"><span className="coinrenta-dot" />Cargando CoinRenta…</div>
        <div className="coinrenta-substatus">Estamos preparando la página y tus datos. Un momento.</div>
      </section>
    </main>
  );
}
