"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { importKrakenCsvConnection, refreshWithKrakenBalances } from "./kraken-balance-actions";
import { importCsvConnection } from "./csv-actions";
import { repairAllCsvBalances } from "./balance-repair";

const CSV_CODES = new Set(["bitpanda", "binance", "coinbase", "kraken", "crypto.com", "cryptocom", "kucoin", "bybit", "okx"]);
type Exchange = { id: string; code: string; name: string; website: string | null };
type Props = { exchanges: Exchange[]; connections: unknown[] };

function csvSupported(code: string) { return CSV_CODES.has(code.toLowerCase()); }
function csvHelp(code: string) {
  switch (code.toLowerCase()) {
    case "binance": return "Puedes subir varios CSV de Binance (transacciones, depósitos y retiradas); CoinRenta los consolida y evita duplicados.";
    case "kraken": return "Sube Trades y/o Ledgers en CSV para cubrir operaciones, depósitos, retiradas, fees y Earn.";
    case "crypto.com":
    case "cryptocom": return "Puedes subir los CSV de Wallet Transactions, depósitos/retiradas y operaciones.";
    case "kucoin": return "Sube Trade Records y/o Account Ledger, depósitos y retiradas exportados por KuCoin.";
    case "bybit": return "Sube el Transaction Log y, cuando corresponda, el Order History exportado por Bybit.";
    case "okx": return "Sube el Account Statement o Ledger exportado por OKX.";
    default: return "Sube el histórico CSV oficial del exchange. Se conservará cada registro original.";
  }
}

export default function ExchangeManager({ exchanges }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Exchange | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function close() { if (!isPending) { setOpen(false); setSelected(null); } }
  function submitCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const isKraken = selected?.code.toLowerCase() === "kraken";
    setError(null); setMessage("Importando, corrigiendo saldos y comprobando tus CSV…");
    startTransition(async () => {
      try {
        const result = isKraken ? await importKrakenCsvConnection(data) : await importCsvConnection(data);
        await repairAllCsvBalances();
        router.refresh(); setOpen(false); setSelected(null);
        setMessage(`✓ ${result.rows.toLocaleString("es-ES")} movimientos importados y saldos recalculados.`);
        window.setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo importar el CSV."); setMessage(null); router.refresh();
      }
    });
  }
  function refresh() {
    setError(null); setMessage("Recalculando saldos y actualizando la vista…");
    startTransition(async () => {
      try { await refreshWithKrakenBalances(); await repairAllCsvBalances(); router.refresh(); setMessage("✓ Saldos y vista actualizados."); window.setTimeout(() => setMessage(null), 1600); }
      catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar."); setMessage(null); }
    });
  }
  return <>
    <div className="exchange-actions">
      <button className="btn btn-outline exchange-action" type="button" onClick={refresh} disabled={isPending}><span className={isPending ? "connection-spinner" : ""}>↻</span>{isPending ? "Trabajando…" : "Actualizar"}</button>
      <button className="btn btn-primary exchange-action" type="button" onClick={() => { setOpen(true); setSelected(null); setError(null); setMessage(null); }} disabled={isPending}><span>＋</span>Añadir exchange</button>
    </div>
    {(message || error) && <div className={`connection-action-feedback ${error ? "is-error" : message?.startsWith("✓") ? "is-success" : ""}`} role="status" aria-live="polite">{!error && !message?.startsWith("✓") && <span className="connection-feedback-spinner" />}<span>{error || message}</span></div>}
    {open && <div className="exchange-modal-backdrop" role="presentation" onMouseDown={close}>
      <div className="exchange-modal" role="dialog" aria-modal="true" aria-labelledby="exchange-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="exchange-modal-head"><div><span className="section-kicker">Nueva conexión</span><h2 id="exchange-modal-title">{selected ? selected.name : "Elige tu exchange"}</h2><p>{selected ? "Importa tu histórico mediante CSV. No necesitas proporcionar claves API." : "Selecciona un exchange para continuar."}</p></div><button className="exchange-modal-close" type="button" onClick={close} disabled={isPending} aria-label="Cerrar">×</button></div>
        {!selected ? <div className="exchange-grid">{exchanges.map((exchange) => { const supported = csvSupported(exchange.code); return <div className={`exchange-card ${supported ? "" : "exchange-card-disabled"}`} key={exchange.id}><button className="exchange-card-main" type="button" onClick={() => supported && setSelected(exchange)} disabled={!supported || isPending}><span className="exchange-logo">{exchange.name.slice(0, 1).toUpperCase()}</span><span className="exchange-card-copy"><strong>{exchange.name}</strong><small>{supported ? "CSV disponible" : "Próximamente"}</small></span><span className="exchange-arrow">›</span></button>{supported && <div className="exchange-card-api-disabled"><span>API</span><b>No disponible</b></div>}</div>; })}</div> : csvSupported(selected.code) ? <div className="exchange-methods">
          <form className="exchange-connect-form" onSubmit={submitCsv}>
            <input type="hidden" name="exchange_id" value={selected.id} /><input type="hidden" name="provider_type" value="csv" />
            <div className="exchange-method-card"><div><span className="exchange-method-icon">⇧</span><div><strong>Importar histórico CSV</strong><small>{csvHelp(selected.code)}</small></div></div>
              <label>Nombre de la cuenta<input name="label" placeholder={`Ej. ${selected.name} principal`} disabled={isPending} /></label>
              <label>Archivos CSV<input name="files" type="file" accept=".csv,text/csv" multiple required disabled={isPending} /><small className="form-help">Selecciona uno o varios CSV del mismo exchange. Las filas no clasificables se guardan como «other» junto con su tipo original para revisión; no se descartan silenciosamente.</small></label>
              <button className="btn btn-primary" type="submit" disabled={isPending}>{isPending ? <><span className="button-spinner"/>Procesando…</> : "Importar CSV"}</button>
            </div>
          </form>
          <div className="exchange-api-locked"><span className="exchange-method-icon">⌁</span><div><strong>Conectar por API</strong><small>Temporalmente deshabilitado. CoinRenta no solicita ni almacena credenciales API.</small></div><span className="exchange-locked-badge">Próximamente</span></div>
        </div> : null}
        {selected && <button className="exchange-back" type="button" onClick={() => setSelected(null)} disabled={isPending}>← Volver a exchanges</button>}
      </div>
    </div>}
  </>;
}
