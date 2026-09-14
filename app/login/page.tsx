import { redirect } from "next/navigation";

export const metadata = {
  title: "Iniciar sesión",
  description: "Accede a tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  redirect("/proximamente");
}
