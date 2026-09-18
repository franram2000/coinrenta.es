import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canonicalizeNormalizedMovements } from '@/lib/exchanges/canonicalize';
import { decodeExchangeCsv, normalizeExchangeCsv, type NormalizedMovement } from '@/lib/exchanges/csv';

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${headers.map(escapeCsv).join(',')}\n${rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')).join('\n')}`;
}

function movementKey(movement: NormalizedMovement) {
  return movement.externalId || [movement.occurredAt, movement.transactionType, movement.baseAsset, movement.baseAmount, movement.quoteAsset, movement.quoteAmount, movement.feeAsset, movement.feeAmount].join('|');
}

async function loadLegacySourceRows(supabase: any, userId: string, accountId: string) {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id,raw_data')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('occurred_at', { ascending: true });
  if (error) throw new Error(error.message);
  const grouped = new Map<string, Record<string, string>[]>();
  for (const tx of txs || []) {
    const raw = tx.raw_data && typeof tx.raw_data === 'object' ? tx.raw_data : {};
    const row = raw.row && typeof raw.row === 'object' ? raw.row : null;
    if (!row) continue;
    const file = String(raw.sourceFile || 'legacy-import.csv');
    const list = grouped.get(file) || [];
    list.push(row as Record<string, string>);
    grouped.set(file, list);
  }
  return grouped;
}

async function purgeDerived(supabase: any, userId: string, accountIds: string[]) {
  for (const table of ['balance_snapshots', 'transactions']) {
    const query = supabase.from(table).delete().eq('user_id', userId);
    const { error } = accountIds.length ? await query.in('account_id', accountIds) : { error: null };
    if (error) throw new Error(`No se pudo limpiar ${table}: ${error.message}`);
  }
  for (const table of ['tax_disposals', 'tax_lots', 'tax_years']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error && !String(error.message).toLowerCase().includes('does not exist')) {
      throw new Error(`No se pudo limpiar ${table}: ${error.message}`);
    }
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,subscription_plan,subscription_status')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const canUseApi = profile?.role === 'admin'
    || profile?.role === 'pro'
    || (profile?.subscription_plan === 'pro' && ['active', 'trialing', 'past_due'].includes(String(profile?.subscription_status || '')));

  const url = new URL(request.url);
  const connectionId = String(url.searchParams.get('connection_id') || '').trim();
  if (!connectionId) return NextResponse.json({ error: 'Falta connection_id.' }, { status: 400 });

  const { data: connection, error: connectionError } = await supabase
    .from('exchange_connections')
    .select('id,exchange_id,provider_type,last_sync_at,status,exchanges(code,name)')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  if (!connection) return NextResponse.json({ error: 'Conexión no encontrada.' }, { status: 404 });

  const exchange = Array.isArray(connection.exchanges) ? connection.exchanges[0] : connection.exchanges;
  const exchangeCode = String(exchange?.code || '').toLowerCase();
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('id,name,is_active')
    .eq('user_id', user.id)
    .eq('connection_id', connectionId)
    .eq('is_active', true);
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  const accountIds = (accounts || []).map((item: { id: string }) => String(item.id));
  if (!accountIds.length) return NextResponse.json({ error: 'La conexión no tiene una cuenta activa.' }, { status: 409 });

  if (connection.provider_type === 'api') {
    if (!canUseApi) {
      return NextResponse.json({ error: 'La importación por API requiere un plan Pro o una cuenta Admin.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'La sincronización API de este exchange todavía no tiene un conector fiscal activo.' }, { status: 409 });
  }

  const { data: imports, error: importsError } = await supabase
    .from('imports')
    .select('id,account_id,file_name,status,source_content,source_sha256')
    .eq('user_id', user.id)
    .in('account_id', accountIds)
    .eq('source_type', 'csv')
    .order('imported_at', { ascending: true });
  if (importsError) return NextResponse.json({ error: importsError.message }, { status: 500 });

  const missingImports = ((imports || []) as any[]).filter((item) => !item.source_content);
  if (missingImports.length) {
    const recovered = new Map<string, Record<string, string>[]>();
    for (const accountId of accountIds) {
      const grouped = await loadLegacySourceRows(supabase, user.id, accountId);
      for (const [file, rows] of grouped) {
        const existing = recovered.get(file) || [];
        recovered.set(file, [...existing, ...rows]);
      }
    }

    for (const item of missingImports) {
      const rows = recovered.get(String(item.file_name)) || recovered.get('legacy-import.csv') || [];
      if (!rows.length) continue;
      const sourceContent = toCsv(rows);
      const sha = createHash('sha256').update(sourceContent).digest('hex');
      const { error } = await supabase.from('imports').update({ source_content: sourceContent, source_sha256: sha }).eq('id', item.id).eq('user_id', user.id);
      if (error) return NextResponse.json({ error: `No se pudo migrar el CSV ${item.file_name}: ${error.message}` }, { status: 500 });
    }
  }

  const { data: finalImports, error: finalImportsError } = await supabase
    .from('imports')
    .select('id,account_id,file_name,status,source_content,source_sha256')
    .eq('user_id', user.id)
    .in('account_id', accountIds)
    .eq('source_type', 'csv')
    .order('imported_at', { ascending: true });
  if (finalImportsError) return NextResponse.json({ error: finalImportsError.message }, { status: 500 });

  const movements = new Map<string, NormalizedMovement & { accountId: string | null }>();
  for (const item of finalImports || []) {
    if (!item.source_content) continue;
    let parsed: NormalizedMovement[];
    try {
      parsed = canonicalizeNormalizedMovements(normalizeExchangeCsv(exchangeCode, decodeExchangeCsv(new TextEncoder().encode(item.source_content).buffer), String(item.file_name || 'source.csv')), exchangeCode);
    } catch (error) {
      return NextResponse.json({ error: `No se pudo interpretar ${item.file_name}: ${error instanceof Error ? error.message : 'formato no compatible'}` }, { status: 422 });
    }
    for (const movement of parsed) {
      const key = `${item.id}:${movementKey(movement)}`;
      movements.set(key, { ...movement, accountId: String(item.account_id || '') || null });
    }
  }

  await purgeDerived(supabase, user.id, accountIds);

  const importFingerprint = (finalImports || []).map((item) => `${item.id}:${item.source_sha256 || 'legacy'}`).join('|');
  const sourceVersion = `fiscal-v5:${connection.last_sync_at || ''}:${createHash('sha256').update(importFingerprint).digest('hex').slice(0, 16)}`;
  return NextResponse.json({
    connectionId,
    exchange: exchangeCode,
    sourceVersion,
    fetchedAt: new Date().toISOString(),
    movements: [...movements.values()],
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
