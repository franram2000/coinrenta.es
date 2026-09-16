import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRICE_KEYS = {
  essential: { month: "NEXT_PUBLIC_PADDLE_PRICE_ESSENTIAL_MONTHLY", year: "NEXT_PUBLIC_PADDLE_PRICE_ESSENTIAL_YEARLY" },
  pro: { month: "NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY", year: "NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY" },
} as const;

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
  const plan = body?.plan as keyof typeof PRICE_KEYS;
  const interval = body?.interval as "month" | "year";
  if (!PRICE_KEYS[plan] || !["month", "year"].includes(interval)) {
    return NextResponse.json({ error: "Plan o periodicidad no válidos." }, { status: 400 });
  }

  const priceId = process.env[PRICE_KEYS[plan][interval]];
  if (!priceId) return NextResponse.json({ error: `Falta configurar el precio de Paddle para ${plan} ${interval}.` }, { status: 503 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("paddle_customer_id,paddle_subscription_id,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (["active", "trialing"].includes(String(profile?.subscription_status))) {
    return NextResponse.json({ error: "Ya tienes una suscripción activa. Gestiona el cambio desde tu suscripción actual." }, { status: 409 });
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
