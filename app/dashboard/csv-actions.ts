"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CSV_SUPPORTED_EXCHANGES, decodeExchangeCsv, normalizeExchangeCsv, type NormalizedMovement } from "@/lib/exchanges/csv";

const FIAT = new Set(["EUR","USD","GBP","CHF","PLN","SEK","DKK","NOK","AUD","CAD","JPY","SGD"]);

function code(value:string){return value.trim().toLowerCase();}
function movementKey(m:NormalizedMovement){return m.externalId || [m.occurredAt,m.transactionType,m.baseAsset,m.baseAmount,m.quoteAsset,m.quoteAmount,m.feeAsset,m.feeAmount].join("|");}

async function ensureAssets(supabase:any,symbols:string[]){
  const list=[...new Set(symbols.map(s=>s.toUpperCase()).filter(Boolean))];
  if(!list.length)return new Map<string,string>();
  const {data:existing,error}=await supabase.from("assets").select("id,symbol").in("symbol",list);
  if(error)throw new Error(`No se pudieron cargar los activos: ${error.message}`);
  const ids=new Map<string,string>((existing||[]).map((a:any)=>[String(a.symbol).toUpperCase(),a.id]));
  for(const symbol of list){
    if(ids.has(symbol))continue;
    const {data,error:insertError}=await supabase.from("assets").insert({symbol,name:symbol,asset_type:FIAT.has(symbol)?"fiat":"crypto"}).select("id").single();
    if(insertError||!data)throw new Error(`No se pudo crear el activo ${symbol}: ${insertError?.message||"error desconocido"}`);
    ids.set(symbol,data.id);
  }
  return ids;
}

async function rebuildSnapshot(supabase:any,userId:string,accountId:string){
  const {data:rows,error}=await supabase.from("transactions").select("base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,occurred_at,base:assets!transactions_base_asset_id_fkey(symbol),quote:assets!transactions_quote_asset_id_fkey(symbol),fee:assets!transactions_fee_asset_id_fkey(symbol)").eq("user_id",userId).eq("account_id",accountId).order("occurred_at",{ascending:true});
  if(error)throw new Error(`No se pudo recalcular el saldo: ${error.message}`);
  const positions=new Map<string,{qty:number;price:number|null}>();
  const add=(id:string|null,asset:string|null,amount:number|null,price:number|null,currency:string|null)=>{
    if(!id||amount===null||!Number.isFinite(amount))return;
    const current=positions.get(id)||{qty:0,price:null}; current.qty+=Number(amount);
    if(FIAT.has(String(asset||"").toUpperCase()))current.price=1;
    if(price!==null&&Number.isFinite(price)&&String(currency||"").toUpperCase()==="EUR")current.price=price;
    positions.set(id,current);
  };
  for(const tx of rows||[]){
    const base=Array.isArray(tx.base)?tx.base[0]:tx.base; const quote=Array.isArray(tx.quote)?tx.quote[0]:tx.quote; const fee=Array.isArray(tx.fee)?tx.fee[0]:tx.fee;
    add(tx.base_asset_id,base?.symbol||null,Number.isFinite(Number(tx.base_amount))?Number(tx.base_amount):null,Number.isFinite(Number(tx.price))?Number(tx.price):null,tx.price_currency);
    add(tx.quote_asset_id,quote?.symbol||null,Number.isFinite(Number(tx.quote_amount))?Number(tx.quote_amount):null,null,null);
    add(tx.fee_asset_id,fee?.symbol||null,Number.isFinite(Number(tx.fee_amount))?Number(tx.fee_amount):null,null,null);
  }
  const {error:deleteError}=await supabase.from("balance_snapshots").delete().eq("user_id",userId).eq("account_id",accountId).eq("source","calculated_csv");
  if(deleteError)throw new Error(`No se pudo actualizar el saldo: ${deleteError.message}`);
  const capturedAt=new Date().toISOString();
  const snapshots=[...positions.entries()].filter(([,p])=>Math.abs(p.qty)>1e-12).map(([assetId,p])=>({user_id:userId,account_id:accountId,asset_id:assetId,captured_at:capturedAt,quantity:p.qty,price_eur:p.price,value_eur:p.price===null?null:p.qty*p.price,source:"calculated_csv"}));
  if(snapshots.length){const {error}=await supabase.from("balance_snapshots").insert(snapshots);if(error)throw new Error(`No se pudo guardar el saldo: ${error.message}`);}
  return snapshots.length;
}

export async function importCsvConnection(formData:FormData){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const exchangeId=String(formData.get("exchange_id")||"").trim(); const label=String(formData.get("label")||"").trim()||null;
  const files=formData.getAll("files").filter((v):v is File=>v instanceof File&&v.size>0);
  if(!exchangeId)throw new Error("Exchange no encontrado."); if(!files.length)throw new Error("Selecciona al menos un CSV.");
  const {data:exchange,error:exchangeError}=await supabase.from("exchanges").select("id,code,name").eq("id",exchangeId).eq("is_active",true).maybeSingle();
  if(exchangeError||!exchange)throw new Error(exchangeError?.message||"Exchange no encontrado.");
  const exchangeCode=code(exchange.code); if(!CSV_SUPPORTED_EXCHANGES.has(exchangeCode))throw new Error(`La importación CSV de ${exchange.name||exchangeCode} todavía no está disponible.`);

  const all:NormalizedMovement[]=[]; const parsedByFile:{file:File;movements:NormalizedMovement[]}[]=[];
  for(const file of files){
    const movements=normalizeExchangeCsv(exchangeCode,decodeExchangeCsv(await file.arrayBuffer()),file.name);
    if(!movements.length)throw new Error(`No se han encontrado movimientos en ${file.name}.`);
    const invalid=movements.findIndex(m=>!m.occurredAt||!Number.isFinite(new Date(m.occurredAt).getTime()));
    if(invalid>=0)throw new Error(`La fila ${invalid+1} de ${file.name} tiene una fecha no interpretable. Se ha detenido la importación para evitar datos falsos.`);
    parsedByFile.push({file,movements}); all.push(...movements);
  }
  const unique=[...new Map(all.map(m=>[movementKey(m),m])).values()];

  const {data:connection,error:connectionError}=await supabase.from("exchange_connections").insert({user_id:user.id,exchange_id:exchange.id,label,status:"pending",provider_type:"csv"}).select("id").single();
  if(connectionError||!connection)throw new Error(connectionError?.message||"No se pudo crear la conexión.");
  const {data:account,error:accountError}=await supabase.from("accounts").insert({user_id:user.id,connection_id:connection.id,account_type:"exchange",name:label||exchange.name||"Cuenta CSV",is_active:true}).select("id").single();
  if(accountError||!account)throw new Error(accountError?.message||"No se pudo crear la cuenta.");

  const assetIds=await ensureAssets(supabase,[...new Set(unique.flatMap(m=>[m.baseAsset,m.quoteAsset,m.feeAsset].filter((v):v is string=>Boolean(v))))]);
  try{
    for(const {file,movements} of parsedByFile){
      const fileMovements=movements.filter(m=>unique.some(u=>movementKey(u)===movementKey(m)));
      const {data:imp,error:impError}=await supabase.from("imports").insert({user_id:user.id,account_id:account.id,exchange_id:exchange.id,source_type:"csv",file_name:file.name,status:"processing",rows_total:fileMovements.length,rows_processed:0,rows_failed:0}).select("id").single();
      if(impError||!imp)throw new Error(impError?.message||`No se pudo registrar ${file.name}.`);
      const tx=fileMovements.map(m=>({user_id:user.id,account_id:account.id,import_id:imp.id,external_id:m.externalId,occurred_at:m.occurredAt,transaction_type:m.transactionType,base_asset_id:m.baseAsset?assetIds.get(m.baseAsset):null,base_amount:m.baseAmount,quote_asset_id:m.quoteAsset?assetIds.get(m.quoteAsset):null,quote_amount:m.quoteAmount,fee_asset_id:m.feeAsset?assetIds.get(m.feeAsset):null,fee_amount:m.feeAmount,price:m.price,price_currency:m.priceCurrency,raw_data:{...m.raw,original_type:m.originalType,classification:m.classification},source:"csv"}));
      for(let i=0;i<tx.length;i+=250){const {error}=await supabase.from("transactions").upsert(tx.slice(i,i+250),{onConflict:"account_id,external_id"});if(error)throw new Error(`Error guardando ${file.name}: ${error.message}`);}
      const {error:completeError}=await supabase.from("imports").update({status:"completed",rows_processed:tx.length,rows_failed:0,imported_at:new Date().toISOString(),error_message:null}).eq("id",imp.id).eq("user_id",user.id);
      if(completeError)throw new Error(`No se pudo cerrar ${file.name}: ${completeError.message}`);
    }
    const snapshots=await rebuildSnapshot(supabase,user.id,account.id); const now=new Date().toISOString();
    const {error}=await supabase.from("exchange_connections").update({status:"active",last_sync_at:now,last_sync_status:"success",last_sync_error:null,updated_at:now}).eq("id",connection.id).eq("user_id",user.id); if(error)throw new Error(`No se pudo activar la conexión: ${error.message}`);
    revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos"); revalidatePath("/dashboard/fiscalidad");
    return {success:true,connectionId:connection.id,rows:unique.length,files:parsedByFile.length,snapshots};
  }catch(error){
    const message=error instanceof Error?error.message:"No se pudo importar el CSV.";
    await supabase.from("exchange_connections").update({status:"error",last_sync_status:"error",last_sync_error:message,updated_at:new Date().toISOString()}).eq("id",connection.id).eq("user_id",user.id);
    throw new Error(message);
  }
}

export async function refreshCsvConnections(){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  revalidatePath("/dashboard"); revalidatePath("/dashboard/exchanges"); revalidatePath("/dashboard/movimientos");
}
