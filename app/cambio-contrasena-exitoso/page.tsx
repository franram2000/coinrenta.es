import type { Metadata } from "next";
import AuthStatusLayout from "@/components/auth-status-layout";

export const metadata: Metadata = {
  title: "Contraseña actualizada",
  description: "Tu contraseña de CoinRenta ha sido actualizada correctamente.",
  robots: { index: false, follow: false },
};

export default function PasswordChangedPage() {
  return <AuthStatusLayout kicker="Seguridad actualizada" title="Contraseña cambiada correctamente" description="Tu nueva contraseña ya está activa. Puedes iniciar sesión con ella desde este momento." buttonLabel="Iniciar sesión" buttonHref="/login" footnote="No compartas tu contraseña con nadie." />;
}
