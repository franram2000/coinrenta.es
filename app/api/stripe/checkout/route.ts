import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PRICE_KEYS = {
  essential: { month: "STRIPE_PRICE_ESSENTIAL_MONTHLY", year: "STRIPE_PRICE_ESSENTIAL_YEARLY" },
  pro: { month: "STRIPE_PRICE_PRO_MONTHLY", year: "STRIPE_PRICE_PRO_YEARLY" },
} as const;

function stripeKey() { return process.env.STRIPE_SECRET_KEY || ""; }

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!stripeKey()) return NextResponse.json({ error: "Stripe no está configurado todavía." }, { status: 503 });

  const body = await request.json().catch(() => null) as { plan?: string; interval?: string } | null;
  const plan = body?.plan as keyof typeof PRICE_KEYS;
  const interval = body?.interval as "month" | "year";
  if (!PRICE_KEYS[plan] || !["month", "year"].includes(interval)) return NextResponse.json({ error: "Plan o periodicidad no válidos." }, { status: 400 });
  const price = process.env[PRICE_KEYS[plan][interval]];
  if (!price) return NextResponse.json({ error: `Falta configurar el precio de Stripe para ${plan} ${interval}.` }, { status: 503 });

  const { data: profile, error: profileError } = await supabase.from("profiles").select("stripe_customer_id,subscription_plan,subscription_status").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (profile?.subscription_status === "active" || profile?.subscription_status === "trialing") return NextResponse.json({ error: "Ya tienes una suscripción activa. Gestiona el cambio desde tu suscripción actual." }, { status: 409 });

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${origin}/dashboard/suscripcion?success=1&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/dashboard/suscripcion?canceled=1`);
  params.set("client_reference_id", user.id);
  params.set("customer_email", user.email || "");
  params.set("subscription_data[metadata][user_id]", user.id);
  params.set("subscription_data[metadata][plan]", plan);
  params.set("subscription_data[metadata][interval]", interval);
  if (profile?.stripe_customer_id) {
    params.delete("customer_email");
    params.set("customer", profile.stripe_customer_id);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "Stripe no pudo crear el checkout." }, { status: 502 });

  if (data.customer && !profile?.stripe_customer_id) {
    const { error } = await supabase.from("profiles").update({ stripe_customer_id: data.customer }).eq("id", user.id);
    if (error) console.error("Stripe customer sync error", error);
  }

  return NextResponse.json({ url: data.url });
}
