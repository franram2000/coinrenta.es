import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QualityControl from "./quality-control";

export const metadata: Metadata = { title: "Renta", description: "Preparación de los datos de criptoactivos para Renta, Patrimonio y obligaciones informativas.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Tx = { id:string; occurred_at:string; transaction_type:string; base_asset_id:string|null; base_amount:number|string|null; quote_asset_id:string|null; quote_amount:number|string|null; fee_asset_id:string|null; fee_amount:number|string|null; price:number|string|null; price_currency:string|null; source:string|null; account_id:string };
type Snapshot = { id:string; captured_at:string; account_id:string; asset_id:string; quantity:number|string|null; value_eur:number|string|null; price_eur:number|string|null; source:string|null };
type Asset = { id:string; symbol:string; name:string; asset_type:string|null };
type Account = { id:string; connection_id:string|null; name:string };
type Connection = { id:string; exchange_id:string; label:string|null; provider_type:string|null };
type Exchange = { id:string; code:string; name:string; website:string|null };
type Lot = { qty:number; cost:number|null };
type QualitySale = { id:string; occurredAt:string; symbol:string; name:string; quantity:number; proceeds:number|null; missingQuantity:number; reason:string };
type Report = { acquisitions:number; disposals:number; proceeds:number; costBasis:number; gain:number; gainKnown:boolean; unknownBasis:number; incomeEvents:number; incomeEur:number; incomeKnown:number; feesEur:number; cryptoFeeEvents:number; transfers:number; unsupported:number; qualitySales:QualitySale[]; positions:{symbol:string;name:string;quantity:number;valueEur:number|null;accountCount:number;foreign:boolean}[]; foreignValueEur:number };

const FIAT = new Set(["EUR","USD","GBP","CHF","PLN","SEK","DKK","NOK"]);
const INCOME_TYPES = new Set(["reward","interest","dividend","airdrop","cashback","staking"]);
const TRANSFER_TYPES = new Set(["deposit","withdrawal","transfer_in","transfer_out","transfer"]);
const SALE_TYPES = new Set(["sell","swap","trade","convert"]);

function money(value:number|null|undefined){ if(value===null||value===undefined||!Number.isFinite(value)) return "—"; return value.toLocaleString("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:2}); }
function qty(value:number){ return value.toLocaleString("es-ES",{maximumFractionDigits:8}); }
function date(value:string|null|undefined){ return value?new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—"; }
function isoStart(year:number){return `${year}-01-01T00:00:00.000Z`;}
function isoEnd(year:number){return `${year+1}-01-01T00:00:00.000Z`;}

async function fetchTransactions(supabase:Awaited<ReturnType<typeof createClient>>,userId:string,end:string){
  const out:Tx[]=[]; const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await supabase.from("transactions").select("id,occurred_at,transaction_type,base_asset_id,base_amount,quote_asset_id,quote_amount,fee_asset_id,fee_amount,price,price_currency,source,account_id").eq("user_id",userId).lt("occurred_at",end).order("occurred_at",{ascending:true}).range(from,from+pageSize-1);
    if(error) throw new Error(error.message); const rows=(data||[]) as Tx[]; out.push(...rows); if(rows.length<pageSize) break;
  }
  return out;
}

function buildReport(transactions:Tx[],year:number,assets:Map<string,Asset>,accounts:Map<string,Account>,connections:Map<string,Connection>,exchanges:Map<string,Exchange>,snapshots:Snapshot[]):Report{
  const lots=new Map<string,Lot[]>(); const positions=new Map<string,{symbol:string;name:string;quantity:number;accounts:Set<string>}>(); const qualitySales:QualitySale[]=[];
  let acquisitions=0,disposals=0,proceeds=0,costBasis=0,gain=0,unknownBasis=0,incomeEvents=0,incomeEur=0,incomeKnown=0,feesEur=0,cryptoFeeEvents=0,transfers=0,unsupported=0,gainKnown=true;
  const getAsset=(id:string|null)=>id?assets.get(id)||null:null;
  const addLot=(assetId:string,quantity:number,cost:number|null)=>{if(quantity<=0)return;const list=lots.get(assetId)||[];list.push({qty:quantity,cost});lots.set(assetId,list);};
  const consumeLots=(assetId:string,quantity:number)=>{let remaining=quantity,allocated=0,known=true;const list=lots.get(assetId)||[];while(remaining>1e-12&&list.length){const lot=list[0];const take=Math.min(remaining,lot.qty);if(lot.cost===null)known=false;else allocated+=lot.cost*(take/lot.qty);lot.qty-=take;remaining-=take;if(lot.qty<=1e-12)list.shift();}lots.set(assetId,list);if(remaining>1e-12)known=false;return{allocated,known,remaining};};
  const ordered=[...transactions].sort((a,b)=>new Date(a.occurred_at).getTime()-new Date(b.occurred_at).getTime());
  const pendingTransfers=new Map<string,{quantity:number;cost:number;at:number}>();
  for(const tx of ordered){
    const type=(tx.transaction_type||"").toLowerCase(),base=getAsset(tx.base_asset_id),quote=getAsset(tx.quote_asset_id),feeAsset=getAsset(tx.fee_asset_id); const baseQty=Math.abs(Number(tx.base_amount||0)),quoteValue=Math.abs(Number(tx.quote_amount||0)),feeQty=Math.abs(Number(tx.fee_amount||0)); const inYear=new Date(tx.occurred_at).getUTCFullYear()===year;
    const quoteIsEur=(!!quote&&quote.asset_type==="fiat"&&(quote.symbol||"").toUpperCase()==="EUR")||(tx.price_currency||"").toUpperCase()==="EUR";
    const quoteIsFiat=!!quote&&(quote.asset_type==="fiat"||FIAT.has((quote.symbol||"").toUpperCase()));
    if(feeQty>0){if(feeAsset&&feeAsset.asset_type!=="fiat"&&!FIAT.has(feeAsset.symbol.toUpperCase())){if(inYear)cryptoFeeEvents++;}else if(inYear)feesEur+=feeQty;}
    if(type==="buy"&&base&&baseQty>0){if(inYear)acquisitions++;const cost=quoteValue>0&&quoteIsFiat&&((quote?.symbol||"").toUpperCase()==="EUR"||(tx.price_currency||"").toUpperCase()==="EUR")?quoteValue+((feeAsset&&(feeAsset.asset_type==="fiat"||FIAT.has(feeAsset.symbol.toUpperCase())))?feeQty:0):null;addLot(base.id,baseQty,cost);continue;}
    if(INCOME_TYPES.has(type)&&base&&baseQty>0){if(inYear)incomeEvents++;const value=quoteValue>0&&quoteIsEur?quoteValue:(Number(tx.price||0)>0&&(tx.price_currency||"").toUpperCase()==="EUR"?baseQty*Number(tx.price):null);if(value!==null&&Number.isFinite(value)){if(inYear){incomeEur+=value;incomeKnown++;}addLot(base.id,baseQty,value);}else addLot(base.id,baseQty,null);continue;}
    if(TRANSFER_TYPES.has(type)){
      if(inYear)transfers++;
      const transferKey=base?base.id:"";
      if(type==="transfer_out"||type==="withdrawal"){
        if(base&&baseQty>0){const consumed=consumeLots(base.id,baseQty);if(consumed.remaining<=1e-12&&consumed.allocated>=0)pendingTransfers.set(`${transferKey}:${baseQty.toFixed(12)}`,{quantity:baseQty,cost:consumed.allocated,at:new Date(tx.occurred_at).getTime()});}
      } else if((type==="transfer_in"||type==="deposit"||type==="transfer")&&base&&baseQty>0){
        const key=`${transferKey}:${baseQty.toFixed(12)}`,candidate=pendingTransfers.get(key),age=candidate?Math.abs(new Date(tx.occurred_at).getTime()-candidate.at):Infinity;
        if(candidate&&age<=7*24*60*60*1000){addLot(base.id,baseQty,candidate.cost);pendingTransfers.delete(key);}else addLot(base.id,baseQty,null);
      }
      continue;
    }
    if(type==="fee"){
      if(feeAsset&&feeQty>0)consumeLots(feeAsset.id,feeQty); else if(base&&baseQty>0)consumeLots(base.id,baseQty);
      continue;
    }
    if(type==="expense") continue;
    if(SALE_TYPES.has(type)&&base&&baseQty>0){
      if(!quoteIsFiat&&!quoteIsEur){unsupported+=inYear?1:0;const consumed=consumeLots(base.id,baseQty);if(consumed.remaining>1e-12||!quote)gainKnown=false;if(quote)addLot(quote.id,quoteValue,null);continue;}
      const consumed=consumeLots(base.id,baseQty);
      if(inYear){disposals++;const netProceeds=quoteValue-((feeAsset&&(feeAsset.asset_type==="fiat"||FIAT.has(feeAsset.symbol.toUpperCase())))?feeQty:0);if(quoteValue>0&&quoteIsEur){proceeds+=netProceeds;if(consumed.known){costBasis+=consumed.allocated;gain+=netProceeds-consumed.allocated;}else{gainKnown=false;unknownBasis++;qualitySales.push({id:tx.id,occurredAt:tx.occurred_at,symbol:base.symbol,name:base.name,quantity:baseQty,proceeds:netProceeds,missingQuantity:Math.min(baseQty,consumed.remaining>1e-12?consumed.remaining:baseQty),reason:consumed.remaining>1e-12?"No hay cantidad adquirida suficiente en los datos importados.":"El lote FIFO aplicado contiene un coste de adquisición no demostrable."});}}else{gainKnown=false;unknownBasis++;qualitySales.push({id:tx.id,occurredAt:tx.occurred_at,symbol:base.symbol,name:base.name,quantity:baseQty,proceeds:null,missingQuantity:baseQty,reason:"La contraprestación de la venta no está suficientemente identificada."});}}
      continue;
    }
    if(base&&baseQty>0&&type!=="unknown"&&type!==""){unsupported+=inYear?1:0;addLot(base.id,baseQty,null);if(inYear)gainKnown=false;}
  }
  for(const [assetId,list] of lots){const asset=assets.get(assetId);if(!asset)continue;const quantity=list.reduce((s,l)=>s+Math.max(0,l.qty),0);if(quantity<=1e-12)continue;const accountSet=new Set<string>();for(const s of snapshots)if(s.asset_id===assetId&&Math.abs(Number(s.quantity||0))>1e-12)accountSet.add(s.account_id);positions.set(assetId,{symbol:asset.symbol,name:asset.name,quantity,accounts:accountSet});}
  const yearEnd=snapshots.filter(s=>{const d=new Date(s.captured_at);return d.getUTCFullYear()===year&&d.getUTCMonth()===11&&d.getUTCDate()===31&&s.value_eur!==null}); const valueByAsset=new Map<string,number>(),foreignByAsset=new Set<string>();let foreignValueEur=0;
  for(const s of yearEnd){const value=Number(s.value_eur);if(!Number.isFinite(value))continue;valueByAsset.set(s.asset_id,(valueByAsset.get(s.asset_id)||0)+value);const account=accounts.get(s.account_id),connection=account?.connection_id?connections.get(account.connection_id):null,exchange=connection?exchanges.get(connection.exchange_id):null;if(exchange?.code?.toLowerCase()==="bitpanda"){foreignValueEur+=value;foreignByAsset.add(s.asset_id);}}
  const positionsArray=[...positions.entries()].map(([assetId,p])=>({symbol:p.symbol,name:p.name,quantity:p.quantity,valueEur:valueByAsset.get(assetId)||null,accountCount:p.accounts.size,foreign:foreignByAsset.has(assetId)})).sort((a,b)=>(b.valueEur||0)-(a.valueEur||0));
  return{acquisitions,disposals,proceeds,costBasis,gain,gainKnown,unknownBasis,incomeEvents,incomeEur,incomeKnown,feesEur,cryptoFeeEvents,transfers,unsupported,qualitySales,positions:positionsArray,foreignValueEur};
}

export default async function RentaPage({searchParams}:{searchParams:Promise<{year?:string}>}){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const params=await searchParams;const requestedYear=Number(params.year);const year=Number.isInteger(requestedYear)&&requestedYear>=2020&&requestedYear<=2030?requestedYear:2025;const start=isoStart(year),end=isoEnd(year);
  const [transactions,snapshotsResult,latestSnapshotResult,assetsResult,accountsResult,connectionsResult,exchangesResult,taxYearsResult]=await Promise.all([
    fetchTransactions(supabase,user.id,end),
    supabase.from("balance_snapshots").select("id,captured_at,account_id,asset_id,quantity,value_eur,price_eur,source").eq("user_id",user.id).lt("captured_at",end).order("captured_at",{ascending:true}).limit(20000),
    supabase.from("balance_snapshots").select("id,captured_at,source").eq("user_id",user.id).order("captured_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("assets").select("id,symbol,name,asset_type"),supabase.from("accounts").select("id,connection_id,name").eq("user_id",user.id),supabase.from("exchange_connections").select("id,exchange_id,label,provider_type").eq("user_id",user.id),supabase.from("exchanges").select("id,code,name,website").eq("is_active",true),supabase.from("tax_years").select("id,year,status,updated_at").eq("user_id",user.id).order("year",{ascending:false})
  ]);
  if(snapshotsResult.error||latestSnapshotResult.error||assetsResult.error||accountsResult.error||connectionsResult.error||exchangesResult.error)throw new Error((snapshotsResult.error||latestSnapshotResult.error||assetsResult.error||accountsResult.error||connectionsResult.error||exchangesResult.error)?.message||"No se pudo cargar la información fiscal.");
  const assets=new Map<string,Asset>((assetsResult.data||[]).map((r:Asset)=>[r.id,r])),accounts=new Map<string,Account>((accountsResult.data||[]).map((r:Account)=>[r.id,r])),connections=new Map<string,Connection>((connectionsResult.data||[]).map((r:Connection)=>[r.id,r])),exchanges=new Map<string,Exchange>((exchangesResult.data||[]).map((r:Exchange)=>[r.id,r]));
  const snapshots=(snapshotsResult.data||[]) as Snapshot[],selectedTransactions=transactions.filter(tx=>new Date(tx.occurred_at)>=new Date(start)&&new Date(tx.occurred_at)<new Date(end)),report=buildReport(transactions,year,assets,accounts,connections,exchanges,snapshots);
  const latestValuation=latestSnapshotResult.data?.captured_at||null;
  const foreignCustodians=[...connections.values()].map(connection=>({connection,exchange:exchanges.get(connection.exchange_id)})).filter(({exchange})=>exchange?.code?.toLowerCase()==="bitpanda");
  const hasYearEnd=snapshots.some(s=>{const d=new Date(s.captured_at);return d.getUTCFullYear()===year&&d.getUTCMonth()===11&&d.getUTCDate()===31&&s.value_eur!==null;});
  const issues=[
    report.unknownBasis>0?{code:"missing-basis",title:`${report.unknownBasis} ventas con coste de adquisición no demostrable`,description:"Estas ventas no deben darse por buenas: el coste FIFO no puede justificarse completamente con los movimientos importados.",sales:report.qualitySales}:null,
    report.unsupported>0?{code:"unsupported",title:`${report.unsupported} operaciones requieren clasificación`,description:"Hay movimientos que CoinRenta conserva pero no puede asignar todavía a un tratamiento fiscal fiable.",actionLabel:"Revisar movimientos",actionHref:"/dashboard/movimientos"}:null,
    report.cryptoFeeEvents>0?{code:"crypto-fees",title:`${report.cryptoFeeEvents} comisiones pagadas en cripto`,description:"Las comisiones en cripto pueden constituir una disposición y necesitan revisión separada.",actionLabel:"Revisar movimientos",actionHref:"/dashboard/movimientos"}:null,
    !hasYearEnd?{code:"info",title:"No hay valoración exacta a 31/12",description:"El valor de Patrimonio/Modelo 721 no se marca como definitivo hasta disponer de una valoración de cierre."}:null,
    foreignCustodians.length>0?{code:"info-foreign",title:"Se ha detectado custodia extranjera",description:"Bitpanda aparece como custodio extranjero por su entidad identificada. Comprueba la entidad contractual de tu producto antes de determinar obligaciones informativas."}:null,
  ].filter(Boolean) as any[];
  const yearLinks=[2025,2024,2023,2022].map(value=>({value,href:value===2025?"/dashboard/renta":`/dashboard/renta?year=${value}`}));const taxYearStored=(taxYearsResult.data||[]).find((item:any)=>item.year===year);
  const partialGain=!report.gainKnown;
  return <><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Renta</h1><p>Preparación de los datos de criptoactivos para IRPF, Patrimonio, Modelo 721 y trazabilidad DAC8/CARF.</p></div></header><section className="dashboard-content renta-page">
    <section className="renta-hero panel-card"><div><span className="section-kicker">EJERCICIO FISCAL</span><h2>Informe fiscal {year}</h2><p>El informe separa los importes que pueden trasladarse al IRPF de la información patrimonial e informativa.</p><div className="renta-valuation-meta"><span>Valoración disponible: <strong>{date(latestValuation)}</strong></span><span>{latestValuation?"Última valoración registrada en CoinRenta":"Sin valoración registrada"}</span></div></div><div className="renta-year-switcher" aria-label="Ejercicio fiscal">{yearLinks.map(item=><Link key={item.value} href={item.href} className={item.value===year?"selected":""}>{item.value}</Link>)}</div></section>
    <section className="renta-stat-grid">
      <article className={`stat-card ${partialGain?"stat-card-warning":""}`}><span className="stat-label">Ganancia / pérdida cripto</span><strong>{money(report.gain)}</strong><span className="stat-note">{partialGain?"Cálculo parcial: se excluyen operaciones pendientes de revisión.":"Transmisiones y permutas calculadas por operación."}</span>{partialGain&&<small className="renta-warning-inline">Resultado provisional y meramente informativo; no constituye una determinación fiscal vinculante.</small>}</article>
      <article className="stat-card"><span className="stat-label">Valor de transmisión</span><strong>{money(report.proceeds)}</strong><span className="stat-note">Operaciones con contraprestación EUR conocida</span></article>
      <article className="stat-card"><span className="stat-label">Coste de adquisición</span><strong>{money(report.costBasis)}</strong><span className="stat-note">Lotes aplicados con criterio FIFO</span></article>
      <article className={`stat-card ${issues.filter((i:any)=>i.code!=="info"&&i.code!=="info-foreign").length?"stat-card-accent":""}`}><span className="stat-label">Incidencias</span><strong>{issues.filter((i:any)=>i.code!=="info"&&i.code!=="info-foreign").length}</strong><span className="stat-note">Incidencias que requieren atención</span></article>
    </section>

    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">MODELO 100 · IRPF</span><h3>Ganancias y pérdidas patrimoniales</h3></div><span className="renta-badge">Renta del ahorro</span></div>
      <div className="renta-summary-grid"><div><small>Operaciones de transmisión/permutación</small><strong>{report.disposals}</strong></div><div><small>Ganancia/pérdida calculada</small><strong className={partialGain?"renta-number-warning":""}>{money(report.gain)}</strong></div><div><small>Ingresos de reward / interest / etc.</small><strong>{report.incomeKnown?money(report.incomeEur):"Parcial"}</strong></div><div><small>Comisiones fiat identificadas</small><strong>{money(report.feesEur)}</strong></div></div>
      <div className="renta-explanation"><strong>Qué se traslada al IRPF</strong><span>La cifra mostrada es un cálculo de las operaciones que CoinRenta puede valorar con los datos disponibles. Cuando existen movimientos pendientes de revisión, el sistema mantiene el importe calculable y excluye del resultado las operaciones cuyo coste no puede justificarse.</span></div>
      <div className="renta-table-wrap"><table><thead><tr><th>Magnitud</th><th>Resultado</th><th>Estado</th></tr></thead><tbody><tr><td>Valor de transmisión</td><td>{money(report.proceeds)}</td><td><span className="renta-status ok">Calculado</span></td></tr><tr><td>Coste de adquisición</td><td>{money(report.costBasis)}</td><td><span className={`renta-status ${report.unknownBasis?"warn":"ok"}`}>{report.unknownBasis?"Parcial":"FIFO"}</span></td></tr><tr><td>Ganancia / pérdida</td><td className={partialGain?"renta-number-warning":""}>{money(report.gain)}</td><td><span className={`renta-status ${partialGain?"warn":"ok"}`}>{partialGain?"Provisional":"Calculada"}</span></td></tr></tbody></table></div>
      {partialGain&&<div className="renta-provisional"><strong>Resultado provisional</strong><span>La ganancia/pérdida mostrada no incorpora las operaciones que requieren revisión. Es un cálculo orientativo y no vinculante; debe contrastarse con la documentación original y, cuando proceda, con un profesional tributario.</span></div>}
      <p className="renta-note">La aplicación no determina la cuota final del IRPF ni sustituye la revisión de la situación fiscal completa del contribuyente.</p>
    </section>

    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">PATRIMONIO · 31 DE DICIEMBRE</span><h3>Inventario patrimonial de criptoactivos</h3></div><span className={`renta-badge ${hasYearEnd?"positive":"warning"}`}>{hasYearEnd?"Valoración disponible":"Valoración pendiente"}</span></div>
      <div className="renta-summary-grid three"><div><small>Activos con saldo</small><strong>{report.positions.length}</strong></div><div><small>Valor conocido 31/12</small><strong>{money(report.positions.reduce((sum,item)=>sum+(item.valueEur||0),0))}</strong></div><div><small>Valoración consultada</small><strong>{date(latestValuation)}</strong></div></div>
      {report.positions.length?<div className="renta-table-wrap"><table><thead><tr><th>Activo</th><th>Saldo</th><th>Valor EUR</th><th>Custodia</th></tr></thead><tbody>{report.positions.map(position=><tr key={position.symbol}><td><strong>{position.name}</strong><small>{position.symbol}</small></td><td>{qty(position.quantity)}</td><td>{money(position.valueEur)}</td><td>{position.foreign?"Custodia extranjera detectada":"Revisar ubicación"}</td></tr>)}</tbody></table></div>:<div className="renta-empty">No hay posiciones calculables para este ejercicio con los datos disponibles.</div>}
      <p className="renta-note">La valoración mostrada incluye la fecha de la última valoración registrada. Para ejercicios históricos, la fecha de valoración y el cierre fiscal son conceptos distintos.</p>
    </section>

    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">MODELO 721 · MONEDAS VIRTUALES EN EL EXTRANJERO</span><h3>Comprobación de obligación informativa</h3></div><span className={`renta-badge ${report.foreignValueEur>50000?"warning":""}`}>{report.foreignValueEur>50000?"Umbral superado":"Por debajo de 50.000 € con datos actuales"}</span></div><div className="renta-summary-grid three"><div><small>Saldo extranjero conocido</small><strong>{money(report.foreignValueEur)}</strong></div><div><small>Custodios extranjeros detectados</small><strong>{foreignCustodians.length}</strong></div><div><small>Estado</small><strong>{report.foreignValueEur>50000?"Preparar Modelo 721":"No supera el umbral actual"}</strong></div></div><div className="renta-721-grid"><div><strong>Datos necesarios para el 721</strong><span>Custodio, identificación del custodio, tipo de moneda virtual, unidades y valoración en euros. La declaración es individualizada por moneda virtual.</span></div><div><strong>Regla de repetición</strong><span>Después de una primera declaración, la presentación vuelve a ser obligatoria cuando el saldo conjunto extranjero aumenta más de 20.000 € respecto del que originó la última declaración, y también en determinados supuestos de extinción de la titularidad.</span></div></div><p className="renta-note">El umbral de 50.000 € se aplica al saldo conjunto de monedas virtuales situadas en el extranjero en los supuestos previstos por el artículo 42 quater RGAT.</p></section>

    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">DAC8 · CARF · MiCA</span><h3>Trazabilidad y correspondencia regulatoria</h3></div><span className="renta-badge neutral">No son modelos del usuario</span></div><div className="renta-framework-grid"><div><strong>DAC8</strong><span>Los proveedores obligados comunican información sobre usuarios, criptoactivos y operaciones sujetas a comunicación.</span><b>CoinRenta conserva compras, ventas, permutas, transferencias, activos, fechas, importes y contraprestación.</b></div><div><strong>CARF</strong><span>El marco OCDE contempla operaciones cripto/fiat, cripto/cripto y transferencias.</span><b>CoinRenta separa operaciones, transferencias e ingresos para facilitar su conciliación.</b></div><div><strong>MiCA</strong><span>MiCA regula emisores y proveedores de servicios de criptoactivos. No determina por sí mismo la cuota de IRPF.</span><b>La referencia se usa para contextualizar el marco regulatorio del proveedor.</b></div></div></section>

    <section className="renta-section panel-card"><div className="panel-head"><div><span className="section-kicker">CONTROL DE CALIDAD</span><h3>{issues.length?"El informe requiere revisión antes de declarar":"Datos preparados para revisión"}</h3></div><span className={`renta-badge ${issues.some((i:any)=>i.code!=="info"&&i.code!=="info-foreign")?"warning":"positive"}`}>{issues.some((i:any)=>i.code!=="info"&&i.code!=="info-foreign")?`${issues.filter((i:any)=>i.code!=="info"&&i.code!=="info-foreign").length} acciones pendientes":"Sin acciones pendientes"}</span></div><QualityControl issues={issues}/><div className="renta-data-foot"><span>Transacciones del ejercicio: <strong>{selectedTransactions.length}</strong></span><span>Transacciones históricas analizadas: <strong>{transactions.length}</strong></span><span>Última actualización fiscal: <strong>{taxYearStored?.updated_at?date(taxYearStored.updated_at):"No registrada"}</strong></span></div></section>

    <section className="renta-disclaimer"><strong>Aviso importante sobre el carácter informativo</strong><p>La información, cálculos, estimaciones y resultados proporcionados por CoinRenta tienen carácter exclusivamente informativo y orientativo. CoinRenta no constituye un servicio de asesoramiento fiscal, contable ni jurídico y no sustituye la revisión de la documentación original ni el asesoramiento de un profesional cualificado. Los datos importados pueden contener errores, omisiones, formatos incompatibles o información incompleta, y los cálculos de la aplicación pueden no reflejar todas las circunstancias fiscales aplicables al contribuyente. El usuario es responsable de verificar la exactitud de la información y de sus obligaciones tributarias antes de presentar cualquier declaración. CoinRenta no garantiza la exactitud, integridad o adecuación de los resultados para una situación fiscal concreta y no asume responsabilidad por decisiones, declaraciones, liquidaciones, sanciones, recargos, intereses o cualquier otro perjuicio derivado del uso de la información proporcionada por la aplicación.</p></section>
  </section></>;
}
