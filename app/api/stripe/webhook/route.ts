import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

function verifySignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",").reduce<Record<string, string[]>>((acc, item) => { const [key, value] = item.split("=", 2); if (key && value) (acc[key] ||= []).push(value); return acc; }, {});
  const timestamp = Number(parts.t?.[0]); const signatures = parts.v1 || [];
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !signatures.length) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signatures.some((value) => { const a = Buffer.from(expected, "utf8"); const b = Buffer.from(value, "utf8"); return a.length === b.length && timingSafeEqual(a, b); });
}

function admin() { return createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }); }
function planFromPrice(priceId: string | undefined) {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) return "pro";
  if (priceId && priceId === process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY || priceId === process.env.STRIPE_PRICE_ESSENTIAL_YEARLY) return "essential";
  return "free";
}
function intervalFromPrice(priceId: string | undefined) {
  if (priceId === process.env.STRIPE_PRICE_PRO_YEARLY || priceId === process.env.STRIPE_PRICE_ESSENTIAL_YEARLY) return "year";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY) return "month";
  return null;
}
async function syncSubscription(subscription: any, fallbackUserId?: string) {
  const supabase = admin();
  const userId = String(subscription?.metadata?.user_id || fallbackUserId || "").trim();
  const customerId = typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id;
  if (!userId && !customerId) return;
  let targetId = userId;
  if (!targetId && customerId) { const { data } = await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle(); targetId = data?.id || ""; }
  if (!targetId) return;
  const item = subscription?.items?.data?.[0]; const priceId = item?.price?.id;
  const active = ["active", "trialing"].includes(String(subscription?.status));
  const plan = active ? planFromPrice(priceId) : "free";
  const interval = active ? intervalFromPrice(priceId) : null;
  const periodEnd = subscription?.current_period_end ? new Date(Number(subscription.current_period_end) * 1000).toISOString() : null;
  await supabase.from("profiles").update({ stripe_customer_id: customerId || undefined, stripe_subscription_id: active ? subscription.id : null, subscription_plan: plan, subscription_interval: interval, subscription_status: subscription?.status || "canceled", subscription_current_period_end: periodEnd }).eq("id", targetId);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET; const body = await request.text(); const signature = request.headers.get("stripe-signature") || "";
  if (!secret || !verifySignature(body, signature, secret)) return NextResponse.json({ error: "Firma de webhook no válida." }, { status: 400 });
  const event = JSON.parse(body);
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object; const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id; const userId = session.client_reference_id || session.metadata?.user_id;
      if (subscriptionId) {
        const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: "no-store" });
        const subscription = await response.json(); if (response.ok) await syncSubscription(subscription, userId);
      }
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(event.data.object);
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object; if (invoice.subscription) {
        const response = await fetch(`https://api.stripe.com/v1/subscriptions/${invoice.subscription}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: "no-store" });
        const subscription = await response.json(); if (response.ok) await syncSubscription(subscription);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) { console.error("Stripe webhook error", error); return NextResponse.json({ error: "No se pudo sincronizar la suscripción." }, { status: 500 }); }
}
