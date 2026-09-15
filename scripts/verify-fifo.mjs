import assert from "node:assert/strict";
import { calculateFifo } from "../lib/tax/fifo.ts";

const rates = [
  "CURRENCY,TIME_PERIOD,OBS_VALUE",
  "USD,2023-04-24,1.10",
  "USD,2023-04-25,1.10",
  "USD,2025-10-03,1.1734",
  "USD,2025-10-04,1.1734",
  "USD,2025-11-13,1.1619",
  "USD,2026-01-01,1.17",
].join("\n");

globalThis.fetch = async () => new Response(rates, { status: 200 });

function asset(id, symbol, asset_type = "crypto") {
  return { id, symbol, name: symbol, asset_type };
}

function tx(id, occurred_at, transaction_type, base_asset_id, base_amount, quote_asset_id = null, quote_amount = null, extra = {}) {
  return {
    id,
    occurred_at,
    transaction_type,
    base_asset_id,
    base_amount,
    quote_asset_id,
    quote_amount,
    fee_asset_id: null,
    fee_amount: null,
    price: null,
    price_currency: null,
    account_id: "acc",
    raw_data: {},
    ...extra,
  };
}

const assets = new Map([
  ["usd", asset("usd", "USD", "fiat")],
  ["eur", asset("eur", "EUR", "fiat")],
  ["btc", asset("btc", "BTC")],
  ["ape", asset("ape", "APE")],
  ["silver", asset("silver", "Silver", "metal")],
  ["bcpusd", asset("bcpusd", "BCPUSD", null)],
  ["bcpeur", asset("bcpeur", "BCPEUR", null)],
  ["doge", asset("doge", "DOGE")],
  ["eth", asset("eth", "ETH")],
  ["usdc", asset("usdc", "USDC")],
]);

// Previous fiscal years feed FIFO, but future operations must not affect the selected year.
const historical = await calculateFifo([
  tx("b2023", "2023-01-10T10:00:00Z", "buy", "btc", 1, "eur", -100),
  tx("s2025", "2025-02-10T10:00:00Z", "sell", "btc", -1, "eur", 150),
  tx("b2026", "2026-02-10T10:00:00Z", "buy", "btc", 1, "eur", -500),
], 2025, assets);
assert.equal(historical.disposals, 1);
assert.ok(Math.abs(historical.gain - 50) < 1e-9);
assert.equal(historical.processedTransactions, 2);
assert.equal(historical.lots.get("btc")?.length, 0);

// Bitpanda transfer(stake)/transfer(unstake) are custody movements, not income.
const staking = await calculateFifo([
  tx("a-buy", "2023-04-24T16:19:00Z", "buy", "ape", 10, "eur", -100),
  tx("a-out", "2023-04-24T16:19:43Z", "transfer_out", "ape", -10, null, null, { raw_data: { original_type: "transfer" } }),
  tx("a-stake", "2023-04-24T16:19:43Z", "staking", "ape", 10, null, null, { raw_data: { original_type: "transfer(stake)", row: { "In/Out": "incoming", "Transaction Type": "transfer(stake)" } } }),
  tx("a-unstake", "2023-04-25T16:58:40Z", "staking", "ape", -10, null, null, { raw_data: { original_type: "transfer(unstake)", row: { "In/Out": "outgoing", "Transaction Type": "transfer(unstake)" } }),
  tx("a-in", "2023-04-25T16:58:40Z", "transfer_in", "ape", 10),
  tx("a-sell", "2023-05-01T10:00:00Z", "sell", "ape", -10, "eur", 120),
], 2023, assets);
assert.equal(staking.incomeEur, 0);
assert.equal(staking.incomeKnown, 0);
assert.equal(staking.disposals, 1);
assert.ok(Math.abs(staking.gain - 20) < 1e-9);
assert.equal(staking.gainKnown, true);

// Bitpanda Cash Plus proxies are cash-like and must not become taxable crypto disposals.
const cashProxy = await calculateFifo([
  tx("bcp-sell", "2025-01-02T10:00:00Z", "sell", "bcpusd", -160),
  tx("doge-buy", "2025-01-02T10:00:00Z", "buy", "doge", 100, "bcpusd", -160),
], 2025, assets);
assert.equal(cashProxy.disposals, 0);
assert.equal(cashProxy.gain, 0);
assert.ok(Math.abs((cashProxy.lots.get("doge")?.[0]?.costEur ?? 0) - (160 / 1.10)) < 1e-9);

// Silver: 160 USD is an acquisition cost, converted historically to EUR.
const silver = await calculateFifo([
  tx("silver-buy", "2025-10-04T00:01:08Z", "buy", "silver", 100.39785851, "usd", -160, null, { raw_data: { original_type: "buy", row: { "Asset class": "Metal" } } }),
  tx("silver-sell", "2025-11-13T12:33:15Z", "sell", "silver", -100.39785851, "eur", 145.95),
], 2025, assets);
assert.equal(silver.disposals, 1);
assert.ok(Math.abs(silver.costBasis - (160 / 1.1734)) < 1e-8);
assert.ok(Math.abs(silver.gain - (145.95 - 160 / 1.1734)) < 1e-8);

// Crypto-to-crypto permuta: the received asset gets the EUR value used for the exchange.
const swap = await calculateFifo([
  tx("eth-buy", "2025-01-05T10:00:00Z", "buy", "eth", 1, "eur", -100),
  tx("eth-trade", "2025-02-05T10:00:00Z", "trade", "eth", -1, "usdc", 150, { price: 100, price_currency: "EUR" }),
  tx("usdc-sell", "2025-03-05T10:00:00Z", "sell", "usdc", -150, "eur", 180),
], 2025, assets);
assert.equal(swap.disposals, 2);
assert.ok(Math.abs(swap.gain - 80) < 1e-9);

// External crypto deposit without a linked outbound transfer remains unknown basis.
const unknown = await calculateFifo([
  tx("dep", "2025-01-01T10:00:00Z", "deposit", "btc", 1),
  tx("sell", "2025-02-01T10:00:00Z", "sell", "btc", -1, "eur", 100),
], 2025, assets);
assert.equal(unknown.gainKnown, false);
assert.equal(unknown.unknownBasis, 1);
assert.equal(unknown.disposals, 1);

console.log("FIFO verification: OK");
