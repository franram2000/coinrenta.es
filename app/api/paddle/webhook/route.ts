import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  syncPaddleSubscription,
  syncPaddleSubscriptionById,
  syncPaddleTransaction,
} from "@/lib/paddle/server";

export const runtime = "nodejs";

function getPaddle() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return null;
  return new Paddle(apiKey, { environment: Environment.sandbox });
}

export async function POST(request: Request) {
  const paddle = getPaddle();
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = request.headers.get("paddle-signature") || "";
  const rawBody = await request.text();

  if (!paddle || !secret) {
    return NextResponse.json({ error: "Webhook de Paddle no está configurado." }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Falta la firma de Paddle." }, { status: 400 });
  }

  try {
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    const eventType = String(event.eventType || "");
    const eventId = String((event as any).eventId || "");

    console.log("Paddle webhook: evento recibido", {
      eventId,
      eventType,
      occurredAt: (event as any).occurredAt || null,
    });

    switch (eventType) {
      case "transaction.completed": {
        const result = await syncPaddleTransaction(event.data, eventType);
        const subscriptionId = result.subscriptionId;
        if (subscriptionId) {
          await syncPaddleSubscriptionById(subscriptionId, `${eventType}:${eventId}`);
        }
        break;
      }

      case "transaction.paid":
        await syncPaddleTransaction(event.data, eventType);
        break;

      case "subscription.created":
      case "subscription.activated":
      case "subscription.updated":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.canceled":
        await syncPaddleSubscription(event.data, `${eventType}:${eventId}`);
        break;

      default:
        console.log("Paddle webhook: evento ignorado", { eventId, eventType });
        break;
    }

    return NextResponse.json({ received: true, eventId, eventType });
  } catch (error) {
    console.error("Paddle webhook processing error", error);

    // Paddle retries non-2xx deliveries. Returning an error here is intentional:
    // an event that was received but could not be synchronized must not be lost.
    return NextResponse.json(
      { error: "Webhook recibido pero no se pudo procesar correctamente." },
      { status: 500 },
    );
  }
}
