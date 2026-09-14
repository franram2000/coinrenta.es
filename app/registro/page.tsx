import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";

export const metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase();

  if (host !== "coinrenta-es.vercel.app") {
    redirect("/proximamente");
  }

  return <AuthForm mode="register" />;
}
