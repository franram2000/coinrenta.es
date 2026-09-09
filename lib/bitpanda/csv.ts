export type BitpandaCsvRow = Record<string,string>;

function clean(value: string | undefined) { return (value ?? "").replace(/^\uFEFF/, "").trim(); }
function key(value: string) { return clean(value).toLowerCase().replace(/[\s_\-/()]+/g, ""); }
function num(value: string) { const v=clean(value).replace(/[^0-9,.-]/g,""); if(!v||v==='-') return null; const normalized=v.includes(",")&&v.includes(".")?(v.lastIndexOf(",")>v.lastIndexOf(".")?v.replace(/\./g,"").replace(",","."):v.replace(/,/g,"")):v.replace(",","."); const n=Number(normalized); return Number.isFinite(n)?n:null; }

export function parseBitpandaCsv(text: string) {
  const lines=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  const headerIndex=lines.findIndex(line=>line.toLowerCase().includes("transaction id")&&line.toLowerCase().includes("transaction type"));
  if(headerIndex<0) throw new Error("No parece un CSV de historial de Bitpanda: no se encontró la cabecera Transaction ID / Transaction Type.");
  const header=lines[headerIndex]; const delimiter=header.includes(";")?";":header.includes("\t")?"\t":",";
  const headers=parseLine(header,delimiter).map(clean); const rows:BitpandaCsvRow[]=[];
  for(let i=headerIndex+1;i<lines.length;i++){ if(!lines[i].trim()) continue; const cells=parseLine(lines[i],delimiter); const row:BitpandaCsvRow={}; headers.forEach((h,j)=>row[h]=clean(cells[j])); if(Object.values(row).some(Boolean)) rows.push(row); }
  return rows;
}

export function normalizeBitpandaCsv(rows: BitpandaCsvRow[]) {
  return rows.map((row,index)=>{
    const map=new Map(Object.entries(row).map(([k,v])=>[key(k),clean(v)]));
    const type=(map.get("transactiontype")||"unknown").toLowerCase();
    const direction=(map.get("inout")||"").toLowerCase();
    const asset=map.get("asset")||map.get("cryptocurrency")||"";
    const fiat=map.get("fiat")||map.get("currency")||"EUR";
    const amountAsset=num(map.get("amountasset")||"");
    const amountFiat=num(map.get("amountfiat")||"");
    const fee=num(map.get("fee")||"");
    let normalizedType=type;
    if(type==="buy"||type==="sell") normalizedType=type;
    else if(type==="deposit") normalizedType=direction==="outgoing"?"withdrawal":"deposit";
    else if(type==="transfer"||type.startsWith("transfer(")) normalizedType=direction==="outgoing"?"transfer_out":"transfer_in";
    else if(type==="reward"||type==="interest"||type==="dividend"||type==="airdrop"||type==="cashback") normalizedType=type;
    return { externalId:map.get("transactionid")||`csv:${index+1}`, occurredAt:map.get("timestamp")||new Date().toISOString(), transactionType:normalizedType, direction, asset:asset||fiat, fiat, amountAsset, amountFiat, feeAsset:map.get("feeasset")||null, feeAmount:fee, price:num(map.get("assetmarketprice")||""), priceCurrency:map.get("assetmarketpricecurrency")||fiat, assetClass:map.get("assetclass")||null, raw:row };
  });
}

function parseLine(line:string, delimiter:string){ const out:string[]=[]; let cell="", quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){out.push(cell);cell="";}else cell+=ch;}out.push(cell);return out; }
