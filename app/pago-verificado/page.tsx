import type { Metadata } from "next";
import AuthStatusLayout from "@/components/auth-status-layout";

export const metadata: Metadata = {
  title: "Pago verificado",
  description: "El pago de CoinRenta ha sido verificado correctamente.",
  robots: { index: false, follow: false },
};

export default function PaymentVerifiedPage() {
  return <AuthStatusLayout kicker="Suscripción" title="Pago verificado correctamente" description="Hemos recibido la confirmación del pago. Tu suscripción se actualizará de acuerdo con el plan contratado." buttonLabel="Ir al dashboard" buttonHref="/dashboard" footnote="Conserva el comprobante de pago de tu entidad de cobro." />;
}
