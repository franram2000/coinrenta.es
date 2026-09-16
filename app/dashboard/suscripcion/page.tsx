import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CoinRentaLogo from "@/components/coinrenta-logo";
import SubscriptionPlans from "./subscription-plans";

export const metadata: Metadata = { title: "Suscripción", description: "Planes y suscripción de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("subscription_plan,subscription_interval,subscription_status,subscription_current_period_end,role").eq("id", user.id).maybeSingle();
  const plan = profile?.role === "admin" ? "admin" : (profile?.subscription_plan || "free");
  return (
    <main className="subscription-page">
      <style>{`
        .subscription-page{min-height:100vh;padding:28px 34px 60px;background:radial-gradient(circle at 50% -12%,rgba(15,167,160,.16),transparent 36%),#070c16;color:#f4f7fb}.subscription-nav{max-width:1220px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}.subscription-back{color:#8292a8;font-size:11px;font-weight:800;text-decoration:none}.subscription-back:hover{color:#6de0d7}.subscription-hero{max-width:940px;margin:62px auto 38px;text-align:center}.subscription-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid rgba(15,167,160,.2);border-radius:999px;background:rgba(15,167,160,.07);color:#6de0d7;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.subscription-eyebrow i{width:6px;height:6px;border-radius:50%;background:#18c9c0;box-shadow:0 0 0 5px rgba(15,167,160,.08)}.subscription-hero h1{margin:18px 0 10px;font-size:clamp(36px,6vw,62px);line-height:.98;letter-spacing:-.06em}.subscription-hero h1 span{color:#19c8bf}.subscription-hero p{max-width:650px;margin:0 auto;color:#8191a7;font-size:14px;line-height:1.7}.subscription-trust{display:flex;justify-content:center;flex-wrap:wrap;gap:18px;margin-top:20px;color:#687a91;font-size:10px}.subscription-trust span:before{content:"✓";margin-right:6px;color:#40ca91}.subscription-shell{max-width:1220px;margin:0 auto}.subscription-current{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 auto 22px;padding:14px 17px;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(13,21,36,.78)}.subscription-current-copy{display:flex;align-items:center;gap:10px}.subscription-current-dot{width:9px;height:9px;border-radius:50%;background:#45cf91;box-shadow:0 0 0 6px rgba(69,207,145,.08)}.subscription-current strong{font-size:11px}.subscription-current small{display:block;margin-top:3px;color:#708097;font-size:9px}.subscription-current-plan{color:#6de0d7;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.subscription-foot{max-width:850px;margin:28px auto 0;text-align:center;color:#5e6e83;font-size:9px;line-height:1.7}@media(max-width:760px){.subscription-page{padding:18px 15px 42px}.subscription-nav .coinrenta-logo-text{display:none}.subscription-hero{margin:45px auto 28px}.subscription-hero h1{font-size:40px}.subscription-current{align-items:flex-start}.subscription-current-plan{white-space:nowrap}}
      `}</style>
      <nav className="subscription-nav"><CoinRentaLogo/><Link href="/dashboard" className="subscription-back">← Volver al panel</Link></nav>
      <header className="subscription-hero"><span className="subscription-eyebrow"><i/> CoinRenta Premium</span><h1>Tu fiscalidad cripto.<br/><span>Más clara. Más completa.</span></h1><p>Elige el plan que encaja contigo. Sin permanencia y con la tranquilidad de tener tus operaciones organizadas para tu información fiscal.</p><div className="subscription-trust"><span>Cancelación desde tu cuenta</span><span>Pago seguro con Stripe</span><span>Datos bajo tu control</span></div></header>
      <section className="subscription-shell"><div className="subscription-current"><div className="subscription-current-copy"><span className="subscription-current-dot"/><div><strong>Tu plan actual</strong><small>{profile?.subscription_status ? `Estado: ${profile.subscription_status}` : "Sin suscripción de pago"}</small></div></div><span className="subscription-current-plan">{plan === "admin" ? "Administrador" : plan === "pro" ? "Pro" : plan === "essential" ? "Esencial" : "Free"}</span></div><SubscriptionPlans plan={plan} interval={profile?.subscription_interval || null} periodEnd={profile?.subscription_current_period_end || null}/></section>
      <p className="subscription-foot">Las funciones disponibles pueden evolucionar. CoinRenta proporciona herramientas de organización y cálculo de información fiscal; la responsabilidad de revisar y presentar correctamente la declaración corresponde al usuario y, cuando proceda, a su asesor.</p>
    </main>
  );
}
