"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const LOADER_MESSAGES = [
  "Preparando tu espacio fiscal",
  "Cargando tu histórico",
  "Verificando movimientos",
  "Calculando resultados",
];

export default function DashboardIntro() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);
  const previousRoute = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!pathname.startsWith("/dashboard")) return;
    if (previousRoute.current === routeKey) return;

    previousRoute.current = routeKey;
    setKey((value) => value + 1);
    setMessageIndex(0);
    setVisible(true);

    const interval = window.setInterval(() => {
      setMessageIndex((value) => (value + 1) % LOADER_MESSAGES.length);
    }, 650);
    const timer = window.setTimeout(() => setVisible(false), 3200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [pathname, routeKey]);

  if (!visible) return null;

  return (
    <div className="coinrenta-loader" key={key} aria-live="polite" aria-busy="true">
      <style>{`
        .coinrenta-loader{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;background:#050a12;isolation:isolate;animation:cr-loader-in .28s ease-out both}
        .coinrenta-loader::before{content:"";position:absolute;inset:-20%;background:radial-gradient(circle at 50% 42%,rgba(20,203,191,.16),transparent 22%),radial-gradient(circle at 30% 70%,rgba(25,122,177,.12),transparent 24%),radial-gradient(circle at 75% 28%,rgba(112,81,191,.10),transparent 20%);filter:blur(16px);animation:cr-loader-aurora 7s ease-in-out infinite alternate}
        .coinrenta-loader::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 15%,rgba(255,255,255,.025) 50%,transparent 85%);transform:translateX(-110%);animation:cr-loader-sheen 2.8s ease-in-out infinite}
        .coinrenta-loader-orb{position:absolute;width:min(54vw,620px);height:min(54vw,620px);border-radius:50%;border:1px solid rgba(109,224,215,.13);box-shadow:0 0 90px rgba(15,167,160,.09),inset 0 0 60px rgba(15,167,160,.035);animation:cr-loader-orbit 12s linear infinite}
        .coinrenta-loader-orb::before,.coinrenta-loader-orb::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(109,224,215,.08)}
        .coinrenta-loader-orb::before{inset:8%;animation:cr-loader-spin-reverse 8s linear infinite}
        .coinrenta-loader-orb::after{inset:19%;border-color:rgba(109,224,215,.06);animation:cr-loader-orbit-small 6s linear infinite}
        .coinrenta-loader-mist{position:absolute;border-radius:50%;filter:blur(42px);opacity:.38;pointer-events:none}
        .coinrenta-loader-mist.a{width:220px;height:220px;background:rgba(15,167,160,.20);left:18%;top:18%;animation:cr-loader-float-a 5s ease-in-out infinite}
        .coinrenta-loader-mist.b{width:260px;height:260px;background:rgba(71,99,200,.13);right:14%;bottom:13%;animation:cr-loader-float-b 6s ease-in-out infinite}
        .coinrenta-loader-card{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;width:min(540px,calc(100vw - 42px));padding:38px 28px 30px;border:1px solid rgba(255,255,255,.09);border-radius:26px;background:linear-gradient(155deg,rgba(13,24,40,.80),rgba(7,13,23,.73));box-shadow:0 30px 100px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.035);backdrop-filter:blur(18px);animation:cr-loader-card 5s ease-in-out infinite}
        .coinrenta-loader-logo-wrap{position:relative;width:108px;height:108px;display:grid;place-items:center;margin-bottom:18px}
        .coinrenta-loader-logo-wrap::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(109,224,215,.18),transparent 62%);filter:blur(3px);animation:cr-loader-glow 2.1s ease-in-out infinite}
        .coinrenta-loader-ring{position:absolute;inset:-5px;border-radius:50%;border:1px solid rgba(109,224,215,.23);border-top-color:#6de0d7;animation:cr-loader-spin 2.2s linear infinite}
        .coinrenta-loader-ring.two{inset:8px;border-color:rgba(109,224,215,.12);border-right-color:rgba(109,224,215,.75);animation:cr-loader-spin-reverse 1.7s linear infinite}
        .coinrenta-loader-logo{position:relative;width:82px;height:82px;object-fit:contain;filter:drop-shadow(0 14px 28px rgba(0,0,0,.38));animation:cr-loader-logo 2.2s ease-in-out infinite}
        .coinrenta-loader-brand{margin:0;font-size:31px;line-height:1;font-weight:950;letter-spacing:-.06em;text-shadow:0 0 28px rgba(109,224,215,.10)}
        .coinrenta-loader-brand .coin{color:#f6fbfb}.coinrenta-loader-brand .renta{color:#6de0d7}
        .coinrenta-loader-tagline{margin:10px 0 0;color:#8192aa;font-size:11px;letter-spacing:.10em;text-transform:uppercase;font-weight:800}
        .coinrenta-loader-track{width:min(350px,84vw);height:6px;margin:25px auto 15px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.025)}
        .coinrenta-loader-track::after{content:"";display:block;width:35%;height:100%;border-radius:999px;background:linear-gradient(90deg,transparent,#0fa7a0,#6de0d7,transparent);box-shadow:0 0 20px rgba(109,224,215,.35);animation:cr-loader-progress 1.15s ease-in-out infinite}
        .coinrenta-loader-status{display:flex;align-items:center;gap:9px;min-height:17px;color:#c2cedb;font-size:11px;font-weight:750;transition:opacity .2s ease}
        .coinrenta-loader-dot{width:7px;height:7px;border-radius:50%;background:#6de0d7;box-shadow:0 0 0 4px rgba(109,224,215,.10),0 0 18px rgba(109,224,215,.5);animation:cr-loader-pulse 1s ease-in-out infinite}
        .coinrenta-loader-meta{margin-top:9px;color:#5f7087;font-size:9px;letter-spacing:.04em}
        @keyframes cr-loader-in{from{opacity:0}to{opacity:1}}
        @keyframes cr-loader-aurora{from{transform:scale(1) translate3d(0,0,0);opacity:.8}to{transform:scale(1.12) translate3d(2%,-1%,0);opacity:1}}
        @keyframes cr-loader-sheen{0%{transform:translateX(-120%)}55%,100%{transform:translateX(120%)}}
        @keyframes cr-loader-orbit{from{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.025)}to{transform:rotate(360deg) scale(1)}}
        @keyframes cr-loader-spin{to{transform:rotate(360deg)}}
        @keyframes cr-loader-spin-reverse{to{transform:rotate(-360deg)}}
        @keyframes cr-loader-orbit-small{to{transform:rotate(360deg) translateX(7px)}}
        @keyframes cr-loader-float-a{0%,100%{transform:translate3d(0,0,0) scale(.95)}50%{transform:translate3d(40px,-18px,0) scale(1.08)}}
        @keyframes cr-loader-float-b{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-34px,18px,0) scale(1.12)}}
        @keyframes cr-loader-card{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes cr-loader-glow{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes cr-loader-logo{0%,100%{transform:scale(.97) rotate(-1deg)}50%{transform:scale(1.035) rotate(1deg)}}
        @keyframes cr-loader-progress{0%{transform:translateX(-170%)}100%{transform:translateX(470%)}}
        @keyframes cr-loader-pulse{0%,100%{transform:scale(.8);opacity:.5}50%{transform:scale(1);opacity:1}}
        @media(max-width:600px){.coinrenta-loader-card{padding:30px 20px 25px;border-radius:22px}.coinrenta-loader-brand{font-size:27px}.coinrenta-loader-logo-wrap{width:92px;height:92px}.coinrenta-loader-logo{width:70px;height:70px}.coinrenta-loader-orb{width:90vw;height:90vw}}
        @media(prefers-reduced-motion:reduce){.coinrenta-loader,.coinrenta-loader::before,.coinrenta-loader::after,.coinrenta-loader-orb,.coinrenta-loader-orb::before,.coinrenta-loader-orb::after,.coinrenta-loader-mist,.coinrenta-loader-card,.coinrenta-loader-logo-wrap::before,.coinrenta-loader-ring,.coinrenta-loader-logo,.coinrenta-loader-track::after,.coinrenta-loader-dot{animation:none!important}}
      `}</style>
      <div className="coinrenta-loader-orb" aria-hidden="true" />
      <div className="coinrenta-loader-mist a" aria-hidden="true" />
      <div className="coinrenta-loader-mist b" aria-hidden="true" />
      <section className="coinrenta-loader-card">
        <div className="coinrenta-loader-logo-wrap" aria-hidden="true">
          <span className="coinrenta-loader-ring" />
          <span className="coinrenta-loader-ring two" />
          <img src="/logo.png" alt="" className="coinrenta-loader-logo" />
        </div>
        <h1 className="coinrenta-loader-brand"><span className="coin">Coin</span><span className="renta">Renta</span></h1>
        <p className="coinrenta-loader-tagline">Tu información fiscal, bajo control</p>
        <div className="coinrenta-loader-track" aria-hidden="true" />
        <div className="coinrenta-loader-status"><span className="coinrenta-loader-dot" />{LOADER_MESSAGES[messageIndex]}</div>
        <div className="coinrenta-loader-meta">Un momento, estamos preparando la información</div>
      </section>
    </div>
  );
}
