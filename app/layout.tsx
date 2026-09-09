import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://coinrenta.es";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "CoinRenta | Tu cripto, lista para la Renta", template: "%s | CoinRenta" },
  description: "Centraliza tus movimientos de criptomonedas, conecta tus exchanges o importa CSV y prepara tu información fiscal para la Renta.",
  keywords: ["criptomonedas renta", "declaración renta criptomonedas", "fiscalidad criptomonedas", "CoinRenta"],
  applicationName: "CoinRenta",
  authors: [{ name: "CoinRenta" }],
  creator: "CoinRenta",
  publisher: "CoinRenta",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", locale: "es_ES", url: siteUrl, siteName: "CoinRenta", title: "CoinRenta | Tu cripto, lista para la Renta", description: "Centraliza tus movimientos, conecta tus exchanges o importa CSV y prepara tus datos fiscales." },
  twitter: { card: "summary_large_image", title: "CoinRenta | Tu cripto, lista para la Renta", description: "Organiza tus operaciones cripto y prepara la información para la Renta." },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#0B1220", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className="dark"><body>{children}</body></html>;
}
