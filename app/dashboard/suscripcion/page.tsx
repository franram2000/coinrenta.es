import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CoinRentaLogo from "@/components/coinrenta-logo";
import SubscriptionPlans from "./subscription-plans";

export const metadata: Metadata = { title: "Suscripción", description: "Planes y suscripción de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SubscriptionPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const success = params?.success === "1";

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_plan,subscription_interval,subscription_status,subscription_current_period_end,role")
    .eq("id", user.id)
    .maybeSingle();

  const plan = profile?.role === "admin" ? "admin" : (profile?.subscription_plan || "free");
  const paid = plan === "essential" || plan === "pro";

  return (
    <main className="subscription-page">
      <style>{`.subscription-page{min-height:100vh;padding:28px 34px 60px;background:radial-gradient(circle at 50% -12%,rgba(15,167,160,.16),transparent 36%),#070c16;color:#f4f7fb}.subscription-nav{max-width:1220px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}.subscription-back{color:#a0aec0;font-size:13px;font-weight:800;text-decoration:none}.subscription-back:hover{color:#6de0d7}.subscription-hero{max-width:940px;margin:62px auto 34px;text-align:center}.subscription-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(15,167,160,.2);border-radius:999px;background:rgba(15,167,160,.07);color:#6de0d7;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.subscription-eyebrow i{width:7px;height:7px;border-radius:50%;background:#18c9c0;box-shadow:0 0 0 5px rgba(15,167,160,.08)}.subscription-hero h1{margin:18px 0 12px;font-size:clamp(38px,6vw,62px);line-height:1;letter-spacing:-.055em}.subscription-hero h1 span{color:#19c8bf}.subscription-hero p{max-width:700px;margin:0 auto;color:#91a0b6;font-size:16px;line-height:1.7}.subscription-trust{display:flex;justify-content:center;flex-wrap:wrap;gap:18px;margin-top:20px;color:#7f8da3;font-size:12px}.subscription-trust span:before{content:"✓";margin-right:7px;color:#40ca91}.subscription-notice{max-width:720px;margin:0 auto 22px;padding:13px 16px;border:1px solid rgba(50,181,122,.25);border-radius:12px;background:rgba(50,181,122,.07);color:#9de2bc;text-align:center;font-size:13px;line-height:1.5}.subscription-current{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 auto 22px;padding:16px 18px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(13,21,36,.82)}.subscription-current-copy{display:flex;align-items:center;gap:11px}.subscription-current-dot{width:9px;height:9px;border-radius:50%;background:#45cf91;box-shadow:0 0 0 6px rgba(69,207,145,.08)}.subscription-current strong{font-size:13px}.subscription-current small{display:block;margin-top:4px;color:#78879d;font-size:11px}.subscription-current-plan{color:#6de0d7;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.subscription-shell{max-width:1220px;margin:0 auto}.subscription-foot{max-width:850px;margin:30px auto 0;text-align:center;color:#66778d;font-size:11px;line-height:1.7}@media(max-width:760px){.subscription-page{padding:18px 15px 42px}.subscription-nav .coinrenta-logo-text{display:none}.subscription-hero{margin:45px auto 28px}.subscription-hero h1{font-size:40px}.subscription-hero p{font-size:14px}.subscription-current{align-items:flex-start}.subscription-current-plan{white-space:nowrap}}`}</style>
      <nav className="subscription-nav"><CoinRentaLogo/><Link href="/dashboard" className="subscription-back">← Volver al panel</Link></nav>
      <header className="subscription-hero"><span className="subscription-eyebrow"><i/> CoinRenta Premium</span><h1>Tu fiscalidad cripto.<br/><span>Más clara. Más completa.</span></h1><p>Elige el plan que encaja contigo. Sin permanencia y con la tranquilidad de tener tus operaciones organizadas para tu información fiscal.</p><div className="subscription-trust"><span>Cancelación desde tu cuenta</span><span>Pago seguro con Paddle</span><span>Datos bajo tu control</span></div></header>
      <section className="subscription-shell">
        {success && <div className="subscription-notice">✓ Pago completado. Tu plan se actualizará automáticamente en cuanto Paddle confirme la suscripción.</div>}
        <div className="subscription-current"><div className="subscription-current-copy"><span className="subscription-current-dot"/><div><strong>Tu plan actual</strong><small>{profile?.subscription_status ? `Estado: ${profile.subscription_status}` : "Sin suscripción de pago"}</small></div></div><span className="subscription-current-plan">{plan === "admin" ? "Administrador" : plan === "pro" ? "Pro" : plan === "essential" ? "Esencial" : "Free"}</span></div>
        <SubscriptionPlans plan={plan} interval={profile?.subscription_interval || null} periodEnd={profile?.subscription_current_period_end || null}/>
        {paid && <p className="subscription-management-hint">Desde <strong>Gestionar suscripción</strong> puedes cambiar tu suscripción, actualizar tus datos de facturación o cancelar la renovación mediante el portal seguro de Paddle.</p>}
      </section>
      <p className="subscription-foot">Las funciones disponibles pueden evolucionar. CoinRenta proporciona herramientas de organización y cálculo de información fiscal; la responsabilidad de revisar y presentar correctamente la declaración corresponde al usuario y, cuando proceda, a su asesor.</p>
    </main>
  );
}
