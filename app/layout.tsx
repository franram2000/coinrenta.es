import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./landing.css";

const siteUrl = "https://coinrenta.es";
const siteTitle = "CoinRenta | Fiscalidad de criptomonedas y control de cartera";
const siteDescription = "Organiza tus criptomonedas, conecta exchanges o importa CSV y prepara tu información para la Renta desde un único espacio.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s | CoinRenta" },
  description: siteDescription,
  keywords: [
    "CoinRenta",
    "fiscalidad criptomonedas",
    "renta criptomonedas",
    "declaración renta criptomonedas",
    "impuestos criptomonedas España",
    "plusvalías criptomonedas",
    "control cartera cripto",
    "tracking criptomonedas",
    "operaciones criptomonedas",
    "CSV criptomonedas",
  ],
  applicationName: "CoinRenta",
  category: "finance",
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
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "CoinRenta" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/logo.png"],
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png", sizes: "any" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050812",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className="dark"><body>{children}</body></html>;
}
