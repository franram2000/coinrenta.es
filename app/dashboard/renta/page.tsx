import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LocalWorkspace, { type LocalConnection } from './local-workspace';

export const metadata: Metadata = { title: 'Renta', description: 'Preparación fiscal de criptoactivos.', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function RentaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const params = await searchParams;
  const requested = Number(params.year);
  const year = Number.isInteger(requested) && requested >= 2020 && requested <= 2030 ? requested : 2025;

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('exchange_connections').select('id,label,provider_type,status,last_sync_at,last_sync_status,exchange_id,exchanges(code,name)').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);

  const connections: LocalConnection[] = (rows || []).map((row: any) => {
    const exchange = Array.isArray(row.exchanges) ? row.exchanges[0] : row.exchanges;
    return { id: String(row.id), label: row.label || null, provider_type: row.provider_type || null, status: row.status || null, last_sync_at: row.last_sync_at || null, last_sync_status: row.last_sync_status || null, exchange: String(exchange?.code || 'exchange').toLowerCase(), exchangeName: String(exchange?.name || 'Exchange') };
  });
  return <LocalWorkspace userId={user.id} connections={connections} mode="renta" isPro={profile?.role === 'pro' || profile?.role === 'admin'} year={year} />;
}
