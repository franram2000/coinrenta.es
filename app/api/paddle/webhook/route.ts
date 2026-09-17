import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

const PRICE_TO_PLAN: Record<string, { plan: "essential" | "pro"; interval: "month" | "year" }> = {
  [process.env.NEXT_PUBLIC_PADDLE_PRICE_ESSENTIAL_MONTHLY || ""]: { plan: "essential", interval: "month" },
  [process.env.NEXT_PUBLIC_PADDLE_PRICE_ESSENTIAL_YEARLY || ""]: { plan: "essential", interval: "year" },
  [process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY || ""]: { plan: "pro", interval: "month" },
  [process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY || ""]: { plan: "pro", interval: "year" },
};

function admin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function getPaddle() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return null;
  return new Paddle(apiKey, { environment: Environment.sandbox });
}

function subscriptionFields(subscription: any) {
  const item = subscription?.items?.find((entry: any) => entry?.recurring !== false) || subscription?.items?.[0];
  const priceId = item?.price?.id;
  const mapped = PRICE_TO_PLAN[priceId || ""];
  const status = String(subscription?.status || "");
  const active = ["active", "trialing"].includes(status);
  const periodEnd = subscription?.nextBilledAt || null;

  return {
    plan: active && mapped ? mapped.plan : "free",
    interval: active && mapped ? mapped.interval : null,
    status,
    periodEnd,
    priceId,
  };
}

async function findUserId(
  supabase: ReturnType<typeof admin>,
  customData: any,
  customerId?: string | null,
  transactionId?: string | null,
) {
  const userId = typeof customData?.user_id === "string" ? customData.user_id.trim() : "";
  if (userId) return userId;

  if (transactionId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("paddle_transaction_id", transactionId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (customerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("paddle_customer_id", customerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return "";
}

async function syncSubscription(subscription: any) {
  const supabase = admin();
  const transactionId = subscription?.transactionId || subscription?.transaction_id || null;
  const userId = await findUserId(supabase, subscription?.customData, subscription?.customerId, transactionId);
  if (!userId) {
    console.warn(
      "Paddle webhook: no se pudo identificar al usuario",
      subscription?.id,
      subscription?.customerId,
      transactionId,
    );
    return;
  }

  const fields = subscriptionFields(subscription);
  const { error } = await supabase.from("profiles").update({
    paddle_customer_id: subscription?.customerId || null,
    paddle_subscription_id: fields.status === "canceled" ? null : subscription?.id || null,
    subscription_plan: fields.plan,
    subscription_interval: fields.interval,
    subscription_status: fields.status || "canceled",
    subscription_current_period_end: fields.periodEnd,
  }).eq("id", userId);

  if (error) throw new Error(error.message);
}

async function syncTransaction(transaction: any) {
  const supabase = admin();
  const userId = await findUserId(supabase, transaction?.customData, transaction?.customerId, transaction?.id);
  if (!userId) {
    console.warn("Paddle webhook: no se pudo identificar la transacción", transaction?.id, transaction?.customerId);
    return;
  }

  const { error } = await supabase.from("profiles").update({
    paddle_customer_id: transaction?.customerId || null,
    paddle_transaction_id: transaction?.id || null,
  }).eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const paddle = getPaddle();
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = request.headers.get("paddle-signature") || "";
  const rawBody = await request.text();

  if (!paddle || !secret || !signature) {
    return NextResponse.json({ error: "Webhook de Paddle no configurado." }, { status: 500 });
  }

  try {
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);

    switch (event.eventType) {
      case "transaction.completed":
      case "transaction.paid":
        await syncTransaction(event.data);
        break;
      case "subscription.created":
      case "subscription.activated":
      case "subscription.updated":
      case "subscription.trialing":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.canceled":
        await syncSubscription(event.data);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paddle webhook error", error);
    return NextResponse.json({ error: "Webhook de Paddle inválido o no se pudo sincronizar." }, { status: 400 });
  }
}
