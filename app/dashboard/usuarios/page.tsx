import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserActions from "./user-actions";

export const metadata: Metadata = {
  title: "Usuarios",
  description: "Administración de usuarios de CoinRenta.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string;
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : value.slice(0, 2)).toUpperCase();
}

function roleLabel(role: string | null) {
  return role === "admin" ? "Administrador" : role === "pro" ? "Pro" : "Free";
}

function roleClass(role: string | null) {
  return role === "admin" ? "admin" : role === "pro" ? "pro" : "free";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("role,display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (meError) throw new Error(meError.message);
  if (me?.role !== "admin") redirect("/dashboard");

  // Los administradores se autorizan mediante RLS; no dependemos de una service role key en Vercel.
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,role,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los usuarios: ${error.message}`);

  const users = (data || []) as UserRow[];
  const active = users.filter((item) => item.is_active !== false).length;
  const inactive = users.length - active;
  const admins = users.filter((item) => item.role === "admin").length;
  const pro = users.filter((item) => item.role === "pro").length;
  const adminName = me?.display_name || user.email?.split("@")[0] || "Administrador";

  return (
    <main className="dashboard-content users-content">
      <style>{`
        .users-content{padding-bottom:52px}.users-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:26px}.users-header-copy{min-width:0}.users-eyebrow{display:flex;align-items:center;gap:8px;color:#6fdad2;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.users-eyebrow:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--cr-primary);box-shadow:0 0 0 5px rgba(15,167,160,.1)}.users-header h1{margin:9px 0 7px;font-size:clamp(30px,3.3vw,42px);line-height:1;letter-spacing:-.05em}.users-header p{margin:0;color:var(--cr-text-muted);font-size:13px;line-height:1.6}.users-admin{display:flex;align-items:center;gap:10px;padding:7px 12px 7px 7px;border:1px solid var(--cr-border);border-radius:13px;background:var(--cr-surface);white-space:nowrap}.users-admin-avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:var(--cr-primary-soft);color:#75ddd5;font-size:10px;font-weight:900}.users-admin strong{display:block;font-size:11px}.users-admin span{display:block;color:var(--cr-text-muted);font-size:9px;margin-top:2px}.users-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.users-stat{position:relative;overflow:hidden;min-width:0;padding:18px 19px;border:1px solid var(--cr-border);border-radius:16px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm)}.users-stat-label{display:block;color:var(--cr-text-muted);font-size:9px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.users-stat-value{display:block;margin-top:8px;font-size:25px;line-height:1;letter-spacing:-.045em}.users-stat-note{display:block;margin-top:7px;color:#728096;font-size:9px}.users-stat-primary .users-stat-value{color:#6dd9d2}.users-directory{overflow:hidden;border:1px solid var(--cr-border);border-radius:19px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm)}.users-directory-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 22px;border-bottom:1px solid var(--cr-border)}.users-directory-head h2{margin:0;font-size:16px}.users-directory-head p{margin:4px 0 0;color:var(--cr-text-muted);font-size:11px}.users-directory-count{color:#8d9bb0;font-size:10px}.users-directory-count b{color:#69d8d0}.users-table-wrap{overflow-x:auto}.users-table{width:100%;border-collapse:collapse;min-width:920px}.users-table th{padding:11px 22px;text-align:left;color:#718096;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--cr-border)}.users-table td{padding:13px 22px;border-bottom:1px solid rgba(255,255,255,.045);vertical-align:middle}.user-cell{display:flex;align-items:center;gap:11px;min-width:235px}.user-avatar{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;border:1px solid rgba(15,167,160,.15);border-radius:11px;background:linear-gradient(145deg,#17343b,#10262d);color:#72d9d2;font-size:10px;font-weight:900}.user-meta{min-width:0}.user-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:850}.user-email{display:block;max-width:250px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--cr-text-muted);font-size:9px}.user-role{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:9px;font-weight:850;white-space:nowrap}.user-role:before{content:"";width:5px;height:5px;border-radius:50%}.user-role-free{color:#a7b2c3;background:rgba(145,160,182,.08)}.user-role-free:before{background:#8794a8}.user-role-pro{color:#70d9d1;background:rgba(15,167,160,.09)}.user-role-pro:before{background:var(--cr-primary)}.user-role-admin{color:#aaa9ff;background:rgba(99,102,241,.1)}.user-role-admin:before{background:#7779ed}.user-status{display:inline-flex;align-items:center;gap:6px;font-size:9px;font-weight:850}.user-status:before{content:"";width:6px;height:6px;border-radius:50%}.user-status-active{color:#6fd7a9}.user-status-active:before{background:var(--cr-success)}.user-status-inactive{color:#e39a9a}.user-status-inactive:before{background:var(--cr-danger)}.user-date{color:#96a4b8;font-size:10px;white-space:nowrap}.user-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}.user-actions form{display:flex;align-items:center;gap:6px}.user-role-select,.user-action{height:33px;border:1px solid var(--cr-border-strong);border-radius:9px;background:var(--cr-surface-2);color:var(--cr-text);font-size:9px;font-weight:750}.user-role-select{padding:0 9px}.user-action{padding:0 10px;cursor:pointer;font-weight:800}.user-action-save{border-color:var(--cr-primary);background:var(--cr-primary);color:#fff}.user-action-delete{border-color:rgba(226,92,92,.35);color:#f09b9b}.user-action:disabled,.user-role-select:disabled{opacity:.45;cursor:not-allowed}.user-action-message{width:100%;color:var(--cr-text-muted);font-size:9px;text-align:right}.users-empty{padding:58px 22px;text-align:center;color:var(--cr-text-muted)}.users-mobile-list{display:none}.users-mobile-card{padding:16px;border-bottom:1px solid rgba(255,255,255,.05)}.users-mobile-main{display:flex;align-items:center;gap:11px}.users-mobile-info{min-width:0;flex:1}.users-mobile-info strong,.users-mobile-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.users-mobile-info strong{font-size:11px}.users-mobile-info small{margin-top:3px;color:var(--cr-text-muted);font-size:9px}.users-mobile-date{color:#8795a9;font-size:9px;white-space:nowrap}.users-mobile-tags{display:flex;gap:7px;margin-top:12px}.users-mobile-actions{margin-top:11px}.users-mobile-actions .user-actions{display:grid;grid-template-columns:1fr 1fr;justify-content:stretch}.users-mobile-actions .user-actions form{grid-column:1/-1}.users-mobile-actions .user-action-message{grid-column:1/-1;text-align:left}.users-mobile-actions .user-role-select{flex:1}.users-mobile-actions .user-actions>button{min-width:0}.users-mobile-actions .user-actions>form{display:flex}.users-mobile-actions .user-actions>form>*{min-width:0;flex:1}
        @media(max-width:1100px){.users-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.users-header{display:block}.users-admin{width:max-content;margin-top:18px}.users-table-wrap{display:none}.users-mobile-list{display:block}.users-directory-head{padding:17px}.users-directory-count{display:none}}@media(max-width:500px){.users-stats{gap:8px}.users-stat{padding:14px}.users-stat-value{font-size:21px}.users-admin span{display:none}}
      `}</style>

      <div className="users-header">
        <div className="users-header-copy"><div className="users-eyebrow">Administración</div><h1>Usuarios</h1><p>Gestiona las cuentas de CoinRenta, sus planes, permisos y acceso a la plataforma.</p></div>
        <div className="users-admin"><span className="users-admin-avatar">{initials(adminName)}</span><div><strong>{adminName}</strong><span>Sesión de administrador</span></div></div>
      </div>

      <div className="users-stats">
        <article className="users-stat users-stat-primary"><span className="users-stat-label">Usuarios totales</span><strong className="users-stat-value">{users.length}</strong><small className="users-stat-note">Cuentas registradas</small></article>
        <article className="users-stat"><span className="users-stat-label">Activos</span><strong className="users-stat-value">{active}</strong><small className="users-stat-note">Acceso habilitado</small></article>
        <article className="users-stat"><span className="users-stat-label">Plan Pro</span><strong className="users-stat-value">{pro}</strong><small className="users-stat-note">Usuarios Pro</small></article>
        <article className="users-stat"><span className="users-stat-label">Administradores</span><strong className="users-stat-value">{admins}</strong><small className="users-stat-note">Permisos de gestión</small></article>
      </div>

      <section className="users-directory">
        <div className="users-directory-head"><div><h2>Directorio de usuarios</h2><p>Consulta y modifica el plan o el acceso de cada cuenta.</p></div><div className="users-directory-count"><b>{active}</b> activos · {inactive} inactivos</div></div>
        {users.length ? <>
          <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Usuario</th><th>Plan / rol</th><th>Estado</th><th>Alta</th><th style={{textAlign:"right"}}>Gestionar</th></tr></thead><tbody>
            {users.map((item) => { const label = item.display_name || item.email?.split("@")[0] || "Usuario"; const isActive = item.is_active !== false; return <tr key={item.id}><td><div className="user-cell"><span className="user-avatar">{initials(label)}</span><div className="user-meta"><strong className="user-name">{label}</strong><small className="user-email">{item.email || item.id}</small></div></div></td><td><span className={`user-role user-role-${roleClass(item.role)}`}>{roleLabel(item.role)}</span></td><td><span className={`user-status ${isActive ? "user-status-active" : "user-status-inactive"}`}>{isActive ? "Activo" : "Inactivo"}</span></td><td><span className="user-date">{formatDate(item.created_at)}</span></td><td><UserActions userId={item.id} role={item.role} isActive={isActive} label={label} isSelf={item.id === user.id} /></td></tr>; })}
          </tbody></table></div>
          <div className="users-mobile-list">{users.map((item) => { const label = item.display_name || item.email?.split("@")[0] || "Usuario"; const isActive = item.is_active !== false; return <article className="users-mobile-card" key={item.id}><div className="users-mobile-main"><span className="user-avatar">{initials(label)}</span><div className="users-mobile-info"><strong>{label}</strong><small>{item.email || item.id}</small></div><span className="users-mobile-date">{formatDate(item.created_at)}</span></div><div className="users-mobile-tags"><span className={`user-role user-role-${roleClass(item.role)}`}>{roleLabel(item.role)}</span><span className={`user-status ${isActive ? "user-status-active" : "user-status-inactive"}`}>{isActive ? "Activo" : "Inactivo"}</span></div><div className="users-mobile-actions"><UserActions userId={item.id} role={item.role} isActive={isActive} label={label} isSelf={item.id === user.id} /></div></article>; })}</div>
        </> : <div className="users-empty"><strong>No hay usuarios registrados</strong><span>Cuando haya cuentas en CoinRenta aparecerán aquí.</span></div>}
      </section>
    </main>
  );
}
