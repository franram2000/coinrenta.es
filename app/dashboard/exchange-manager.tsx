"use client";

import { useState } from "react";
import { addExchangeConnection, deleteExchangeConnection, resyncAllExchanges } from "./actions";

type Exchange = { id: string; code: string; name: string; website: string | null };
type Connection = { id: string; exchange_id: string; label: string | null; status: string; last_sync_at: string | null; last_sync_status: string | null; last_sync_error: string | null; api_secret_id: string | null; provider_type: string; exchanges: { name: string; code: string } | { name: string; code: string }[] | null };
type Props = { exchanges: Exchange[]; connections: Connection[] };

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Nunca"; }
function statusLabel(c: Connection) { if (c.status === "error" || c.last_sync_status === "error") return "Error"; if (c.status === "pending") return "Pendiente"; return "Conectado"; }

export default function ExchangeManager({ exchanges, connections }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Exchange | null>(null);
  const bitpanda = selected?.code.toLowerCase() === "bitpanda";
  function close() { setOpen(false); setSelected(null); }

  return <>
    <div className="exchange-actions">
      <form action={resyncAllExchanges}><button className="btn btn-outline exchange-action" type="submit"><span>↻</span>Resincronizar</button></form>
      <button className="btn btn-primary exchange-action" type="button" onClick={() => setOpen(true)}><span>＋</span>Añadir conexión</button>
    </div>

    <div className="connected-exchanges" aria-label="Conexiones activas">
      {connections.length ? connections.map((connection) => {
        const exchange = Array.isArray(connection.exchanges) ? connection.exchanges[0] : connection.exchanges;
        const status = statusLabel(connection);
        return <article className="connected-exchange-card" key={connection.id}>
          <div className="connected-exchange-head">
            <div className="connected-exchange-brand"><span className="connected-exchange-logo">{(exchange?.name || "E").slice(0, 1).toUpperCase()}</span><div><strong>{exchange?.name || "Exchange"}</strong><span>{connection.label || "Sin nombre"}</span></div></div>
            <span className={`connection-status connection-status-${status.toLowerCase()}`}><i />{status}</span>
          </div>
          <div className="connected-exchange-info">
            <div><small>Método</small><strong>{connection.provider_type === "csv" ? "Importación CSV" : "API · Solo lectura"}</strong></div>
            <div><small>Última sincronización</small><strong>{formatDate(connection.last_sync_at)}</strong></div>
            <div><small>Identificador</small><strong>{connection.id.slice(0, 8)}…</strong></div>
          </div>
          {connection.last_sync_error && <div className="connection-error">{connection.last_sync_error}</div>}
          <div className="connected-exchange-footer">
            <span>{connection.provider_type === "api" && connection.api_secret_id ? "Credenciales guardadas de forma segura" : "Datos importados desde CSV"}</span>
            <form action={deleteExchangeConnection} onSubmit={(event) => { if (!window.confirm(`¿Seguro que quieres borrar la conexión de ${exchange?.name || "este exchange"}? También se eliminarán sus movimientos y cuenta asociada.`)) event.preventDefault(); }}>
              <input type="hidden" name="connection_id" value={connection.id} />
              <button className="connection-delete" type="submit">Eliminar conexión</button>
            </form>
          </div>
        </article>;
      }) : <div className="connected-exchanges-empty"><strong>Aún no tienes conexiones.</strong><span>Añade tu primer exchange para empezar a sincronizar tus movimientos.</span></div>}
    </div>

    {open && <div className="exchange-modal-backdrop" role="presentation" onMouseDown={close}>
      <div className="exchange-modal" role="dialog" aria-modal="true" aria-labelledby="exchange-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="exchange-modal-head"><div><span className="section-kicker">Nueva conexión</span><h2 id="exchange-modal-title">{selected ? selected.name : "Elige tu exchange"}</h2><p>{selected ? "Selecciona cómo quieres importar tus datos." : "Selecciona un exchange para continuar."}</p></div><button className="exchange-modal-close" type="button" onClick={close} aria-label="Cerrar">×</button></div>
        {!selected ? <div className="exchange-grid">{exchanges.map((exchange) => { const supported = exchange.code.toLowerCase() === "bitpanda"; return <button className={`exchange-card ${supported ? "" : "exchange-card-disabled"}`} type="button" key={exchange.id} onClick={() => supported && setSelected(exchange)} disabled={!supported}><span className="exchange-logo">{exchange.name.slice(0, 1).toUpperCase()}</span><span className="exchange-card-copy"><strong>{exchange.name}</strong><small>{supported ? "API · CSV" : "Próximamente"}</small></span><span className="exchange-arrow">›</span></button>; })}</div> : bitpanda ? <div className="exchange-methods">
          <form action={addExchangeConnection} className="exchange-connect-form" onSubmit={() => setOpen(false)}><input type="hidden" name="exchange_id" value={selected.id} /><input type="hidden" name="provider_type" value="api" /><div className="exchange-method-card"><div><span className="exchange-method-icon">⌁</span><div><strong>Conectar por API</strong><small>Recomendado · sincronización automática</small></div></div><label>Nombre de la cuenta<input name="label" placeholder={`Ej. ${selected.name} principal`} /></label><label>Clave API<input name="api_key" type="password" autoComplete="new-password" required placeholder="Clave API de solo lectura" /></label><button className="btn btn-primary" type="submit">Conectar por API</button></div></form>
          <form action={addExchangeConnection} className="exchange-connect-form"><input type="hidden" name="exchange_id" value={selected.id} /><input type="hidden" name="provider_type" value="csv" /><div className="exchange-method-card"><div><span className="exchange-method-icon">⇧</span><div><strong>Importar un CSV</strong><small>Para importar un histórico existente</small></div></div><label>Nombre de la cuenta<input name="label" placeholder={`Ej. ${selected.name} histórico`} /></label><label>Archivo CSV<input name="file" type="file" accept=".csv,text/csv" required /></label><button className="btn btn-outline" type="submit">Importar CSV</button></div></form>
        </div> : null}
        {selected && <button className="exchange-back" type="button" onClick={() => setSelected(null)}>← Volver a exchanges</button>}
      </div>
    </div>}
  </>;
}
