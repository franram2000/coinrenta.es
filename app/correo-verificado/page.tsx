import type { Metadata } from "next";
import AuthStatusLayout from "@/components/auth-status-layout";

export const metadata: Metadata = {
  title: "Correo verificado",
  description: "Tu dirección de correo ha sido verificada correctamente.",
  robots: { index: false, follow: false },
};

export default function EmailVerifiedPage() {
  return <AuthStatusLayout kicker="Cuenta verificada" title="Correo verificado correctamente" description="Tu dirección de correo electrónico ya está verificada y tu cuenta está lista para utilizar CoinRenta." buttonLabel="Entrar en CoinRenta" buttonHref="/dashboard" footnote="Si no esperabas esta verificación, revisa la seguridad de tu cuenta." />;
}
