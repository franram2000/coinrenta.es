import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  beginWebhookEvent,
  finishWebhookEvent,
  newerSubscriptionEventExists,
  syncSubscription,
  syncSubscriptionById,
  syncTransaction,
  PADDLE_PRICES,
} from "@/lib/paddle/billing";

export const runtime = "nodejs";

function getPaddle() {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;
  return new Paddle(key, { environment: process.env.PADDLE_ENVIRONMENT === "sandbox" ? Environment.sandbox : Environment.production });
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function subscriptionIdOf(data: any) {
  return text(data?.id, data?.subscriptionId, data?.subscription_id) || null;
}

function transactionIdOf(data: any) {
  return text(data?.id) || null;
}

function priceIdOfSubscription(data: any) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const item = items.find((entry: any) => entry?.recurring !== false) || items[0];
  return text(item?.price?.id, item?.priceId, item?.price_id) || null;
}

function isKnownPrice(priceId: string | null) {
  if (!priceId) return false;
  return Object.values(PADDLE_PRICES).some((prices) => Object.values(prices).includes(priceId));
}

function isSimulationEvent(eventId: string) {
  return eventId.startsWith("ntfsimevt_");
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

  let event: any;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
  } catch (error) {
    console.error("Paddle webhook signature error", error);
    return NextResponse.json({ error: "Firma de Paddle no válida." }, { status: 400 });
  }

  const eventType = text(event?.eventType, event?.event_type) || "unknown";
  const eventId = text(event?.eventId, event?.event_id)
    || `${eventType}:${text(event?.data?.id)}:${text(event?.occurredAt, event?.occurred_at)}`;
  const notificationId = text(event?.notificationId, event?.notification_id) || null;
  const occurredAt = text(event?.occurredAt, event?.occurred_at) || new Date().toISOString();
  const data = event?.data || {};
  const simulation = isSimulationEvent(eventId);

  try {
    const subscriptionId = subscriptionIdOf(data);
    const claim = await beginWebhookEvent({
      eventId,
      eventType,
      notificationId,
      subscription: eventType.startsWith("subscription.")
        ? subscriptionId
        : text(data?.subscriptionId, data?.subscription_id) || null,
      occurredAt,
    });

    if (claim.duplicate) {
      console.log("Paddle webhook: evento duplicado ignorado", { eventId, eventType });
      return NextResponse.json({ received: true, duplicate: true, eventId, eventType });
    }

    console.log("Paddle webhook: evento recibido", { eventId, eventType, occurredAt, simulation });

    if (eventType.startsWith("subscription.") && subscriptionId) {
      const newer = await newerSubscriptionEventExists(subscriptionId, occurredAt, eventId);
      if (newer) {
        await finishWebhookEvent(eventId, "ignored");
        console.log("Paddle webhook: evento antiguo ignorado", { eventId, eventType, subscriptionId, occurredAt });
        return NextResponse.json({ received: true, ignored: true, eventId, eventType });
      }
    }

    if (eventType.startsWith("subscription.")) {
      const priceId = priceIdOfSubscription(data);
      if (!isKnownPrice(priceId)) {
        if (simulation) {
          await finishWebhookEvent(eventId, "ignored", `Simulación demo ignorada: price_id ${priceId || "ausente"} no pertenece al catálogo de CoinRenta.`);
          console.warn("Paddle webhook: simulación demo ignorada por precio no reconocido", { eventId, eventType, priceId });
          return NextResponse.json({ received: true, ignored: true, reason: "demo_price_not_mapped", eventId, eventType });
        }
        throw new Error(`Precio de Paddle activo no reconocido: ${priceId || "sin price_id"}`);
      }
    }

    switch (eventType) {
      case "transaction.completed": {
        const result = await syncTransaction(data, `${eventType}:${eventId}`);
        if (result.subscriptionId) {
          await syncSubscriptionById(result.subscriptionId, `${eventType}:${eventId}`, result.userId);
        }
        break;
      }

      case "transaction.paid":
        await syncTransaction(data, `${eventType}:${eventId}`);
        break;

      case "subscription.created":
      case "subscription.activated":
      case "subscription.updated":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.canceled":
        await syncSubscription(data, `${eventType}:${eventId}`);
        break;

      default:
        console.log("Paddle webhook: evento no gestionado", { eventId, eventType });
        break;
    }

    await finishWebhookEvent(eventId, "processed");
    return NextResponse.json({ received: true, eventId, eventType });
  } catch (error) {
    console.error("Paddle webhook processing error", { eventId, eventType, error });
    try {
      await finishWebhookEvent(eventId, "failed", error instanceof Error ? error.message : String(error));
    } catch (statusError) {
      console.error("Paddle webhook: no se pudo registrar el fallo", statusError);
    }
    return NextResponse.json({ error: "Webhook recibido pero no se pudo procesar correctamente." }, { status: 500 });
  }
}
