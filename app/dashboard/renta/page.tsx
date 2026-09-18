import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LocalWorkspace, { type LocalConnection } from '../local-workspace';

export const metadata: Metadata = { title: 'Renta', description: 'Preparación fiscal de criptoactivos.', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function RentaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const params = await searchParams;
  const requested = Number(params.year);
  const currentYear = new Date().getFullYear();
  const year = Number.isInteger(requested) && requested >= 2020 && requested <= currentYear ? requested : currentYear;
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('role,subscription_plan').eq('id', user.id).maybeSingle(),
    supabase.from('exchange_connections').select('id,label,provider_type,status,last_sync_at,last_sync_status,exchange_id,exchanges(code,name)').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  const connections: LocalConnection[] = (rows || []).map((row: any) => { const exchange = Array.isArray(row.exchanges) ? row.exchanges[0] : row.exchanges; return { id: String(row.id), label: row.label || null, provider_type: row.provider_type || null, status: row.status || null, last_sync_at: row.last_sync_at || null, last_sync_status: row.last_sync_status || null, exchange: String(exchange?.code || 'exchange').toLowerCase(), exchangeName: String(exchange?.name || 'Exchange') }; });
  const plan = profile?.role === 'admin' ? 'admin' : profile?.subscription_plan === 'pro' ? 'pro' : profile?.subscription_plan === 'essential' ? 'essential' : 'free';
  return <LocalWorkspace userId={user.id} connections={connections} mode="renta" plan={plan} isPro={plan === 'pro' || plan === 'admin'} year={year} />;
}
