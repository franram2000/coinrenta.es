import { bitpandaApi } from "./api";

function n(value: unknown) { const x = Number(value); return Number.isFinite(x) ? x : null; }
function signed(amount: unknown, direction: unknown) { const x = n(amount) ?? 0; return String(direction).toLowerCase() === "outgoing" ? -x : x; }
function time(attrs: any) { return attrs?.time?.date_iso8601 || attrs?.last_changed?.date_iso8601 || new Date().toISOString(); }
function assetType(symbol: string, commodity = false) { return commodity ? "commodity" : ["EUR","USD","GBP","CHF","PLN","SEK","DKK","NOK"].includes(symbol) ? "fiat" : "crypto"; }

export async function syncBitpanda({ supabase, userId, connectionId, accountId, apiKey }: { supabase: any; userId: string; connectionId: string; accountId: string; apiKey: string }) {
  const [trades, cryptoTx, fiatTx, commodityTx, wallets, fiatWallets, assetWallets, ticker] = await Promise.all([
    bitpandaApi.trades(apiKey), bitpandaApi.cryptoTransactions(apiKey), bitpandaApi.fiatTransactions(apiKey), bitpandaApi.commodityTransactions(apiKey),
    bitpandaApi.cryptoWallets(apiKey), bitpandaApi.fiatWallets(apiKey), bitpandaApi.assetWallets(apiKey), bitpandaApi.ticker(apiKey),
  ]);

  const walletSymbols = new Map<string,string>();
  for (const w of wallets as any[]) walletSymbols.set(w.id, w.attributes?.cryptocoin_symbol || "UNKNOWN");
  const fiatSymbols = new Map<string,string>();
  for (const w of fiatWallets as any[]) fiatSymbols.set(w.id, w.attributes?.fiat_symbol || "EUR");
  const commoditySymbols = new Map<string,string>();
  const walk = (value: any) => { if (!value || typeof value !== "object") return; if (Array.isArray(value)) return value.forEach(walk); if (value.id && value.attributes?.cryptocoin_symbol) commoditySymbols.set(value.id,value.attributes.cryptocoin_symbol); Object.values(value).forEach(walk); };
  walk(assetWallets);

  const tickerMap = new Map<string,number>();
  for (const item of ticker as any[]) { const price=n(item.attributes?.price ?? item.price); const symbol=item.attributes?.symbol ?? item.symbol; if(symbol && price!==null) tickerMap.set(String(symbol).toUpperCase(),price); }

  const symbols = new Set<string>();
  for (const w of wallets as any[]) if(w.attributes?.cryptocoin_symbol) symbols.add(w.attributes.cryptocoin_symbol);
  for (const w of fiatWallets as any[]) if(w.attributes?.fiat_symbol) symbols.add(w.attributes.fiat_symbol);
  for (const symbol of commoditySymbols.values()) symbols.add(symbol);
  for (const row of [...trades,...cryptoTx,...fiatTx,...commodityTx] as any[]) {
    const a=row.attributes||{}; const symbol=walletSymbols.get(a.wallet_id)||fiatSymbols.get(a.fiat_wallet_id)||commoditySymbols.get(a.wallet_id); if(symbol) symbols.add(symbol);
  }

  const existing = await supabase.from("assets").select("id,symbol,asset_type").in("symbol", [...symbols]);
  const assetIds = new Map<string,string>((existing.data||[]).map((a:any)=>[a.symbol,a.id]));
  for (const symbol of symbols) {
    if(assetIds.has(symbol)) continue;
    const {data,error}=await supabase.from("assets").insert({symbol,name:symbol,asset_type:assetType(symbol,commoditySymbolsHas(commoditySymbols,symbol))}).select("id").single();
    if(error) throw new Error(`No se pudo crear el activo ${symbol}: ${error.message}`);
    assetIds.set(symbol,data.id);
  }

  const rows:any[]=[];
  for(const record of trades as any[]){
    const a=record.attributes||{}; const crypto=walletSymbols.get(a.wallet_id)||"UNKNOWN"; const fiat=fiatSymbols.get(a.fiat_wallet_id)||"EUR";
    rows.push({user_id:userId,account_id:accountId,external_id:`trade:${record.id}`,occurred_at:time(a),transaction_type:a.type||"trade",base_asset_id:assetIds.get(crypto)||null,base_amount:n(a.amount_cryptocoin),quote_asset_id:assetIds.get(fiat)||null,quote_amount:n(a.amount_fiat),price:n(a.price),price_currency:fiat,raw_data:record,source:"api:bitpanda"});
  }
  for(const record of cryptoTx as any[]){
    const a=record.attributes||{}; const symbol=walletSymbols.get(a.wallet_id)||"UNKNOWN"; const direction=String(a.in_or_out||""); const type=direction==="incoming"?"deposit":direction==="outgoing"?"withdrawal":a.type||"transfer";
    rows.push({user_id:userId,account_id:accountId,external_id:`crypto:${record.id}`,occurred_at:time(a),transaction_type:type,base_asset_id:assetIds.get(symbol)||null,base_amount:signed(a.amount,a.in_or_out),quote_amount:null,price:null,price_currency:"EUR",fee_asset_id:assetIds.get(symbol)||null,fee_amount:n(a.fee),raw_data:record,source:"api:bitpanda"});
  }
  for(const record of fiatTx as any[]){
    const a=record.attributes||{}; const symbol=fiatSymbols.get(a.fiat_wallet_id)||"EUR"; const type=a.type||"transfer";
    const amount = n(a.amount);
    const eurRate = n(a.to_eur_rate);
    const quoteAmount = amount !== null && eurRate !== null ? amount * eurRate : null;
    rows.push({user_id:userId,account_id:accountId,external_id:`fiat:${record.id}`,occurred_at:time(a),transaction_type:type,base_asset_id:assetIds.get(symbol)||null,base_amount:signed(a.amount,a.in_or_out),quote_amount:quoteAmount,price_currency:"EUR",raw_data:record,source:"api:bitpanda"});
  }
  for(const record of commodityTx as any[]){
    const a=record.attributes||{}; const symbol=commoditySymbols.get(a.wallet_id)||walletSymbols.get(a.wallet_id)||"UNKNOWN";
    rows.push({user_id:userId,account_id:accountId,external_id:`commodity:${record.id}`,occurred_at:time(a),transaction_type:a.type||"buy",base_asset_id:assetIds.get(symbol)||null,base_amount:signed(a.amount,a.in_or_out),quote_amount:n(a.amount_eur),price:n(a.trade?.attributes?.price),price_currency:"EUR",fee_asset_id:assetIds.get(symbol)||null,fee_amount:n(a.fee),raw_data:record,source:"api:bitpanda"});
  }

  let processed=0;
  for(let i=0;i<rows.length;i+=250){ const chunk=rows.slice(i,i+250); const {error}=await supabase.from("transactions").upsert(chunk,{onConflict:"account_id,external_id"}); if(error) throw new Error(`Error guardando movimientos Bitpanda: ${error.message}`); processed+=chunk.length; }

  const now=new Date().toISOString();
  const snapshotRows:any[]=[];
  for(const w of wallets as any[]){ const a=w.attributes||{}; const symbol=a.cryptocoin_symbol; const quantity=n(a.balance)??0; if(!symbol||!assetIds.get(symbol)) continue; const price=tickerMap.get(symbol.toUpperCase())??null; snapshotRows.push({user_id:userId,account_id:accountId,asset_id:assetIds.get(symbol),captured_at:now,quantity,price_eur:price,value_eur:price===null?null:quantity*price,source:"api:bitpanda"}); }
  for(const w of fiatWallets as any[]){ const a=w.attributes||{}; const symbol=a.fiat_symbol; const quantity=n(a.balance)??0; if(!symbol||!assetIds.get(symbol)) continue; const price=symbol==="EUR"?1:null; snapshotRows.push({user_id:userId,account_id:accountId,asset_id:assetIds.get(symbol),captured_at:now,quantity,price_eur:price,value_eur:price===null?null:quantity,source:"api:bitpanda"}); }
  if(snapshotRows.length){ const {error}=await supabase.from("balance_snapshots").insert(snapshotRows); if(error) throw new Error(`Error guardando saldos Bitpanda: ${error.message}`); }

  await supabase.from("exchange_connections").update({status:"connected",last_sync_at:now,last_sync_status:"success",last_sync_error:null}).eq("id",connectionId).eq("user_id",userId);
  return {transactions:processed,snapshots:snapshotRows.length};
}
function commoditySymbolsHas(map: Map<string,string>, symbol:string){ for(const value of map.values()) if(value===symbol) return true; return false; }