"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeExchangeCsv, type NormalizedMovement } from "@/lib/exchanges/csv";

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD"]);
type AnyRecord = Record<string, unknown>;
type Position = { quantity: number; priceEur: number | null };

function number(value: unknown) {
  let raw = String(value ?? "").trim().replace(/\s/g, "").replace(/[^0-9,().+\-]/g, "");
  if (!raw || raw === "-") return null;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()]/g, "");
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else raw = raw.replace(/,/g, ".");
  const result = Number(raw);
  if (!Number.isFinite(result)) return null;
  return negative ? -Math.abs(result) : result;
}

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function addPosition(positions: Map<string, Position>, assetId: string | null, amount: number | null, symbol: string, price: number | null, priceCurrency: string | null) {
  if (!assetId || amount === null || !Number.isFinite(amount)) return;
  const current = positions.get(assetId) || { quantity: 0, priceEur: null };
  current.quantity += amount;
  if (FIAT.has(symbol)) current.priceEur = 1;
  if (price !== null && String(priceCurrency || "").toUpperCase() === "EUR") current.priceEur = price;
  positions.set(assetId, current);
}

async function repairAccount(supabase: any, userId: string, accountId: string, exchangeCode: string) {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,occurred_at,raw_data")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los movimientos: ${error.message}`);

  const ids = [...new Set((rows || []).flatMap((row: AnyRecord) => [row.base_asset_id, row.quote_asset_id, row.fee_asset_id].filter(Boolean)))];
  const { data: assets, error: assetError } = ids.length
    ? await supabase.from("assets").select("id,symbol").in("id", ids)
    : { data: [], error: null };
  if (assetError) throw new Error(`No se pudieron resolver los activos: ${assetError.message}`);
  const assetById = new Map<string, string>((assets || []).map((asset: AnyRecord) => [String(asset.id), String(asset.symbol).toUpperCase()]));

  const positions = new Map<string, Position>();
  const ledgerBalances = new Map<string, { quantity: number; at: number; priceEur: number | null }>();

  for (const tx of rows || []) {
    const raw = (tx.raw_data && typeof tx.raw_data === "object" ? tx.raw_data : {}) as AnyRecord;
    const sourceRow = (raw.row && typeof raw.row === "object" ? raw.row : {}) as Record<string, string>;
    const sourceFile = String(raw.sourceFile || "");

    let movement: NormalizedMovement | null = null;
    try {
      if (Object.keys(sourceRow).length) movement = normalizeExchangeCsv(exchangeCode, [sourceRow], sourceFile)[0] || null;
    } catch {
      movement = null;
    }

    if (movement) {
      const update = {
        base_asset_id: movement.baseAsset ? (await resolveAssetId(supabase, movement.baseAsset, assetById)) : null,
        base_amount: movement.baseAmount,
        quote_asset_id: movement.quoteAsset ? (await resolveAssetId(supabase, movement.quoteAsset, assetById)) : null,
        quote_amount: movement.quoteAmount,
        fee_asset_id: movement.feeAsset ? (await resolveAssetId(supabase, movement.feeAsset, assetById)) : null,
        fee_amount: movement.feeAmount,
        price: movement.price,
        price_currency: movement.priceCurrency,
        transaction_type: movement.transactionType,
        occurred_at: movement.occurredAt || tx.occurred_at,
        raw_data: { ...raw, classification: movement.classification, parser: movement.raw.parser },
      };
      const { error: updateError } = await supabase.from("transactions").update(update).eq("id", tx.id).eq("user_id", userId);
      if (updateError) throw new Error(`No se pudo corregir un movimiento: ${updateError.message}`);

      if (exchangeCode === "kraken" && movement.raw.parser === "kraken-ledger") {
        const balance = number(sourceRow.balance);
        const assetId = update.base_asset_id;
        const timestamp = new Date(String(update.occurred_at || "")).getTime();
        const price = number(update.price);
        const priceEur = price !== null && String(update.price_currency || "").toUpperCase() === "EUR" ? price : null;
        if (balance !== null && assetId) {
          const previous = ledgerBalances.get(String(assetId));
          if (!previous || timestamp >= previous.at) ledgerBalances.set(String(assetId), { quantity: balance, at: Number.isFinite(timestamp) ? timestamp : 0, priceEur });
        }
        continue;
      }

      addPosition(positions, update.base_asset_id, movement.baseAmount, movement.baseAsset ? movement.baseAsset.toUpperCase() : "", movement.price, movement.priceCurrency);
      addPosition(positions, update.quote_asset_id, movement.quoteAmount, movement.quoteAsset ? movement.quoteAsset.toUpperCase() : "", null, null);
      addPosition(positions, update.fee_asset_id, movement.feeAmount, movement.feeAsset ? movement.feeAsset.toUpperCase() : "", null, null);
    } else {
      addPosition(positions, tx.base_asset_id ? String(tx.base_asset_id) : null, number(tx.base_amount), assetById.get(String(tx.base_asset_id)) || "", number(tx.price), tx.price_currency);
      addPosition(positions, tx.quote_asset_id ? String(tx.quote_asset_id) : null, number(tx.quote_amount), assetById.get(String(tx.quote_asset_id)) || "", null, null);
      addPosition(positions, tx.fee_asset_id ? String(tx.fee_asset_id) : null, number(tx.fee_amount), assetById.get(String(tx.fee_asset_id)) || "", null, null);
    }
  }

  for (const [assetId, balance] of ledgerBalances) {
    const symbol = assetById.get(assetId) || "";
    positions.set(assetId, { quantity: balance.quantity, priceEur: FIAT.has(symbol) ? 1 : balance.priceEur ?? positions.get(assetId)?.priceEur ?? null });
  }

  const { error: deleteError } = await supabase.from("balance_snapshots").delete().eq("user_id", userId).eq("account_id", accountId).eq("source", "calculated");
  if (deleteError) throw new Error(`No se pudo limpiar el saldo anterior: ${deleteError.message}`);
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
    if (insertError) throw new Error(`No se pudo guardar el saldo: ${insertError.message}`);
  }
  return snapshots.length;
}

async function resolveAssetId(supabase: any, symbol: string, cache: Map<string, string>) {
  const normalized = symbol.trim().toUpperCase();
  const cached = [...cache.entries()].find(([, value]) => value === normalized)?.[0];
  if (cached) return cached;
  const { data, error } = await supabase.from("assets").select("id,symbol").eq("symbol", normalized).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) { cache.set(String(data.id), normalized); return String(data.id); }
  return null;
}

export async function repairAllCsvBalances() {
  const { supabase, user } = await requireUser();
  const { data: connections, error: connectionError } = await supabase
    .from("exchange_connections")
    .select("id,exchange_id")
    .eq("user_id", user.id)
    .eq("provider_type", "csv")
    .eq("status", "active");
  if (connectionError) throw new Error(connectionError.message);
  const exchangeIds = [...new Set((connections || []).map((item: AnyRecord) => item.exchange_id).filter(Boolean))];
  const { data: exchanges, error: exchangeError } = exchangeIds.length
    ? await supabase.from("exchanges").select("id,code").in("id", exchangeIds)
    : { data: [], error: null };
  if (exchangeError) throw new Error(exchangeError.message);
  const codeById = new Map<string, string>((exchanges || []).map((item: AnyRecord) => [String(item.id), String(item.code).toLowerCase()]));
  let repaired = 0;
  for (const connection of connections || []) {
    const exchangeCode = codeById.get(String(connection.exchange_id));
    if (!exchangeCode) continue;
    const { data: accounts, error: accountError } = await supabase.from("accounts").select("id").eq("user_id", user.id).eq("connection_id", connection.id).eq("is_active", true);
    if (accountError) throw new Error(accountError.message);
    for (const account of accounts || []) { await repairAccount(supabase, user.id, String(account.id), exchangeCode); repaired += 1; }
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/exchanges");
  revalidatePath("/dashboard/movimientos");
  revalidatePath("/dashboard/renta");
  return repaired;
}
