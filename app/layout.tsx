import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./landing.css";
import "./cookies.css";
import "./error-pages.css";
import "./auth.css";
import "./site-ui-polish.css";
import CookieConsent from "@/components/cookie-consent";
import AnalyticsConsent from "@/components/analytics-consent";
import LegalQuickLink from "@/components/legal-quick-link";

const siteUrl = "https://coinrenta.es";
const siteTitle = "CoinRenta | Control y fiscalidad de criptomonedas en España";
const siteDescription = "Organiza tus operaciones de criptomonedas, consolida exchanges y CSV y prepara la información necesaria para revisar tu Renta desde un único espacio.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s | CoinRenta" },
  description: siteDescription,
  keywords: [
    "CoinRenta", "fiscalidad criptomonedas", "fiscalidad cripto España", "Renta criptomonedas", "declaración Renta criptomonedas", "impuestos criptomonedas España", "plusvalías criptomonedas", "control cartera criptomonedas", "gestor cartera cripto", "operaciones criptomonedas", "transacciones criptomonedas", "CSV criptomonedas", "exchanges criptomonedas", "MiCA criptomonedas", "DAC8 criptomonedas", "CARF criptomonedas",
  ],
  applicationName: "CoinRenta",
  category: "finance",
  authors: [{ name: "CoinRenta" }],
  creator: "CoinRenta",
  publisher: "CoinRenta",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", locale: "es_ES", url: siteUrl, siteName: "CoinRenta", title: siteTitle, description: siteDescription, images: [{ url: "/logo.webp", width: 512, height: 512, alt: "CoinRenta — control y fiscalidad de criptomonedas" }] },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription, images: ["/logo.webp"] },
  icons: { icon: [{ url: "/logo.webp", type: "image/webp", sizes: "any" }], apple: [{ url: "/logo.webp" }] },
};

export const viewport: Viewport = { themeColor: "#050812", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className="dark"><body>{children}<LegalQuickLink /><AnalyticsConsent /><CookieConsent /></body></html>;
}
