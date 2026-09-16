import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Stripe no está configurado todavía." }, { status: 503 });
  const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: "No existe todavía una suscripción de Stripe para esta cuenta." }, { status: 404 });
  const params = new URLSearchParams({ customer: profile.stripe_customer_id, return_url: `${new URL(request.url).origin}/dashboard/suscripcion` });
  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "No se pudo abrir el portal de Stripe." }, { status: 502 });
  return NextResponse.json({ url: data.url });
}
