"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addExchangeConnection, resyncAllExchanges } from "./actions";
import { addBitpandaApiConnection, syncBitpandaConnection } from "./connection-actions";

type Exchange = { id: string; code: string; name: string; website: string | null };
type Props = { exchanges: Exchange[]; connections: unknown[] };

export default function ExchangeManager({ exchanges }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Exchange | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bitpanda = selected?.code.toLowerCase() === "bitpanda";

  function close() {
    if (isPending) return;
    setOpen(false);
    setSelected(null);
  }

  function submitApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setMessage("Conexión creada. Sincronizando Bitpanda…");
    setOpen(false);
    setSelected(null);

    startTransition(async () => {
      try {
        const result = await addBitpandaApiConnection(formData);
        router.refresh();
        await syncBitpandaConnection(result.connectionId);
        router.refresh();
        setMessage("✓ Bitpanda conectado y sincronizado correctamente.");
        window.setTimeout(() => setMessage(null), 1800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear o sincronizar la conexión.");
        setMessage(null);
        router.refresh();
      }
    });
  }

  function submitCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setMessage("Importación iniciada. Procesando el histórico…");
    setOpen(false);
    setSelected(null);

    startTransition(async () => {
      try {
        await addExchangeConnection(formData);
        router.refresh();
        setMessage("✓ Histórico de Bitpanda importado correctamente.");
        window.setTimeout(() => setMessage(null), 1800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo importar el CSV.");
        setMessage(null);
        router.refresh();
      }
    });
  }

  function resync() {
    setMessage("Resincronizando tus exchanges…");
    setError(null);
    startTransition(async () => {
      try {
        await resyncAllExchanges();
        router.refresh();
        setMessage("✓ Resincronización completada.");
        window.setTimeout(() => setMessage(null), 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo resincronizar.");
        setMessage(null);
        router.refresh();
      }
    });
  }

  return <>
    <div className="exchange-actions">
      <button className="btn btn-outline exchange-action" type="button" onClick={resync} disabled={isPending}>
        <span className={isPending ? "connection-spinner" : ""}>↻</span>{isPending ? "Trabajando…" : "Resincronizar"}
      </button>
      <button className="btn btn-primary exchange-action" type="button" onClick={() => { setOpen(true); setSelected(null); setError(null); setMessage(null); }} disabled={isPending}>
        <span>＋</span>Añadir conexión
      </button>
    </div>

    {(message || error) && <div className={`connection-action-feedback ${error ? "is-error" : message?.startsWith("✓") ? "is-success" : ""}`} role="status" aria-live="polite">
      {!error && !message?.startsWith("✓") && <span className="connection-feedback-spinner" />}
      <span>{error || message}</span>
    </div>}

    {open && <div className="exchange-modal-backdrop" role="presentation" onMouseDown={close}>
      <div className="exchange-modal" role="dialog" aria-modal="true" aria-labelledby="exchange-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="exchange-modal-head"><div><span className="section-kicker">Nueva conexión</span><h2 id="exchange-modal-title">{selected ? selected.name : "Elige tu exchange"}</h2><p>{selected ? "Selecciona cómo quieres importar tus datos." : "Selecciona un exchange para continuar."}</p></div><button className="exchange-modal-close" type="button" onClick={close} disabled={isPending} aria-label="Cerrar">×</button></div>
        {!selected ? <div className="exchange-grid">{exchanges.map((exchange) => { const supported = exchange.code.toLowerCase() === "bitpanda"; return <button className={`exchange-card ${supported ? "" : "exchange-card-disabled"}`} type="button" key={exchange.id} onClick={() => supported && setSelected(exchange)} disabled={!supported || isPending}><span className="exchange-logo">{exchange.name.slice(0, 1).toUpperCase()}</span><span className="exchange-card-copy"><strong>{exchange.name}</strong><small>{supported ? "API · CSV" : "Próximamente"}</small></span><span className="exchange-arrow">›</span></button>; })}</div> : bitpanda ? <div className="exchange-methods">
          <form className="exchange-connect-form" onSubmit={submitApi}><input type="hidden" name="exchange_id" value={selected.id} /><input type="hidden" name="provider_type" value="api" /><div className="exchange-method-card"><div><span className="exchange-method-icon">⌁</span><div><strong>Conectar por API</strong><small>Recomendado · sincronización automática</small></div></div><label>Nombre de la cuenta<input name="label" placeholder={`Ej. ${selected.name} principal`} disabled={isPending} /></label><label>Clave API<input name="api_key" type="password" autoComplete="new-password" required placeholder="Clave API de solo lectura" disabled={isPending} /></label><button className="btn btn-primary" type="submit" disabled={isPending}>{isPending ? <><span className="button-spinner"/>Conectando…</> : "Conectar por API"}</button></div></form>
          <form className="exchange-connect-form" onSubmit={submitCsv}><input type="hidden" name="exchange_id" value={selected.id} /><input type="hidden" name="provider_type" value="csv" /><div className="exchange-method-card"><div><span className="exchange-method-icon">⇧</span><div><strong>Importar un CSV</strong><small>Para importar un histórico existente</small></div></div><label>Nombre de la cuenta<input name="label" placeholder={`Ej. ${selected.name} histórico`} disabled={isPending} /></label><label>Archivo CSV<input name="file" type="file" accept=".csv,text/csv" required disabled={isPending} /></label><button className="btn btn-outline" type="submit" disabled={isPending}>{isPending ? <><span className="button-spinner"/>Importando…</> : "Importar CSV"}</button></div></form>
        </div> : null}
        {selected && <button className="exchange-back" type="button" onClick={() => setSelected(null)} disabled={isPending}>← Volver a exchanges</button>}
      </div>
    </div>}
  </>;
}
