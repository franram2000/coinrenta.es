"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeExchangeCsv, type NormalizedMovement } from "@/lib/exchanges/csv";

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "DKK", "NOK", "AUD", "CAD", "JPY", "SGD"]);
type AnyRecord = Record<string, unknown>;
type Position = { quantity: number; priceEur: number | null };
type Reported = { quantity: number; at: number; sequence: number; priceEur: number | null };

function number(value: unknown) {
  let raw = String(value ?? "").trim().replace(/\s/g, "").replace(/[^0-9,().+\-]/g, "");
  if (!raw || raw === "-") return null;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()]/g, "");
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (raw.includes(",")) {
    const decimals = raw.length - raw.lastIndexOf(",") - 1;
    raw = decimals === 3 && raw.indexOf(",") > 0 ? raw.replace(/,/g, "") : raw.replace(",", ".");
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

function addPosition(positions: Map<string, Position>, assetId: string | null, amount: number | null, symbol: string, price: number | null, priceCurrency: string | null) {
  if (!assetId || amount === null || !Number.isFinite(amount)) return;
  const current = positions.get(assetId) || { quantity: 0, priceEur: null };
  current.quantity += amount;
  if (FIAT.has(symbol)) current.priceEur = 1;
  if (price !== null && String(priceCurrency || "").toUpperCase() === "EUR") current.priceEur = price;
  positions.set(assetId, current);
}

function rawValue(row: Record<string, string>, names: string[]) {
  const map = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(value ?? "").trim()]));
  for (const name of names) {
    const value = map.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function reportedBalance(exchange: string, row: Record<string, string>, movement: NormalizedMovement, sequence: number) {
  const direct = number(row["__coinrenta_reported_balance"]);
  const directAsset = String(row["__coinrenta_reported_balance_asset"] || movement.baseAsset || "").toUpperCase();
  if (direct !== null && directAsset) return { asset: directAsset, quantity: direct, sequence };

  const code = exchange.toLowerCase();
  const asset = String(rawValue(row, ["asset", "coin", "currency", "balanceunit", "feeunit", "baseasset"]) || movement.baseAsset || "").toUpperCase();
  if (!asset) return null;

  let value: number | null = null;
  if (code === "kraken") value = number(rawValue(row, ["balance"]));
  else if (code === "bybit") value = number(rawValue(row, ["cashbalance", "walletbalance", "balance"]));
  else if (code === "okx") value = number(rawValue(row, ["balance", "positionbalance", "walletbalance"]));
  else if (code === "binance") {
    const free = number(rawValue(row, ["free"]));
    const locked = number(rawValue(row, ["locked"]));
    value = free !== null || locked !== null ? (free || 0) + (locked || 0) : number(rawValue(row, ["balance"]));
  } else {
    value = number(rawValue(row, ["balance", "walletbalance", "availablebalance"]));
  }
  return value === null ? null : { asset, quantity: value, sequence };
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

async function repairAccount(supabase: any, userId: string, accountId: string, exchangeCode: string) {
  const { data: rows, error } = await supabase.from("transactions").select("id,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,occurred_at,raw_data").eq("user_id", userId).eq("account_id", accountId).order("occurred_at", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los movimientos: ${error.message}`);

  const ids = [...new Set((rows || []).flatMap((row: AnyRecord) => [row.base_asset_id, row.quote_asset_id, row.fee_asset_id].filter(Boolean)))];
  const { data: assets, error: assetError } = ids.length ? await supabase.from("assets").select("id,symbol").in("id", ids) : { data: [], error: null };
  if (assetError) throw new Error(`No se pudieron resolver los activos: ${assetError.message}`);
  const assetById = new Map<string, string>((assets || []).map((asset: AnyRecord) => [String(asset.id), String(asset.symbol).toUpperCase()]));

  const positions = new Map<string, Position>();
  const reported = new Map<string, Reported>();
  const parsedRows: { sequence: number; at: number; movement: NormalizedMovement; ids: { base: string | null; quote: string | null; fee: string | null }; raw: AnyRecord }[] = [];

  for (let sequence = 0; sequence < (rows || []).length; sequence += 1) {
    const tx = rows[sequence] as AnyRecord;
    const raw = (tx.raw_data && typeof tx.raw_data === "object" ? tx.raw_data : {}) as AnyRecord;
    const sourceRow = (raw.row && typeof raw.row === "object" ? raw.row : {}) as Record<string, string>;
    const sourceFile = String(raw.sourceFile || "");
    let movement: NormalizedMovement | null = null;
    try { if (Object.keys(sourceRow).length) movement = normalizeExchangeCsv(exchangeCode, [sourceRow], sourceFile)[0] || null; } catch { movement = null; }

    let idsForRow = { base: tx.base_asset_id ? String(tx.base_asset_id) : null, quote: tx.quote_asset_id ? String(tx.quote_asset_id) : null, fee: tx.fee_asset_id ? String(tx.fee_asset_id) : null };
    if (movement) {
      idsForRow = {
        base: movement.baseAsset ? await resolveAssetId(supabase, movement.baseAsset, assetById) : null,
        quote: movement.quoteAsset ? await resolveAssetId(supabase, movement.quoteAsset, assetById) : null,
        fee: movement.feeAsset ? await resolveAssetId(supabase, movement.feeAsset, assetById) : null,
      };
      const update = {
        base_asset_id: idsForRow.base,
        base_amount: movement.baseAmount,
        quote_asset_id: idsForRow.quote,
        quote_amount: movement.quoteAmount,
        fee_asset_id: idsForRow.fee,
        fee_amount: movement.feeAmount,
        price: movement.price,
        price_currency: movement.priceCurrency,
        transaction_type: movement.transactionType,
        occurred_at: movement.occurredAt || tx.occurred_at,
        raw_data: { ...raw, classification: movement.classification, parser: movement.raw.parser },
      };
      const { error: updateError } = await supabase.from("transactions").update(update).eq("id", tx.id).eq("user_id", userId);
      if (updateError) throw new Error(`No se pudo corregir un movimiento: ${updateError.message}`);
      const at = new Date(String(update.occurred_at || "")).getTime();
      const reportedRow = reportedBalance(exchangeCode, movement.raw.row, movement, sequence);
      if (reportedRow) {
        const existing = reported.get(reportedRow.asset);
        if (!existing || reportedRow.sequence >= existing.sequence) {
          const priceEur = movement.price !== null && String(movement.priceCurrency || "").toUpperCase() === "EUR" ? movement.price : null;
          reported.set(reportedRow.asset, { quantity: reportedRow.quantity, at: Number.isFinite(at) ? at : 0, sequence: reportedRow.sequence, priceEur });
        }
      }
      parsedRows.push({ sequence, at: Number.isFinite(at) ? at : 0, movement, ids: idsForRow, raw });
    } else {
      parsedRows.push({ sequence, at: new Date(String(tx.occurred_at || "")).getTime() || 0, movement: {
        externalId: String(tx.id), occurredAt: String(tx.occurred_at || ""), transactionType: String(tx.transaction_type || "other"), originalType: "stored", direction: "neutral",
        baseAsset: assetById.get(String(tx.base_asset_id)) || null, baseAmount: number(tx.base_amount), quoteAsset: assetById.get(String(tx.quote_asset_id)) || null, quoteAmount: number(tx.quote_amount),
        feeAsset: assetById.get(String(tx.fee_asset_id)) || null, feeAmount: number(tx.fee_amount), price: number(tx.price), priceCurrency: String(tx.price_currency || "") || null, classification: "classified", raw: { sourceFile, sourceExchange: exchangeCode, row: sourceRow, parser: "stored" },
      }, ids: idsForRow, raw });
    }
  }

  // For assets with an official/reporting balance, use the last reported value as the anchor
  // and apply only transactions that happened after that anchor. For assets without such a
  // column (for example Bitpanda History), reconstruct the balance from each movement exactly once.
  for (const row of parsedRows) {
    for (const [assetId, amount] of [[row.ids.base, row.movement.baseAmount], [row.ids.quote, row.movement.quoteAmount], [row.ids.fee, row.movement.feeAmount]] as [string | null, number | null][]) {
      if (!assetId || amount === null || !Number.isFinite(amount)) continue;
      const symbol = assetById.get(assetId) || "";
      const anchor = reported.get(symbol);
      if (!anchor || row.at > anchor.at || (row.at === anchor.at && row.sequence > anchor.sequence)) addPosition(positions, assetId, amount, symbol, row.movement.price, row.movement.priceCurrency);
    }
  }

  for (const [symbol, anchor] of reported) {
    const assetId = [...assetById.entries()].find(([, value]) => value === symbol)?.[0];
    if (!assetId) continue;
    const current = positions.get(assetId);
    positions.set(assetId, { quantity: anchor.quantity + (current?.quantity || 0), priceEur: FIAT.has(symbol) ? 1 : anchor.priceEur ?? current?.priceEur ?? null });
  }

  const { error: deleteError } = await supabase.from("balance_snapshots").delete().eq("user_id", userId).eq("account_id", accountId).eq("source", "calculated");
  if (deleteError) throw new Error(`No se pudo limpiar el saldo anterior: ${deleteError.message}`);
  const capturedAt = new Date().toISOString();
  const snapshots = [...positions.entries()].filter(([, position]) => Math.abs(position.quantity) > 1e-12).map(([assetId, position]) => ({ user_id: userId, account_id: accountId, asset_id: assetId, captured_at: capturedAt, quantity: position.quantity, price_eur: position.priceEur, value_eur: position.priceEur === null ? null : position.quantity * position.priceEur, source: "calculated" }));
  if (snapshots.length) {
    const { error: insertError } = await supabase.from("balance_snapshots").insert(snapshots);
    if (insertError) throw new Error(`No se pudo guardar el saldo: ${insertError.message}`);
  }
  return snapshots.length;
}

export async function repairAllCsvBalances() {
  const { supabase, user } = await requireUser();
  const { data: connections, error: connectionError } = await supabase.from("exchange_connections").select("id,exchange_id").eq("user_id", user.id).eq("provider_type", "csv").eq("status", "active");
  if (connectionError) throw new Error(connectionError.message);
  const exchangeIds = [...new Set((connections || []).map((item: AnyRecord) => item.exchange_id).filter(Boolean))];
  const { data: exchanges, error: exchangeError } = exchangeIds.length ? await supabase.from("exchanges").select("id,code").in("id", exchangeIds) : { data: [], error: null };
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
