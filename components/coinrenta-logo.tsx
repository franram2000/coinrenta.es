import Link from "next/link";

export default function CoinRentaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`coinrenta-logo${compact ? " coinrenta-logo-compact" : ""}`} href="/dashboard" aria-label="CoinRenta">
      <span className="coinrenta-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="img">
          <path d="M29.7 9.1A15.6 15.6 0 1 0 31 28.4" fill="none" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" />
          <path d="M29.5 8.5v9.1h-9.1" fill="none" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 13.8v12.4M16.4 17.2h7.2a3.1 3.1 0 0 1 0 6.2h-7.2m0-6.2h6.2a3.1 3.1 0 0 0 0-6.2h-6.2" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && <span className="coinrenta-logo-text">Coin<span>Renta</span></span>}
    </Link>
  );
}
