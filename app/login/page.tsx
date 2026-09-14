import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";

export const metadata = {
  title: "Iniciar sesión",
  description: "Accede a tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase();

  if (host !== "coinrenta-es.vercel.app") {
    redirect("/proximamente");
  }

  return <AuthForm mode="login" />;
}
