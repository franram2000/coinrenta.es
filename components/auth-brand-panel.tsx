"use client";

import Image from "next/image";

type AuthBrandPanelProps = {
  variant: "login" | "register" | "recovery";
};

const content = {
  login: {
    kicker: "Espacio fiscal privado",
    title: "Vuelve a tener todo bajo control.",
    description: "Accede a tu espacio para consultar tus movimientos, revisar información y seguir preparando tus datos para la Renta.",
    trust: ["Datos centralizados", "Trazabilidad", "Acceso seguro"],
  },
  register: {
    kicker: "Preparación fiscal cripto",
    title: "Empieza con tus datos en orden.",
    description: "Crea tu espacio en CoinRenta para reunir fuentes, normalizar operaciones y trabajar con una base fiscal mucho más clara.",
    trust: ["Multi-fuente", "Enfoque fiscal español", "Acceso seguro"],
  },
  recovery: {
    kicker: "Seguridad de tu cuenta",
    title: "Recupera el acceso sin complicaciones.",
    description: "Te ayudamos a recuperar tu cuenta y volver a tu espacio de CoinRenta manteniendo el proceso simple y seguro.",
    trust: ["Enlace personal", "Proceso seguro", "Datos privados"],
  },
} as const;

export default function AuthBrandPanel({ variant }: AuthBrandPanelProps) {
  const item = content[variant];

  return (
    <div className={`auth-brand-panel auth-brand-panel-${variant}`}>
      <div className="auth-brand-stage" aria-hidden="true">
        <div className="auth-brand-aura" />
        <span className="auth-brand-ring r1" />
        <span className="auth-brand-ring r2" />
        <span className="auth-brand-ring r3" />
        <span className="auth-brand-orbit" />
        <Image src="/logo.png" alt="" width={124} height={124} className="auth-brand-logo" priority />
      </div>

      <div className="auth-brand-identity">
        <span className="auth-brand-status"><i /> COINRENTA · ESPAÑA</span>
        <div className="auth-brand-wordmark" aria-label="CoinRenta">
          <span className="coin">Coin</span><span className="renta">Renta</span>
        </div>
      </div>

      <div className="auth-brand-copy">
        <span className="auth-eyebrow">{item.kicker}</span>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
      </div>

      <div className="auth-trust-row" aria-label="Características">
        {item.trust.map((label) => (
          <span key={label}><b>✓</b> {label}</span>
        ))}
      </div>

      <div className="auth-brand-note">
        <span>01</span>
        <p>Un espacio pensado para organizar información cripto antes de revisar tu situación fiscal.</p>
      </div>
    </div>
  );
}
