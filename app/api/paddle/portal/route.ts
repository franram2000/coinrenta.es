import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function apiBaseUrl() {
  return "https://sandbox-api.paddle.com";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Paddle no está configurado todavía." }, { status: 503 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("paddle_customer_id,paddle_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profile?.paddle_customer_id) return NextResponse.json({ error: "No existe todavía una cuenta de Paddle para esta suscripción." }, { status: 404 });

  const response = await fetch(`${apiBaseUrl()}/customers/${encodeURIComponent(profile.paddle_customer_id)}/portal-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile.paddle_subscription_id ? { subscription_ids: [profile.paddle_subscription_id] } : {}),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json({ error: data?.error?.detail || data?.error?.message || "No se pudo abrir el portal de Paddle." }, { status: 502 });
  }

  const url = data?.data?.urls?.general?.overview;
  if (!url) return NextResponse.json({ error: "Paddle no devolvió una URL de portal válida." }, { status: 502 });
  return NextResponse.json({ url });
}
