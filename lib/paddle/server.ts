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
const PAID_STATUSES = new Set(["active", "past_due", "trialing"]);
const ACCESS_STATUSES = new Set(["active", "past_due", "trialing"]);

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role no está configurado.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function paddleApiKey() {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY no está configurada.");
  return key;
}

async function paddleGet<T>(path: string): Promise<T> {
  const response = await fetch(`${PADDLE_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${paddleApiKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail = body?.error?.detail || body?.error?.message || raw || `HTTP ${response.status}`;
    throw new Error(`Paddle API ${response.status}: ${detail}`);
  }

  return body as T;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function customDataOf(entity: any) {
  return entity?.customData ?? entity?.custom_data ?? null;
}

function customerIdOf(entity: any) {
  return firstString(entity?.customerId, entity?.customer_id);
}

function transactionIdOf(entity: any) {
  return firstString(entity?.transactionId, entity?.transaction_id);
}

function subscriptionIdOf(entity: any) {
  return firstString(entity?.subscriptionId, entity?.subscription_id);
}

function statusOf(entity: any) {
  return firstString(entity?.status);
}

function itemsOf(entity: any): any[] {
  return Array.isArray(entity?.items) ? entity.items : [];
}

function priceIdOf(item: any) {
  return firstString(item?.price?.id, item?.price_id, item?.priceId);
}

function priceIntervalOf(item: any): PaddleInterval | null {
  const interval = firstString(
    item?.price?.billingCycle?.interval,
    item?.price?.billing_cycle?.interval,
  );
  return interval === "month" || interval === "year" ? interval : null;
}

function mappedPlan(priceId: string | null, interval: PaddleInterval | null) {
  if (!priceId) return null;
  for (const plan of Object.keys(PADDLE_PRICES) as PaddlePlan[]) {
    for (const candidate of Object.keys(PADDLE_PRICES[plan]) as PaddleInterval[]) {
      if (PADDLE_PRICES[plan][candidate] === priceId) {
        return { plan, interval: candidate };
      }
    }
  }
  if (interval) {
    for (const plan of Object.keys(PADDLE_PRICES) as PaddlePlan[]) {
      if (PADDLE_PRICES[plan][interval] === priceId) return { plan, interval };
    }
  }
  return null;
}

function subscriptionFields(subscription: any) {
  const item =
    itemsOf(subscription).find((entry) => entry?.recurring !== false) ||
    itemsOf(subscription)[0] ||
    null;
  const priceId = item ? priceIdOf(item) : "";
  const intervalFromPrice = item ? priceIntervalOf(item) : null;
  const mapped = mappedPlan(priceId || null, intervalFromPrice);
  const status = statusOf(subscription);
  const active = ACCESS_STATUSES.has(status);

  const periodEnd = firstString(
    subscription?.currentBillingPeriod?.endsAt,
    subscription?.current_billing_period?.ends_at,
  ) || null;

  const customerId = customerIdOf(subscription) || null;
  const subscriptionId = firstString(subscription?.id) || null;
  const transactionId = transactionIdOf(subscription) || null;

  if (active && !mapped) {
    throw new Error(`Precio de Paddle activo no reconocido: ${priceId || "sin price_id"}`);
  }

  return {
    plan: active && mapped ? mapped.plan : "free",
    interval: active && mapped ? mapped.interval : null,
    status: status || "canceled",
    periodEnd,
    priceId: priceId || null,
    customerId,
    subscriptionId,
    transactionId,
  };
}

async function profileIdById(supabase: ReturnType<typeof serviceSupabase>, userId: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Supabase profile lookup failed: ${error.message}`);
  return data?.id || "";
}

async function profileIdByField(
  supabase: ReturnType<typeof serviceSupabase>,
  field: "paddle_customer_id" | "paddle_transaction_id",
  value: string,
) {
  const { data, error } = await supabase.from("profiles").select("id").eq(field, value).maybeSingle();
  if (error) throw new Error(`Supabase profile lookup failed: ${error.message}`);
  return data?.id || "";
}

async function profileIdByEmail(
  supabase: ReturnType<typeof serviceSupabase>,
  email: string,
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "";
  const { data, error } = await supabase.from("profiles").select("id").eq("email", normalized).maybeSingle();
  if (error) throw new Error(`Supabase email lookup failed: ${error.message}`);
  return data?.id || "";
}

async function getCustomer(customerId: string) {
  const response = await paddleGet<{ data?: any }>(`/customers/${encodeURIComponent(customerId)}`);
  return response.data || null;
}

async function getTransaction(transactionId: string) {
  const response = await paddleGet<{ data?: any }>(
    `/transactions/${encodeURIComponent(transactionId)}?include=customer`,
  );
  return response.data || null;
}

async function getSubscription(subscriptionId: string) {
  const response = await paddleGet<{ data?: any }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return response.data || null;
}

export async function resolvePaddleUser({
  customData,
  customerId,
  transactionId,
  email,
}: {
  customData?: any;
  customerId?: string | null;
  transactionId?: string | null;
  email?: string | null;
}) {
  const supabase = serviceSupabase();

  const directUserId = firstString(customData?.user_id);
  if (directUserId) {
    const verified = await profileIdById(supabase, directUserId);
    if (verified) return { userId: verified, via: "custom_data.user_id" };
  }

  if (transactionId) {
    const stored = await profileIdByField(supabase, "paddle_transaction_id", transactionId);
    if (stored) return { userId: stored, via: "paddle_transaction_id" };

    const transaction = await getTransaction(transactionId);
    const transactionCustomData = customDataOf(transaction);
    const transactionUserId = firstString(transactionCustomData?.user_id);
    if (transactionUserId) {
      const verified = await profileIdById(supabase, transactionUserId);
      if (verified) return { userId: verified, via: "transaction.custom_data.user_id" };
    }

    const transactionCustomerId = customerIdOf(transaction) || customerId || "";
    const transactionEmail = normalizeEmail(transaction?.customer?.email);

    if (transactionCustomerId) {
      const storedByCustomer = await profileIdByField(supabase, "paddle_customer_id", transactionCustomerId);
      if (storedByCustomer) return { userId: storedByCustomer, via: "paddle_customer_id" };
    }

    if (transactionEmail) {
      const storedByEmail = await profileIdByEmail(supabase, transactionEmail);
      if (storedByEmail) return { userId: storedByEmail, via: "email_from_transaction" };
    }
  }

  const normalizedCustomerId = customerId || "";
  if (normalizedCustomerId) {
    const storedByCustomer = await profileIdByField(supabase, "paddle_customer_id", normalizedCustomerId);
    if (storedByCustomer) return { userId: storedByCustomer, via: "paddle_customer_id" };

    const customer = await getCustomer(normalizedCustomerId);
    const customerEmail = normalizeEmail(customer?.email);
    if (customerEmail) {
      const storedByEmail = await profileIdByEmail(supabase, customerEmail);
      if (storedByEmail) return { userId: storedByEmail, via: "email_from_customer" };
    }
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const storedByEmail = await profileIdByEmail(supabase, normalizedEmail);
    if (storedByEmail) return { userId: storedByEmail, via: "email" };
  }

  return { userId: "", via: "unresolved" };
}

export async function syncPaddleSubscription(subscription: any, context: string) {
  const customData = customDataOf(subscription);
  const customerId = customerIdOf(subscription) || null;
  const transactionId = transactionIdOf(subscription) || null;
  const resolved = await resolvePaddleUser({ customData, customerId, transactionId });

  if (!resolved.userId) {
    throw new Error(
      `No se pudo resolver el usuario para ${context}: subscription=${subscription?.id || ""} customer=${customerId || ""} transaction=${transactionId || ""}`,
    );
  }

  const fields = subscriptionFields(subscription);
  const supabase = serviceSupabase();

  const { error } = await supabase
    .from("profiles")
    .update({
      paddle_customer_id: fields.customerId,
      paddle_subscription_id: fields.status === "canceled" ? null : fields.subscriptionId,
      paddle_transaction_id: fields.transactionId || undefined,
      subscription_plan: fields.plan,
      subscription_interval: fields.interval,
      subscription_status: fields.status,
      subscription_current_period_end: fields.periodEnd,
    })
    .eq("id", resolved.userId);

  if (error) throw new Error(`Supabase subscription sync failed: ${error.message}`);

  console.log("Paddle webhook: suscripción sincronizada", {
    context,
    userId: resolved.userId,
    resolvedVia: resolved.via,
    subscriptionId: fields.subscriptionId,
    customerId: fields.customerId,
    transactionId: fields.transactionId,
    priceId: fields.priceId,
    plan: fields.plan,
    interval: fields.interval,
    status: fields.status,
    periodEnd: fields.periodEnd,
  });

  return { userId: resolved.userId, ...fields };
}

export async function syncPaddleTransaction(transaction: any, context: string) {
  const customData = customDataOf(transaction);
  const customerId = customerIdOf(transaction) || null;
  const transactionId = firstString(transaction?.id) || null;
  const subscriptionId = subscriptionIdOf(transaction) || null;
  const transactionEmail = normalizeEmail(transaction?.customer?.email);

  const resolved = await resolvePaddleUser({
    customData,
    customerId,
    transactionId,
    email: transactionEmail,
  });

  if (!resolved.userId) {
    throw new Error(
      `No se pudo resolver el usuario para ${context}: transaction=${transactionId || ""} customer=${customerId || ""}`,
    );
  }

  const supabase = serviceSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      paddle_customer_id: customerId,
      paddle_transaction_id: transactionId,
    })
    .eq("id", resolved.userId);

  if (error) throw new Error(`Supabase transaction sync failed: ${error.message}`);

  console.log("Paddle webhook: transacción sincronizada", {
    context,
    userId: resolved.userId,
    resolvedVia: resolved.via,
    transactionId,
    customerId,
    subscriptionId,
    status: transaction?.status || null,
  });

  return { userId: resolved.userId, subscriptionId };
}

export async function reconcilePaddleSubscriptionForUser(userId: string, email: string | null) {
  const supabase = serviceSupabase();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("No hay email para reconciliar la suscripción de Paddle.");

  const customerQuery = new URLSearchParams({ email: normalizedEmail, per_page: "20" });
  const customerResponse = await paddleGet<{ data?: any[] }>(`/customers?${customerQuery.toString()}`);
  const customers = Array.isArray(customerResponse.data) ? customerResponse.data : [];

  if (!customers.length) {
    return { found: false, reason: "customer_not_found" as const };
  }

  const candidates: any[] = [];
  for (const customer of customers) {
    const customerId = firstString(customer?.id);
    if (!customerId) continue;
    const query = new URLSearchParams({ customer_id: customerId, per_page: "50", order_by: "id[DESC]" });
    const subscriptionResponse = await paddleGet<{ data?: any[] }>(`/subscriptions?${query.toString()}`);
    for (const subscription of Array.isArray(subscriptionResponse.data) ? subscriptionResponse.data : []) {
      candidates.push({ subscription, customerId });
    }
  }

  const rank = (status: string) => {
    if (status === "active" || status === "trialing") return 4;
    if (status === "past_due") return 3;
    if (status === "paused") return 2;
    if (status === "canceled") return 1;
    return 0;
  };

  candidates.sort((a, b) => {
    const rankDiff = rank(statusOf(b.subscription)) - rank(statusOf(a.subscription));
    if (rankDiff !== 0) return rankDiff;
    const aUpdated = new Date(firstString(a.subscription?.updated_at, a.subscription?.updatedAt)).getTime() || 0;
    const bUpdated = new Date(firstString(b.subscription?.updated_at, b.subscription?.updatedAt)).getTime() || 0;
    return bUpdated - aUpdated;
  });

  const selected = candidates[0]?.subscription || null;
  if (!selected) {
    const { error } = await supabase
      .from("profiles")
      .update({
        paddle_customer_id: firstString(customers[0]?.id) || null,
        paddle_subscription_id: null,
        subscription_plan: "free",
        subscription_interval: null,
        subscription_status: null,
        subscription_current_period_end: null,
      })
      .eq("id", userId);
    if (error) throw new Error(`Supabase reconciliation reset failed: ${error.message}`);
    return { found: true, subscription: null, plan: "free" as const };
  }

  const directCustomData = customDataOf(selected);
  const selectedCustomerId = customerIdOf(selected) || firstString(customers[0]?.id) || null;
  const selectedTransactionId = transactionIdOf(selected) || null;
  const resolved = await resolvePaddleUser({
    customData: { ...(directCustomData || {}), user_id: userId },
    customerId: selectedCustomerId,
    transactionId: selectedTransactionId,
    email: normalizedEmail,
  });

  if (!resolved.userId) throw new Error("Paddle reconciliación: no se pudo verificar el usuario.");
  if (resolved.userId !== userId) throw new Error("Paddle reconciliación: la suscripción pertenece a otro usuario.");

  const fields = subscriptionFields(selected);
  const update = await supabase
    .from("profiles")
    .update({
      paddle_customer_id: fields.customerId || selectedCustomerId,
      paddle_subscription_id: fields.status === "canceled" ? null : fields.subscriptionId,
      paddle_transaction_id: fields.transactionId || undefined,
      subscription_plan: fields.plan,
      subscription_interval: fields.interval,
      subscription_status: fields.status,
      subscription_current_period_end: fields.periodEnd,
    })
    .eq("id", userId);

  if (update.error) throw new Error(`Supabase reconciliation failed: ${update.error.message}`);

  console.log("Paddle reconciliation: suscripción sincronizada", {
    userId,
    subscriptionId: fields.subscriptionId,
    customerId: fields.customerId || selectedCustomerId,
    priceId: fields.priceId,
    plan: fields.plan,
    interval: fields.interval,
    status: fields.status,
    periodEnd: fields.periodEnd,
  });

  return { found: true, subscription: fields.subscriptionId, plan: fields.plan, status: fields.status };
}

export async function syncPaddleSubscriptionById(subscriptionId: string, context: string) {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) throw new Error(`Paddle no devolvió la suscripción ${subscriptionId}.`);
  return syncPaddleSubscription(subscription, context);
}

export function getPaddlePriceId(plan: PaddlePlan, interval: PaddleInterval) {
  return PADDLE_PRICES[plan][interval];
}
