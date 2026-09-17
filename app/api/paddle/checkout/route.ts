import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { createClient } from "@/lib/supabase/server";
import { getPaddlePriceId, type PaddlePlan, type PaddleInterval } from "@/lib/paddle/server";

export const runtime = "nodejs";

function getPaddle() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return null;
  return new Paddle(apiKey, { environment: Environment.sandbox });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const paddle = getPaddle();
  if (!paddle) return NextResponse.json({ error: "Paddle no está configurado todavía." }, { status: 503 });

  const body = await request.json().catch(() => null) as { plan?: string; interval?: string } | null;
  const plan = body?.plan as PaddlePlan;
  const interval = body?.interval as PaddleInterval;
  if (!(["essential", "pro"] as string[]).includes(plan) || !(["month", "year"] as string[]).includes(interval)) {
    return NextResponse.json({ error: "Plan o periodicidad no válidos." }, { status: 400 });
  }

  const priceId = getPaddlePriceId(plan, interval);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("paddle_customer_id,paddle_subscription_id,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (["active", "trialing", "past_due", "paused"].includes(String(profile?.subscription_status))) {
    return NextResponse.json({
      error: "Ya tienes una suscripción de Paddle. Usa 'Gestionar suscripción' para cambiar de plan o periodicidad.",
    }, { status: 409 });
  }

  try {
    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      collectionMode: "automatic",
      customData: {
        user_id: user.id,
        plan,
        interval,
      },
    });

    if (!transaction.id) throw new Error("Paddle no devolvió un transaction ID.");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ paddle_transaction_id: transaction.id })
      .eq("id", user.id);
    if (updateError) console.error("Paddle transaction sync error", updateError);

    return NextResponse.json({ transactionId: transaction.id });
  } catch (error) {
    console.error("Paddle checkout error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paddle no pudo crear el checkout." }, { status: 502 });
  }
}
