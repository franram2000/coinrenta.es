import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://coinrenta.es";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CoinRenta | Calcula tus criptomonedas para la Renta",
    template: "%s | CoinRenta",
  },
  description:
    "Calcula y organiza tus operaciones con criptomonedas para la declaración de la Renta. Importa CSV o conecta tus exchanges y prepara tus datos fiscales.",
  keywords: [
    "criptomonedas renta",
    "declaración de la renta criptomonedas",
    "fiscalidad criptomonedas",
    "renta crypto",
    "ganancias criptomonedas",
    "CoinRenta",
  ],
  applicationName: "CoinRenta",
  authors: [{ name: "CoinRenta" }],
  creator: "CoinRenta",
  publisher: "CoinRenta",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: siteUrl,
    siteName: "CoinRenta",
    title: "CoinRenta | Tu cripto, lista para la Renta",
    description:
      "Conecta tus exchanges o importa tus CSV. Organiza tus movimientos y prepara tu información fiscal de criptomonedas.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CoinRenta | Tu cripto, lista para la Renta",
    description:
      "La forma sencilla de organizar tus operaciones con criptomonedas para la declaración de la Renta.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
