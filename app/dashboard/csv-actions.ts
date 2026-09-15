'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CSV_SUPPORTED_EXCHANGES, decodeExchangeCsv, normalizeExchangeCsv, type NormalizedMovement } from '@/lib/exchanges/csv';
import { canonicalizeNormalizedMovements } from '@/lib/exchanges/canonicalize';

const supportedCode = (value: string) => value.trim().toLowerCase();
const movementKey = (movement: NormalizedMovement) => movement.externalId || [movement.occurredAt, movement.transactionType, movement.baseAsset, movement.baseAmount, movement.quoteAsset, movement.quoteAmount, movement.feeAsset, movement.feeAmount].join('|');

async function getOrCreateCsvAccount(supabase: any, userId: string, exchange: { id: string; name?: string | null }, label: string | null) {
  let query = supabase
    .from('exchange_connections')
    .select('id,label,status,updated_at,accounts(id,name,is_active)')
    .eq('user_id', userId)
    .eq('exchange_id', exchange.id)
    .eq('provider_type', 'csv')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(20);
  query = label ? query.eq('label', label) : query.is('label', null);
  const { data: existing, error } = await query;
  if (error) throw new Error(`No se pudieron comprobar las conexiones CSV: ${error.message}`);
  for (const connection of existing || []) {
    const account = (connection.accounts || []).find((item: any) => item?.is_active !== false) || connection.accounts?.[0];
    if (account?.id) return { connectionId: String(connection.id), accountId: String(account.id) };
  }

  const { data: connection, error: connectionError } = await supabase.from('exchange_connections').insert({
    user_id: userId, exchange_id: exchange.id, label, status: 'pending', provider_type: 'csv',
  }).select('id').single();
  if (connectionError || !connection) throw new Error(connectionError?.message || 'No se pudo crear la conexión.');

  const { data: account, error: accountError } = await supabase.from('accounts').insert({
    user_id: userId, connection_id: connection.id, account_type: 'exchange', name: label || exchange.name || 'Cuenta CSV', is_active: true,
  }).select('id').single();
  if (accountError || !account) throw new Error(accountError?.message || 'No se pudo crear la cuenta.');
  return { connectionId: String(connection.id), accountId: String(account.id) };
}

function parseSource(exchangeCode: string, text: string, fileName: string) {
  const parsed = normalizeExchangeCsv(exchangeCode, text, fileName);
  const canonical = canonicalizeNormalizedMovements(parsed, exchangeCode);
  const seen = new Set<string>();
  return canonical.filter((movement) => {
    if (!movement.occurredAt || !Number.isFinite(new Date(movement.occurredAt).getTime())) {
      throw new Error(`La fila de ${fileName} tiene una fecha no interpretable.`);
    }
    const key = movementKey(movement);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function importCsvConnection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const exchangeId = String(formData.get('exchange_id') || '').trim();
  const label = String(formData.get('label') || '').trim() || null;
  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
  if (!exchangeId) throw new Error('Exchange no encontrado.');
  if (!files.length) throw new Error('Selecciona al menos un CSV.');

  const { data: exchange, error: exchangeError } = await supabase.from('exchanges').select('id,code,name').eq('id', exchangeId).eq('is_active', true).maybeSingle();
  if (exchangeError || !exchange) throw new Error(exchangeError?.message || 'Exchange no encontrado.');
  const exchangeCode = supportedCode(exchange.code);
  if (!CSV_SUPPORTED_EXCHANGES.has(exchangeCode)) throw new Error(`La importación CSV de ${exchange.name || exchangeCode} todavía no está disponible.`);

  const accountRef = await getOrCreateCsvAccount(supabase, user.id, { id: String(exchange.id), name: exchange.name }, label);
  const imported: Array<{ fileName: string; rows: number; sourceSha256: string }> = [];

  try {
    // New architecture: the server keeps only the original CSV source. Normalized
    // movements are returned once to the device and persisted in IndexedDB there.
    for (const file of files) {
      const sourceContent = decodeExchangeCsv(await file.arrayBuffer());
      const movements = parseSource(exchangeCode, sourceContent, file.name);
      const sourceSha256 = createHash('sha256').update(sourceContent).digest('hex');

      // Replacing a file name replaces only that source. Other source files remain available.
      const { data: oldImports, error: oldImportsError } = await supabase.from('imports')
        .select('id').eq('user_id', user.id).eq('account_id', accountRef.accountId).eq('source_type', 'csv').eq('file_name', file.name);
      if (oldImportsError) throw new Error(oldImportsError.message);
      const oldIds = (oldImports || []).map((item: { id: string }) => item.id);
      if (oldIds.length) {
        const { error } = await supabase.from('imports').delete().eq('user_id', user.id).in('id', oldIds);
        if (error) throw new Error(`No se pudo sustituir ${file.name}: ${error.message}`);
      }

      const { error: importError } = await supabase.from('imports').insert({
        user_id: user.id,
        account_id: accountRef.accountId,
        exchange_id: exchange.id,
        source_type: 'csv',
        file_name: file.name,
        source_content: sourceContent,
        source_sha256: sourceSha256,
        status: 'completed',
        rows_total: movements.length,
        rows_processed: movements.length,
        rows_failed: 0,
        imported_at: new Date().toISOString(),
        error_message: null,
      });
      if (importError) throw new Error(`No se pudo guardar ${file.name}: ${importError.message}`);
      imported.push({ fileName: file.name, rows: movements.length, sourceSha256 });

      if (movements.length === 0) throw new Error(`No se han encontrado movimientos en ${file.name}.`);
    }

    await supabase.from('exchange_connections').update({
      status: 'active',
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', accountRef.connectionId).eq('user_id', user.id);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/exchanges');
    revalidatePath('/dashboard/movimientos');
    revalidatePath('/dashboard/renta');
    return { success: true, connectionId: accountRef.connectionId, rows: imported.reduce((sum, item) => sum + item.rows, 0), files: imported.length, sourceVersion: imported.map((item) => item.sourceSha256).join(':') };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo importar el CSV.';
    await supabase.from('exchange_connections').update({ status: 'error', last_sync_status: 'error', last_sync_error: message, updated_at: new Date().toISOString() }).eq('id', accountRef.connectionId).eq('user_id', user.id);
    throw new Error(message);
  }
}

export async function refreshCsvConnections() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/exchanges');
  revalidatePath('/dashboard/movimientos');
  revalidatePath('/dashboard/renta');
}
