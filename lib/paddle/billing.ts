import { createClient } from "@supabase/supabase-js";

export type PaddlePlan = "essential" | "pro";
export type PaddleInterval = "month" | "year";

export const PADDLE_PRICES: Record<PaddlePlan, Record<PaddleInterval, string>> = {
  essential: {
    month: "pri_01m2nag708jv99wfyg5tas9nj7",
    year: "pri_01m2nak77d41b73gg7edjc6wt5",
  },
  pro: {
    month: "pri_01m2nan6ame0k307m9fy2d18n6",
    year: "pri_01m2napvxh7jx0qgwsp4myrz08",
  },
};

const PADDLE_API_BASE = "https://sandbox-api.paddle.com";
const ACCESS_STATUSES = new Set(["active", "past_due", "trialing"]);

type SupabaseAdmin = ReturnType<typeof createAdmin>;

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role no está configurado.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function paddleKey() {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY no está configurada.");
  return key;
}

async function paddleGet<T>(path: string): Promise<T> {
  const response = await fetch(`${PADDLE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${paddleKey()}`, Accept: "application/json" },
    cache: "no-store",
  });
  const raw = await response.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!response.ok) {
    throw new Error(`Paddle API ${response.status}: ${body?.error?.detail || body?.error?.message || raw || "sin detalle"}`);
  }
  return body as T;
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function email(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function customData(entity: any) { return entity?.customData ?? entity?.custom_data ?? null; }
function customerId(entity: any) { return text(entity?.customerId, entity?.customer_id); }
function transactionId(entity: any) { return text(entity?.transactionId, entity?.transaction_id); }
function subscriptionId(entity: any) { return text(entity?.subscriptionId, entity?.subscription_id); }
function status(entity: any) { return text(entity?.status); }
function priceId(item: any) { return text(item?.price?.id, item?.priceId, item?.price_id); }
function priceInterval(item: any): PaddleInterval | null {
  const value = text(item?.price?.billingCycle?.interval, item?.price?.billing_cycle?.interval, item?.billingCycle?.interval, item?.billing_cycle?.interval);
  return value === "month" || value === "year" ? value : null;
}

function planFromPrice(id: string) {
  for (const plan of Object.keys(PADDLE_PRICES) as PaddlePlan[]) {
    for (const interval of Object.keys(PADDLE_PRICES[plan]) as PaddleInterval[]) {
      if (PADDLE_PRICES[plan][interval] === id) return { plan, interval };
    }
  }
  return null;
}

function subscriptionState(subscription: any) {
  const items = Array.isArray(subscription?.items) ? subscription.items : [];
  const item = items.find((entry: any) => entry?.recurring !== false) || items[0] || null;
  const id = item ? priceId(item) : "";
  const mapped = planFromPrice(id);
  const currentStatus = status(subscription);
  const interval = mapped?.interval || priceInterval(item);
  const periodEnd = text(subscription?.currentBillingPeriod?.endsAt, subscription?.current_billing_period?.ends_at) || null;
  return {
    plan: ACCESS_STATUSES.has(currentStatus) && mapped ? mapped.plan : null,
    interval: ACCESS_STATUSES.has(currentStatus) && mapped ? interval : null,
    status: currentStatus || "canceled",
    periodEnd,
    priceId: id || null,
    customerId: customerId(subscription) || null,
    subscriptionId: text(subscription?.id) || null,
    transactionId: transactionId(subscription) || null,
    priceRecognized: Boolean(mapped),
  };
}

async function profileById(db: SupabaseAdmin, id: string) {
  const { data, error } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase profile lookup failed: ${error.message}`);
  return data?.id || "";
}

async function profileBy(db: SupabaseAdmin, field: "paddle_customer_id" | "paddle_transaction_id", value: string) {
  const { data, error } = await db.from("profiles").select("id").eq(field, value).maybeSingle();
  if (error) throw new Error(`Supabase profile lookup failed: ${error.message}`);
  return data?.id || "";
}

async function profileByEmail(db: SupabaseAdmin, value: string) {
  const normalized = email(value);
  if (!normalized) return "";
  const { data, error } = await db.from("profiles").select("id").ilike("email", normalized).maybeSingle();
  if (error) throw new Error(`Supabase email lookup failed: ${error.message}`);
  return data?.id || "";
}

async function getTransaction(id: string) {
  const response = await paddleGet<{ data?: any }>(`/transactions/${encodeURIComponent(id)}?include=customer`);
  return response.data || null;
}

async function getCustomer(id: string) {
  const response = await paddleGet<{ data?: any }>(`/customers/${encodeURIComponent(id)}`);
  return response.data || null;
}

export async function resolveUser({
  custom,
  customer,
  transaction,
  customerEmail,
}: {
  custom?: any;
  customer?: string | null;
  transaction?: string | null;
  customerEmail?: string | null;
}) {
  const db = createAdmin();
  const directUser = text(custom?.user_id);
  if (directUser) {
    const verified = await profileById(db, directUser);
    if (verified) return { userId: verified, via: "custom_data.user_id" };
  }

  if (transaction) {
    const stored = await profileBy(db, "paddle_transaction_id", transaction);
    if (stored) return { userId: stored, via: "paddle_transaction_id" };

    const tx = await getTransaction(transaction);
    const txUser = text(customData(tx)?.user_id);
    if (txUser) {
      const verified = await profileById(db, txUser);
      if (verified) return { userId: verified, via: "transaction.custom_data.user_id" };
    }

    const txCustomer = customerId(tx) || customer || "";
    if (txCustomer) {
      const byCustomer = await profileBy(db, "paddle_customer_id", txCustomer);
      if (byCustomer) return { userId: byCustomer, via: "paddle_customer_id" };
    }

    const txEmail = email(tx?.customer?.email);
    if (txEmail) {
      const byEmail = await profileByEmail(db, txEmail);
      if (byEmail) return { userId: byEmail, via: "transaction.customer.email" };
    }
  }

  if (customer) {
    const stored = await profileBy(db, "paddle_customer_id", customer);
    if (stored) return { userId: stored, via: "paddle_customer_id" };

    try {
      const customerEntity = await getCustomer(customer);
      const customerEmailValue = email(customerEntity?.email);
      if (customerEmailValue) {
        const byEmail = await profileByEmail(db, customerEmailValue);
        if (byEmail) return { userId: byEmail, via: "customer.email" };
      }
    } catch (error) {
      console.warn("Paddle: customer lookup no disponible", { customer, error });
    }
  }

  if (customerEmail) {
    const byEmail = await profileByEmail(db, customerEmail);
    if (byEmail) return { userId: byEmail, via: "email" };
  }

  return { userId: "", via: "unresolved" };
}

export async function syncTransaction(transaction: any, context: string) {
  const id = text(transaction?.id);
  if (!id) throw new Error(`Transacción sin id en ${context}.`);
  const customer = customerId(transaction) || null;
  const subscription = subscriptionId(transaction) || null;
  const resolved = await resolveUser({
    custom: customData(transaction),
    customer,
    transaction: id,
    customerEmail: email(transaction?.customer?.email),
  });
  if (!resolved.userId) throw new Error(`No se pudo resolver el usuario para ${context}: transaction=${id} customer=${customer || ""}`);

  const db = createAdmin();
  const { error } = await db.from("profiles").update({
    paddle_customer_id: customer,
    paddle_transaction_id: id,
  }).eq("id", resolved.userId);
  if (error) throw new Error(`Supabase transaction sync failed: ${error.message}`);

  console.log("Paddle: transacción sincronizada", { context, userId: resolved.userId, via: resolved.via, transactionId: id, customerId: customer, subscriptionId: subscription });
  return { userId: resolved.userId, subscriptionId: subscription };
}

export async function syncSubscription(subscription: any, context: string, forcedUserId?: string) {
  const state = subscriptionState(subscription);
  if (!state.priceRecognized) {
    throw new Error(`Precio de Paddle activo no reconocido: ${state.priceId || "sin price_id"}`);
  }

  const resolved = forcedUserId
    ? { userId: await profileById(createAdmin(), forcedUserId), via: "reconciliation" }
    : await resolveUser({ custom: customData(subscription), customer: state.customerId, transaction: state.transactionId });
  if (!resolved.userId) throw new Error(`No se pudo resolver el usuario para ${context}: subscription=${state.subscriptionId || ""} customer=${state.customerId || ""}`);

  const db = createAdmin();
  const update: Record<string, any> = {
    paddle_customer_id: state.customerId,
    paddle_subscription_id: state.status === "canceled" ? null : state.subscriptionId,
    subscription_plan: state.plan || "free",
    subscription_interval: state.interval,
    subscription_status: state.status,
    subscription_current_period_end: state.periodEnd,
  };
  if (state.transactionId) update.paddle_transaction_id = state.transactionId;

  const { error } = await db.from("profiles").update(update).eq("id", resolved.userId);
  if (error) throw new Error(`Supabase subscription sync failed: ${error.message}`);

  console.log("Paddle: suscripción sincronizada", {
    context,
    userId: resolved.userId,
    via: resolved.via,
    subscriptionId: state.subscriptionId,
    customerId: state.customerId,
    transactionId: state.transactionId,
    priceId: state.priceId,
    plan: state.plan,
    interval: state.interval,
    status: state.status,
    periodEnd: state.periodEnd,
  });
  return { userId: resolved.userId, ...state };
}

export async function syncSubscriptionById(id: string, context: string, forcedUserId?: string) {
  const response = await paddleGet<{ data?: any }>(`/subscriptions/${encodeURIComponent(id)}`);
  if (!response.data) throw new Error(`Paddle no devolvió la suscripción ${id}.`);
  return syncSubscription(response.data, context, forcedUserId);
}

export async function reconcileSubscription(userId: string, userEmail: string | null) {
  const normalized = email(userEmail);
  if (!normalized) throw new Error("No hay email de usuario para reconciliar Paddle.");

  const db = createAdmin();
  const customerQuery = new URLSearchParams({ email: normalized, per_page: "20" });
  const customersResponse = await paddleGet<{ data?: any[] }>(`/customers?${customerQuery.toString()}`);
  const customers = Array.isArray(customersResponse.data) ? customersResponse.data : [];
  if (!customers.length) return { found: false as const, reason: "customer_not_found" };

  const candidates: any[] = [];
  for (const c of customers) {
    const cid = text(c?.id);
    if (!cid) continue;
    const query = new URLSearchParams({ customer_id: cid, per_page: "200", order_by: "id[DESC]" });
    const subscriptionsResponse = await paddleGet<{ data?: any[] }>(`/subscriptions?${query.toString()}`);
    for (const sub of Array.isArray(subscriptionsResponse.data) ? subscriptionsResponse.data : []) candidates.push({ sub, cid });
  }

  const priority = (value: string) => ({ active: 5, trialing: 4, past_due: 3, paused: 2, canceled: 1 } as Record<string, number>)[value] || 0;
  candidates.sort((a, b) => {
    const p = priority(status(b.sub)) - priority(status(a.sub));
    if (p) return p;
    const at = new Date(text(a.sub?.updated_at, a.sub?.updatedAt)).getTime() || 0;
    const bt = new Date(text(b.sub?.updated_at, b.sub?.updatedAt)).getTime() || 0;
    return bt - at;
  });

  if (!candidates.length) {
    const { error } = await db.from("profiles").update({
      paddle_customer_id: text(customers[0]?.id) || null,
      paddle_subscription_id: null,
      subscription_plan: "free",
      subscription_interval: null,
      subscription_status: null,
      subscription_current_period_end: null,
    }).eq("id", userId);
    if (error) throw new Error(`Supabase reconciliation reset failed: ${error.message}`);
    return { found: true as const, subscription: null, plan: "free" as const };
  }

  const selected = candidates[0].sub;
  const state = subscriptionState(selected);
  if (!state.priceRecognized) {
    throw new Error(`Suscripción de Paddle no pertenece al catálogo CoinRenta: ${state.priceId || "sin price_id"}`);
  }
  await syncSubscription(selected, "account_reconciliation", userId);
  return { found: true as const, subscription: state.subscriptionId, plan: state.plan, status: state.status, priceId: state.priceId };
}

export async function beginWebhookEvent({ eventId, eventType, notificationId, subscription, occurredAt }: {
  eventId: string;
  eventType: string;
  notificationId?: string | null;
  subscription?: string | null;
  occurredAt: string;
}) {
  const db = createAdmin();
  const insert = await db.from("paddle_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    notification_id: notificationId || null,
    subscription_id: subscription || null,
    occurred_at: occurredAt,
    status: "processing",
  });

  if (!insert.error) return { duplicate: false };
  if (insert.error.code !== "23505") throw new Error(`Webhook event insert failed: ${insert.error.message}`);

  const { data, error } = await db.from("paddle_webhook_events").select("status").eq("event_id", eventId).maybeSingle();
  if (error) throw new Error(`Webhook event lookup failed: ${error.message}`);
  return { duplicate: data?.status === "processed" || data?.status === "ignored" };
}

export async function newerSubscriptionEventExists(subscription: string, occurredAt: string, eventId: string) {
  const db = createAdmin();
  const { data, error } = await db.from("paddle_webhook_events")
    .select("event_id")
    .eq("subscription_id", subscription)
    .neq("event_id", eventId)
    .gt("occurred_at", occurredAt)
    .limit(1);
  if (error) throw new Error(`Webhook order lookup failed: ${error.message}`);
  return Boolean(data?.length);
}

export async function finishWebhookEvent(eventId: string, statusValue: "processed" | "failed" | "ignored", errorMessage?: string) {
  const db = createAdmin();
  const { error } = await db.from("paddle_webhook_events").update({
    status: statusValue,
    processed_at: statusValue === "processed" || statusValue === "ignored" ? new Date().toISOString() : null,
    error_message: errorMessage || null,
  }).eq("event_id", eventId);
  if (error) throw new Error(`Webhook event finalize failed: ${error.message}`);
}

export function paddlePriceId(plan: PaddlePlan, interval: PaddleInterval) { return PADDLE_PRICES[plan][interval]; }
