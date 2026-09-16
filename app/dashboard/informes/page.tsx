import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReportsCenter from './reports-center';

export const metadata: Metadata = { title: 'Informes', description: 'Informes y herramientas fiscales de CoinRenta.', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('display_name,role,subscription_plan').eq('id', user.id).maybeSingle(),
    supabase.from('exchange_connections').select('id,label,status,provider_type,exchange_id,exchanges(code,name)').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);
  const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
  const connections = (rows || []).map((row: any) => { const exchange = one(row.exchanges); return { id: String(row.id), label: row.label || null, exchange: String(exchange?.code || 'exchange').toLowerCase(), exchangeName: String(exchange?.name || 'Exchange'), status: row.status || null }; });
  const plan = profile?.role === 'admin' ? 'Admin' : profile?.subscription_plan === 'pro' ? 'Pro' : profile?.subscription_plan === 'essential' ? 'Esencial' : 'Free';
  return <><header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>Informes</h1><p>Documentación fiscal y herramientas de análisis construidas sobre tu histórico.</p></div></header><section className="dashboard-content reports-content"><ReportsCenter userId={user.id} connections={connections} displayName={profile?.display_name || user.email || null} plan={plan}/></section></>;
}
