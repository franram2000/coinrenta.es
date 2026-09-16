import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { updateProfile } from '../actions';
import ExchangeManager from '../exchange-manager';
import DeleteConnectionButton from '../delete-connection-button';
import LocalWorkspace, { type LocalConnection } from '../local-workspace';

const sections: Record<string, { title: string; description: string }> = {
  exchanges: { title: 'Conexiones', description: 'Gestiona tus exchanges e importa sus movimientos mediante CSV.' },
  movimientos: { title: 'Movimientos', description: 'Consulta los movimientos normalizados desde la caché local del dispositivo.' },
  renta: { title: 'Renta', description: 'Revisa los datos fiscales calculados localmente.' },
  fiscalidad: { title: 'Fiscalidad', description: 'Revisa los datos fiscales calculados localmente.' },
  configuracion: { title: 'Configuración', description: 'Gestiona tu perfil y tu suscripción.' },
  suscripcion: { title: 'Suscripción', description: 'Consulta y gestiona tu plan de CoinRenta.' },
};
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const item = sections[section];
  return item ? { title: item.title, description: item.description, robots: { index: false, follow: false } } : { title: 'No encontrado', robots: { index: false, follow: false } };
}
function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function status(value: string | null) { if (value === 'error') return 'Error'; if (value === 'pending') return 'Pendiente'; if (value === 'active') return 'Conectado'; return 'Desactivado'; }

export default async function DashboardSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams?: Promise<{ year?: string }> }) {
  const { section } = await params;
  const item = sections[section];
  if (!item) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (section === 'suscripcion') {
    const { redirect } = await import('next/navigation');
    redirect('/dashboard/suscripcion');
  }

  if (section === 'exchanges') {
    const [{ data: exchanges, error: exchangesError }, { data: connections, error: connectionsError }] = await Promise.all([
      supabase.from('exchanges').select('id,code,name,website').eq('is_active', true).order('name'),
      supabase.from('exchange_connections').select('id,exchange_id,label,status,last_sync_at,last_sync_status,last_sync_error,provider_type,exchanges(name,code)').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (exchangesError || connectionsError) throw new Error((exchangesError || connectionsError)!.message);
    return <><SectionHeader item={item}/><section className="dashboard-content connections-page"><div className="exchange-hero panel-card"><div className="exchange-hero-copy"><span className="section-kicker">Conexiones</span><h3>Importa tus exchanges</h3><p>Los CSV originales se almacenan en el servidor. Los movimientos normalizados, saldos y cálculos fiscales se guardan solo en tu dispositivo.</p></div><ExchangeManager exchanges={(exchanges || []) as any[]} connections={(connections || []) as any[]}/></div><div className="panel-card connections-panel"><div className="panel-head"><div><span className="section-kicker">TUS CONEXIONES</span><h3>{connections?.length || 0} {(connections?.length || 0) === 1 ? 'conexión' : 'conexiones'}</h3></div></div>{connections?.length ? <div className="connected-exchanges">{connections.map((connection: any) => { const exchange = one(connection.exchanges); return <article className={`connected-exchange-card connected-exchange-${String(exchange?.code || 'exchange').toLowerCase()}`} key={connection.id}><div className="connected-exchange-head"><div className="connected-exchange-brand"><span className="connected-exchange-logo">{String(exchange?.name || 'E').slice(0,1).toUpperCase()}</span><div><strong>{exchange?.name || 'Exchange'}</strong><span>{connection.label || 'Cuenta principal'}</span></div></div><span className={`connection-status connection-status-${status(connection.status).toLowerCase()}`}><i/>{status(connection.status)}</span></div><div className="connected-exchange-info"><div><small>Método</small><strong>{connection.provider_type === 'csv' ? 'CSV · fuente original' : 'API · credencial protegida'}</strong></div><div><small>Última actualización</small><strong>{date(connection.last_sync_at)}</strong></div></div>{connection.last_sync_error && <div className="connection-error">{connection.last_sync_error}</div>}<div className="connected-exchange-footer"><span>{connection.provider_type === 'csv' ? 'CSV original almacenado' : 'Clave API protegida en Vault'}</span><DeleteConnectionButton userId={user.id} connectionId={connection.id}/></div></article>; })}</div> : <div className="connected-exchanges-empty"><strong>Aún no tienes conexiones.</strong><span>Añade un exchange e importa su histórico.</span></div>}</div></section></>;
  }

  if (section === 'movimientos' || section === 'fiscalidad' || section === 'renta') {
    const [{ data: profile }, { data: rows, error }] = await Promise.all([
      supabase.from('profiles').select('role,display_name,subscription_plan').eq('id', user.id).maybeSingle(),
      supabase.from('exchange_connections').select('id,label,provider_type,status,last_sync_at,last_sync_status,exchange_id,exchanges(code,name)').eq('user_id', user.id).order('updated_at', { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    const connections: LocalConnection[] = (rows || []).map((row: any) => { const exchange = one(row.exchanges); return { id: String(row.id), label: row.label || null, provider_type: row.provider_type || null, status: row.status || null, last_sync_at: row.last_sync_at || null, last_sync_status: row.last_sync_status || null, exchange: String(exchange?.code || 'exchange').toLowerCase(), exchangeName: String(exchange?.name || 'Exchange') }; });
    const requestedYear = Number((await searchParams)?.year);
    const year = Number.isInteger(requestedYear) && requestedYear >= 2018 && requestedYear <= new Date().getFullYear() + 1 ? requestedYear : new Date().getFullYear();
    const mode = section === 'renta' ? 'renta' : section;
    const plan = profile?.role === 'admin' ? 'admin' : (profile?.subscription_plan || 'free');
    return <LocalWorkspace userId={user.id} connections={connections} mode={mode} isPro={plan === 'pro' || profile?.role === 'admin'} displayName={profile?.display_name || null} year={year} />;
  }

  const { data: profile } = await supabase.from('profiles').select('display_name,country_code,timezone,role,subscription_plan,subscription_interval,subscription_status,subscription_current_period_end').eq('id', user.id).maybeSingle();
  const role = profile?.role || 'free';
  const plan = role === 'admin' ? 'Admin' : profile?.subscription_plan === 'pro' ? 'Pro' : profile?.subscription_plan === 'essential' ? 'Esencial' : 'Free';
  const isPaid = plan === 'Pro' || plan === 'Esencial';
  return <><SectionHeader item={item}/><section className="dashboard-content"><div className={`subscription-card ${isPaid ? 'subscription-pro' : 'subscription-free'}`}><div className="subscription-glow"/><div className="subscription-main"><div className="subscription-icon">♛</div><div><span className="section-kicker">Tu suscripción</span><h2>Plan {plan}</h2><p>{isPaid ? 'Tu suscripción está conectada con Stripe y tu acceso se actualiza automáticamente.' : 'Estás en el plan gratuito. Puedes actualizarlo cuando quieras.'}</p></div></div><div className="subscription-meta"><span><strong>Estado</strong><b>{profile?.subscription_status || 'Activo'}</b></span><span><strong>Cuenta</strong><b>{user.email || 'Usuario'}</b></span><Link href="/dashboard/suscripcion" className="btn btn-primary">Ver planes y gestionar suscripción →</Link></div></div><div className="panel-card"><div className="panel-head"><div><span className="section-kicker">Perfil</span><h3>Datos de tu cuenta</h3></div></div><form action={updateProfile} className="form-grid"><label>Nombre visible<input name="display_name" defaultValue={profile?.display_name || ''} placeholder="Tu nombre"/></label><label>País<input value={profile?.country_code || 'ES'} readOnly/></label><label>Zona horaria<input value={profile?.timezone || 'Europe/Madrid'} readOnly/></label><div><button className="btn btn-primary" type="submit">Guardar cambios</button></div></form></div></section></>;
}
function SectionHeader({ item }: { item: { title: string; description: string } }) { return <header className="app-topbar"><div><span className="topbar-kicker">CoinRenta</span><h1>{item.title}</h1><p>{item.description}</p></div></header>; }
