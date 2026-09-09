import Image from "next/image";
import Link from "next/link";

export default function CoinRentaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`coinrenta-logo${compact ? " coinrenta-logo-compact" : ""}`} href="/dashboard" aria-label="CoinRenta">
      <span className="coinrenta-logo-mark" aria-hidden="true">
        <Image
          src="/logo.png"
          alt=""
          width={44}
          height={44}
          priority
        />
      </span>
      {!compact && <span className="coinrenta-logo-text">Coin<span>Renta</span></span>}
    </Link>
  );
}
