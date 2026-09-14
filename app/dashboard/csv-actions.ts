"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CSV_SUPPORTED_EXCHANGES, decodeExchangeCsv, normalizeExchangeCsv, type NormalizedMovement } from "@/lib/exchanges/csv";

const FIAT = new Set(["EUR","USD","GBP","CHF","PLN","SEK","DKK","NOK","AUD","CAD","JPY","SGD"]);
const supportedCode=(value:string)=>value.trim().toLowerCase();
const movementKey=(movement:NormalizedMovement)=>movement.externalId||[movement.occurredAt,movement.transactionType,movement.baseAsset,movement.baseAmount,movement.quoteAsset,movement.quoteAmount,movement.feeAsset,movement.feeAmount,movement.originalType].join("|");

async function ensureAssets(supabase:any,symbols:string[]){
  const unique=[...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(Boolean))];
  const ids=new Map<string,string>(); if(!unique.length)return ids;
  const {data:existing,error}=await supabase.from("assets").select("id,symbol").in("symbol",unique);
  if(error)throw new Error(`No se pudieron cargar los activos: ${error.message}`);
  for(const asset of existing||[])ids.set(String(asset.symbol).toUpperCase(),asset.id);
  for(const symbol of unique){
    if(ids.has(symbol))continue;
    const {data,error:insertError}=await supabase.from("assets").insert({symbol,name:symbol,asset_type:FIAT.has(symbol)?"fiat":"crypto"}).select("id,symbol").single();
    if(insertError||!data)throw new Error(`No se pudo crear el activo ${symbol}: ${insertError?.message||"error desconocido"}`);
    ids.set(symbol,data.id);
  }
  return ids;
}

async function rebuildCsvSnapshot(supabase:any,userId:string,accountId:string){
  const {data:rows,error}=await supabase.from("transactions").select("id,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,occurred_at").eq("user_id",userId).eq("account_id",accountId).order("occurred_at",{ascending:true});
  if(error)throw new Error(`No se pudo recalcular el saldo: ${error.message}`);
  const ids=[...new Set((rows||[]).flatMap((row:any)=>[row.base_asset_id,row.quote_asset_id,row.fee_asset_id].filter(Boolean)))];
  const {data:assets,error:assetError}=ids.length?await supabase.from("assets").select("id,symbol").in("id",ids):{data:[],error:null};
  if(assetError)throw new Error(`No se pudieron resolver los activos: ${assetError.message}`);
  const assetById=new Map<string,string>((assets||[]).map((asset:any)=>[asset.id,String(asset.symbol).toUpperCase()]));
  const positions=new Map<string,{quantity:number;priceEur:number|null}>();
  const add=(assetId:string|null,amount:number|null,price:number|null,currency:string|null)=>{
    if(!assetId||amount===null||!Number.isFinite(amount))return;
    const symbol=assetById.get(assetId)||""; const current=positions.get(assetId)||{quantity:0,priceEur:null}; current.quantity+=amount;
    if(FIAT.has(symbol))current.priceEur=1; if(price!==null&&Number.isFinite(price)&&String(currency||"").toUpperCase()==="EUR")current.priceEur=price; positions.set(assetId,current);
  };
  for(const tx of rows||[]){add(tx.base_asset_id,Number.isFinite(Number(tx.base_amount))?Number(tx.base_amount):null,Number.isFinite(Number(tx.price))?Number(tx.price):null,tx.price_currency);add(tx.quote_asset_id,Number.isFinite(Number(tx.quote_amount))?Number(tx.quote_amount):null,null,null);add(tx.fee_asset_id,Number.isFinite(Number(tx.fee_amount))?Number(tx.fee_amount):null,null,null);}
  const {error:deleteError}=await supabase.from("balance_snapshots").delete().eq("user_id",userId).eq("account_id",accountId).eq("source","calculated_csv");
  if(deleteError)throw new Error(`No se pudo actualizar el saldo calculado: ${deleteError.message}`);
  const capturedAt=new Date().toISOString();
  const snapshots=[...positions.entries()].filter(([,position])=>Math.abs(position.quantity)>1e-12).map(([assetId,position])=>({user_id:userId,account_id:accountId,asset_id:assetId,captured_at:capturedAt,quantity:position.quantity,price_eur:position.priceEur,value_eur:position.priceEur===null?null:position.quantity*position.priceEur,source:"calculated_csv"}));
  if(snapshots.length){const {error:insertError}=await supabase.from("balance_snapshots").insert(snapshots);if(insertError)throw new Error(`No se pudo guardar el saldo calculado: ${insertError.message}`);}
  return snapshots.length;
}

export async function importCsvConnection(formData:FormData){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const exchangeId=String(formData.get("exchange_id")||"").trim(); const label=String(formData.get("label")||"").trim()||null;
  const files=formData.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0);
  if(!exchangeId)throw new Error("Exchange no encontrado."); if(!files.length)throw new Error("Selecciona al menos un CSV.");
  const {data:exchange,error:exchangeError}=await supabase.from("exchanges").select("id,code,name").eq("id",exchangeId).eq("is_active",true).maybeSingle();
  if(exchangeError||!exchange)throw new Error(exchangeError?.message||"Exchange no encontrado.");
  const exchangeCode=supportedCode(exchange.code); if(!CSV_SUPPORTED_EXCHANGES.has(exchangeCode))throw new Error(`La importación CSV de ${exchange.name||exchangeCode} todavía no está disponible.`);

  const parsed:{file:File;movements:NormalizedMovement[]}[]=[]; const all:NormalizedMovement[]=[];
  for(const file of files){
    const movements=normalizeExchangeCsv(exchangeCode,decodeExchangeCsv(await file.arrayBuffer()),file.name); if(!movements.length)throw new Error(`No se han encontrado movimientos en ${file.name}.`);
    const invalid=movements.findIndex(m=>!m.occurredAt||!Number.isFinite(new Date(m.occurredAt).getTime())); if(invalid>=0)throw new Error(`La fila ${invalid+1} de ${file.name} tiene una fecha no interpretable. Se ha detenido la importación para evitar guardar datos incorrectos.`);
    parsed.push({file,movements}); all.push(...movements);
  }
  const uniqueByKey=new Map<string,NormalizedMovement>(); for(const movement of all){const key=movementKey(movement);if(!uniqueByKey.has(key))uniqueByKey.set(key,movement);} const unique=[...uniqueByKey.values()];
  const symbols=unique.flatMap(m=>[m.baseAsset,m.quoteAsset,m.feeAsset].filter((value):value is string=>Boolean(value)));

  const {data:connection,error:connectionError}=await supabase.from("exchange_connections").insert({user_id:user.id,exchange_id:exchange.id,label,status:"pending",provider_type:"csv"}).select("id").single();
  if(connectionError||!connection)throw new Error(connectionError?.message||"No se pudo crear la conexión.");
  const {data:account,error:accountError}=await supabase.from("accounts").insert({user_id:user.id,connection_id:connection.id,account_type:"exchange",name:label||exchange.name||"Cuenta CSV",is_active:true}).select("id").single();
  if(accountError||!account)throw new Error(accountError?.message||"No se pudo crear la cuenta.");
  try{
    const assetIds=await ensureAssets(supabase,symbols);
    for(const {file,movements} of parsed){
      const usable=movements.filter(m=>uniqueByKey.has(movementKey(m)));
      const {data:importRow,error:importError}=await supabase.from("imports").insert({user_id:user.id,account_id:account.id,exchange_id:exchange.id,source_type:"csv",file_name:file.name,status:"processing",rows_total:usable.length,rows_processed:0,rows_failed:0}).select("id").single();
      if(importError||!importRow)throw new Error(importError?.message||`No se pudo registrar ${file.name}.`);
      const tx=usable.map(m=>({user_id:user.id,account_id:account.id,import_id:importRow.id,external_id:m.externalId,occurred_at:m.occurredAt,transaction_type:m.transactionType,base_asset_id:m.baseAsset?assetIds.get(m.baseAsset):null,base_amount:m.baseAmount,quote_asset_id:m.quoteAsset?assetIds.get(m.quoteAsset):null,quote_amount:m.quoteAmount,fee_asset_id:m.feeAsset?assetIds.get(m.feeAsset):null,fee_amount:m.feeAmount,price:m.price,price_currency:m.priceCurrency,raw_data:{...m.raw,original_type:m.originalType,classification:m.classification},source:"csv"}));
      for(let i=0;i<tx.length;i+=250){const {error}=await supabase.from("transactions").upsert(tx.slice(i,i+250),{onConflict:"account_id,external_id"});if(error)throw new Error(`Error guardando ${file.name}: ${error.message}`);}
      const {error:doneError}=await supabase.from("imports").update({status:"completed",rows_processed:tx.length,rows_failed:0,imported_at:new Date().toISOString(),error_message:null}).eq("id",importRow.id).eq("user_id",user.id);if(doneError)throw new Error(`No se pudo cerrar ${file.name}: ${doneError.message}`);
    }
    const snapshots=await rebuildCsvSnapshot(supabase,user.id,account.id); const now=new Date().toISOString();
    const {error:statusError}=await supabase.from("exchange_connections").update({status:"active",last_sync_at:now,last_sync_status:"success",last_sync_error:null,updated_at:now}).eq("id",connection.id).eq("user_id",user.id);if(statusError)throw new Error(`No se pudo activar la conexión: ${statusError.message}`);
    revalidatePath("/dashboard");revalidatePath("/dashboard/exchanges");revalidatePath("/dashboard/movimientos");revalidatePath("/dashboard/fiscalidad");
    return {success:true,connectionId:connection.id,rows:unique.length,files:parsed.length,snapshots};
  }catch(error){
    const message=error instanceof Error?error.message:"No se pudo importar el CSV.";
    await supabase.from("exchange_connections").update({status:"error",last_sync_status:"error",last_sync_error:message,updated_at:new Date().toISOString()}).eq("id",connection.id).eq("user_id",user.id);
    throw new Error(message);
  }
}

export async function refreshCsvConnections(){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  revalidatePath("/dashboard");revalidatePath("/dashboard/exchanges");revalidatePath("/dashboard/movimientos");
}
