import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
