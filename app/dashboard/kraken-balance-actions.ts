"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FIAT = new Set(["EUR","USD","GBP","CHF","PLN","SEK","DKK","NOK","AUD","CAD","JPY","SGD"]);

type AnyRecord = Record<string, unknown>;
type Position = { quantity: number; priceEur: number | null };

function parseNumber(value: unknown) {
  let raw = String(value ?? "").trim().replace(/\s/g, "").replace(/[^0-9,().+\-]/g, "");
  if (!raw || raw === "-") return null;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()]/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else {
    raw = raw.replace(/,/g, ".");
  }
  const result = Number(raw);
  if (!Number.isFinite(result)) return null;
  return negative ? -Math.abs(result) : result;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function rebuildKrakenAccountBalance(supabase: any, userId: string, accountId: string) {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,occurred_at,raw_data")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(`No se pudo recalcular el saldo de Kraken: ${error.message}`);

  const ids = [...new Set((rows || []).flatMap((row: AnyRecord) => [row.base_asset_id, row.quote_asset_id, row.fee_asset_id].filter(Boolean)))];
  const { data: assets, error: assetError } = ids.length
    ? await supabase.from("assets").select("id,symbol").in("id", ids)
    : { data: [], error: null };
  if (assetError) throw new Error(`No se pudieron resolver los activos de Kraken: ${assetError.message}`);

  const assetById = new Map<string, string>((assets || []).map((asset: AnyRecord) => [String(asset.id), String(asset.symbol).toUpperCase()]));
  const symbols = new Set<string>();
  for (const row of rows || []) {
    const raw = (row.raw_data && typeof row.raw_data === "object" ? row.raw_data : {}) as AnyRecord;
    const sourceRow = (raw.row && typeof raw.row === "object" ? raw.row : {}) as AnyRecord;
    if (raw.parser === "kraken-ledger") {
      const symbol = String(sourceRow.asset ?? assetById.get(String(row.base_asset_id)) ?? "").trim().toUpperCase();
      if (symbol) symbols.add(symbol);
    }
  }

  if (symbols.size) {
    const { data: matchingAssets, error: symbolError } = await supabase.from("assets").select("id,symbol").in("symbol", [...symbols]);
    if (symbolError) throw new Error(`No se pudieron resolver los saldos de Kraken: ${symbolError.message}`);
    for (const asset of matchingAssets || []) assetById.set(String(asset.id), String(asset.symbol).toUpperCase());
  }

  const positions = new Map<string, Position>();
  const ledgerBalances = new Map<string, { quantity: number; at: number; priceEur: number | null }>();

  const add = (assetId: unknown, amount: unknown, price: unknown, currency: unknown) => {
    if (!assetId) return;
    const numeric = parseNumber(amount);
    if (numeric === null) return;
    const id = String(assetId);
    const symbol = assetById.get(id) || "";
    const current = positions.get(id) || { quantity: 0, priceEur: null };
    current.quantity += numeric;
    if (FIAT.has(symbol)) current.priceEur = 1;
    const p = parseNumber(price);
    if (p !== null && String(currency ?? "").toUpperCase() === "EUR") current.priceEur = p;
    positions.set(id, current);
  };

  for (const tx of rows || []) {
    const raw = (tx.raw_data && typeof tx.raw_data === "object" ? tx.raw_data : {}) as AnyRecord;
    const sourceRow = (raw.row && typeof raw.row === "object" ? raw.row : {}) as AnyRecord;
    const timestamp = new Date(String(tx.occurred_at || "")).getTime();
    const timestampValue = Number.isFinite(timestamp) ? timestamp : 0;

    if (raw.parser === "kraken-ledger") {
      const symbol = String(sourceRow.asset ?? assetById.get(String(tx.base_asset_id)) ?? "").trim().toUpperCase();
      const balance = parseNumber(sourceRow.balance);
      if (symbol && balance !== null && tx.base_asset_id) {
        const previous = ledgerBalances.get(String(tx.base_asset_id));
        const price = parseNumber(tx.price);
        const priceEur = price !== null && String(tx.price_currency ?? "").toUpperCase() === "EUR" ? price : null;
        if (!previous || timestampValue >= previous.at) {
          ledgerBalances.set(String(tx.base_asset_id), { quantity: balance, at: timestampValue, priceEur });
        }
      }
      continue;
    }

    add(tx.base_asset_id, tx.base_amount, tx.price, tx.price_currency);
    add(tx.quote_asset_id, tx.quote_amount, null, null);
    add(tx.fee_asset_id, tx.fee_amount, null, null);
  }

  for (const [assetId, balance] of ledgerBalances) {
    const symbol = assetById.get(assetId) || "";
    positions.set(assetId, {
      quantity: balance.quantity,
      priceEur: FIAT.has(symbol) ? 1 : balance.priceEur ?? positions.get(assetId)?.priceEur ?? null,
    });
  }

  const { error: deleteError } = await supabase
    .from("balance_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("source", "calculated");
  if (deleteError) throw new Error(`No se pudo limpiar el saldo anterior de Kraken: ${deleteError.message}`);

  const capturedAt = new Date().toISOString();
  const snapshots = [...positions.entries()]
    .filter(([, position]) => Math.abs(position.quantity) > 1e-12)
    .map(([assetId, position]) => ({
      user_id: userId,
      account_id: accountId,
      asset_id: assetId,
      captured_at: capturedAt,
      quantity: position.quantity,
      price_eur: position.priceEur,
      value_eur: position.priceEur === null ? null : position.quantity * position.priceEur,
      source: "calculated",
    }));

  if (snapshots.length) {
    const { error: insertError } = await supabase.from("balance_snapshots").insert(snapshots);
    if (insertError) throw new Error(`No se pudo guardar el saldo corregido de Kraken: ${insertError.message}`);
  }
  return snapshots.length;
}

export async function repairKrakenBalances() {
  const { supabase, user } = await requireUser();
  const { data: connections, error: connectionError } = await supabase
    .from("exchange_connections")
    .select("id,exchange_id")
    .eq("user_id", user.id)
    .eq("provider_type", "csv")
    .eq("status", "active");
  if (connectionError) throw new Error(`No se pudieron cargar las conexiones: ${connectionError.message}`);

  const exchangeIds = [...new Set((connections || []).map((item: AnyRecord) => item.exchange_id).filter(Boolean))];
  const { data: exchanges, error: exchangeError } = exchangeIds.length
    ? await supabase.from("exchanges").select("id,code").in("id", exchangeIds)
    : { data: [], error: null };
  if (exchangeError) throw new Error(`No se pudieron cargar los exchanges: ${exchangeError.message}`);

  const krakenIds = new Set((exchanges || []).filter((item: AnyRecord) => String(item.code).toLowerCase() === "kraken").map((item: AnyRecord) => String(item.id)));
  const connectionIds = (connections || []).filter((item: AnyRecord) => krakenIds.has(String(item.exchange_id))).map((item: AnyRecord) => String(item.id));
  if (!connectionIds.length) return 0;

  const { data: accounts, error: accountError } = await supabase.from("accounts").select("id,connection_id").in("connection_id", connectionIds).eq("user_id", user.id).eq("is_active", true);
  if (accountError) throw new Error(`No se pudieron cargar las cuentas de Kraken: ${accountError.message}`);

  let repaired = 0;
  for (const account of accounts || []) {
    await rebuildKrakenAccountBalance(supabase, user.id, String(account.id));
    repaired += 1;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  revalidatePath("/dashboard/movimientos");
  revalidatePath("/dashboard/fiscalidad");
  return repaired;
}

export async function importKrakenCsvConnection(formData: FormData, originalAction: (formData: FormData) => Promise<any>) {
  const result = await originalAction(formData);
  if (result?.connectionId) await repairKrakenBalances();
  return result;
}

export async function refreshWithKrakenBalances(originalAction: () => Promise<void>) {
  await originalAction();
  const repaired = await repairKrakenBalances();
  return repaired;
}
