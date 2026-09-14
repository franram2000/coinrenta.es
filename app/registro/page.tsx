import { redirect } from "next/navigation";

export const metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de CoinRenta.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  redirect("/proximamente");
}
