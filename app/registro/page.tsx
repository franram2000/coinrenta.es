import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  return <AuthForm mode="register" plan={searchParams.then((params) => params.plan === "pro" ? "pro" : params.plan === "essential" ? "essential" : undefined)} />;
}
