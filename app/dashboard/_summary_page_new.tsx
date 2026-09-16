import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SummaryDashboardV2, { type SummaryConnection } from './summary-dashboard-v2';
export const metadata: Metadata = { title: 'Centro de Mando Fiscal', description: 'Centro de Mando Fiscal de CoinRenta.', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('display_name,role,subscription_plan,subscription_interval').eq('id', user.id).maybeSingle(),
    supabase.from('exchange_connections').select('id,label,status,last_sync_at,exchange_id,exchanges(code,name)').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  const connections: SummaryConnection[] = (rows || []).map((row: any) => { const exchange = Array.isArray(row.exchanges) ? row.exchanges[0] : row.exchanges; return { id: String(row.id), label: row.label || null, exchangeName: String(exchange?.name || 'Exchange'), status: row.status || null, lastSyncAt: row.last_sync_at || null }; });
  const role = profile?.role || 'free';
  const plan = role === 'admin' ? 'admin' : (profile?.subscription_plan || 'free') as 'free' | 'essential' | 'pro';
  return <SummaryDashboardV2 userId={user.id} connections={connections} displayName={profile?.display_name || null} plan={plan} />;
}
