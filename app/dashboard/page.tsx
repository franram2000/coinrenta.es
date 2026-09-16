import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LocalWorkspace, { type LocalConnection } from './local-workspace';

export const metadata: Metadata = { title: 'Centro de Mando Fiscal', description: 'Centro de Mando Fiscal de CoinRenta.', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('display_name,role,subscription_plan,subscription_interval').eq('id', user.id).maybeSingle(),
    supabase.from('exchange_connections').select('id,label,provider_type,status,last_sync_at,last_sync_status,exchange_id,exchanges(code,name)').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  const connections: LocalConnection[] = (rows || []).map((row: any) => {
    const exchange = Array.isArray(row.exchanges) ? row.exchanges[0] : row.exchanges;
    return { id: String(row.id), label: row.label || null, provider_type: row.provider_type || null, status: row.status || null, last_sync_at: row.last_sync_at || null, last_sync_status: row.last_sync_status || null, exchange: String(exchange?.code || 'exchange').toLowerCase(), exchangeName: String(exchange?.name || 'Exchange') };
  });
  const plan = profile?.role === 'admin' ? 'admin' : (profile?.subscription_plan || 'free');
  const isPro = plan === 'pro' || profile?.role === 'admin';
  return <div><div style={{display:'flex',justifyContent:'flex-end',padding:'18px 28px 0'}}><Link href="/dashboard/suscripcion" className="panel-link" style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 13px',border:'1px solid rgba(15,167,160,.24)',borderRadius:10,background:'rgba(15,167,160,.06)',color:'#69d9d1',fontSize:10,fontWeight:850,textDecoration:'none'}}>✦ Ver suscripción · {plan === 'admin' ? 'Admin' : plan === 'pro' ? 'Pro' : plan === 'essential' ? 'Esencial' : 'Free'} →</Link></div><LocalWorkspace userId={user.id} connections={connections} mode="resumen" isPro={isPro} displayName={profile?.display_name || null} /></div>;
}
