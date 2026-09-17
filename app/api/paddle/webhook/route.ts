import { NextResponse } from "next/server";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  beginWebhookEvent,
  finishWebhookEvent,
  newerSubscriptionEventExists,
  syncSubscription,
  syncSubscriptionById,
  syncTransaction,
} from "@/lib/paddle/billing";

export const runtime = "nodejs";

function getPaddle() {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;
  return new Paddle(key, { environment: Environment.sandbox });
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function subscriptionIdOf(data: any) { return text(data?.id, data?.subscriptionId, data?.subscription_id) || null; }
function transactionIdOf(data: any) { return text(data?.id) || null; }

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

  try {
    const subscriptionId = subscriptionIdOf(data);
    const claim = await beginWebhookEvent({
      eventId,
      eventType,
      notificationId,
      subscription: eventType.startsWith("subscription.") ? subscriptionId : text(data?.subscriptionId, data?.subscription_id) || null,
      occurredAt,
    });

    if (claim.duplicate) {
      console.log("Paddle webhook: evento duplicado ignorado", { eventId, eventType });
      return NextResponse.json({ received: true, duplicate: true, eventId, eventType });
    }

    console.log("Paddle webhook: evento recibido", { eventId, eventType, occurredAt });

    if (eventType.startsWith("subscription.") && subscriptionId) {
      const newer = await newerSubscriptionEventExists(subscriptionId, occurredAt, eventId);
      if (newer) {
        await finishWebhookEvent(eventId, "ignored");
        console.log("Paddle webhook: evento antiguo ignorado", { eventId, eventType, subscriptionId, occurredAt });
        return NextResponse.json({ received: true, ignored: true, eventId, eventType });
      }
    }

    switch (eventType) {
      case "transaction.completed": {
        const result = await syncTransaction(data, `${eventType}:${eventId}`);
        const txSubscriptionId = result.subscriptionId;
        if (txSubscriptionId) {
          await syncSubscriptionById(txSubscriptionId, `${eventType}:${eventId}`, result.userId);
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
