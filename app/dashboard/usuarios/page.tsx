import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminUpdateUser } from "../actions";
import DashboardSidebar from "../dashboard-sidebar";

export const metadata: Metadata = { title: "Usuarios", description: "Administración de usuarios de CoinRenta.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type UserRow = { id: string; email: string | null; display_name: string | null; role: string | null; is_active: boolean | null; created_at: string };

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : value.slice(0, 2)).toUpperCase();
}
function roleLabel(role: string | null) { return role === "admin" ? "Administrador" : role === "pro" ? "Pro" : "Free"; }
function roleClass(role: string | null) { return role === "admin" ? "admin" : role === "pro" ? "pro" : "free"; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date); }

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/dashboard");
  const { data } = await supabase.from("profiles").select("id,email,display_name,role,is_active,created_at").order("created_at", { ascending: false });

  const users = (data || []) as UserRow[];
  const active = users.filter((item) => item.is_active !== false).length;
  const inactive = users.length - active;
  const admins = users.filter((item) => item.role === "admin").length;
  const pro = users.filter((item) => item.role === "pro").length;
  const adminName = me.display_name || user.email?.split("@")[0] || "Administrador";

  return (
    <div className="app-shell users-page">
      <DashboardSidebar role="admin" />
      <main className="app-main users-main">
        <style>{`
          .users-main{min-width:0;overflow-x:hidden}.users-content{padding-bottom:52px}
          .users-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:26px}.users-header-copy{min-width:0}
          .users-eyebrow{display:flex;align-items:center;gap:8px;color:#6fdad2;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.users-eyebrow:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--cr-primary);box-shadow:0 0 0 5px rgba(15,167,160,.1)}
          .users-header h1{margin:9px 0 7px;font-size:clamp(30px,3.3vw,42px);line-height:1;letter-spacing:-.05em}.users-header p{margin:0;color:var(--cr-text-muted);font-size:13px;line-height:1.6}
          .users-admin{display:flex;align-items:center;gap:10px;padding:7px 12px 7px 7px;border:1px solid var(--cr-border);border-radius:13px;background:var(--cr-surface);white-space:nowrap}.users-admin-avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:var(--cr-primary-soft);color:#75ddd5;font-size:10px;font-weight:900}.users-admin strong{display:block;font-size:11px}.users-admin span{display:block;color:var(--cr-text-muted);font-size:9px;margin-top:2px}
          .users-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.users-stat{position:relative;overflow:hidden;min-width:0;padding:18px 19px;border:1px solid var(--cr-border);border-radius:16px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm)}.users-stat:after{content:"";position:absolute;right:-38px;top:-44px;width:100px;height:100px;border-radius:50%;background:rgba(15,167,160,.055)}.users-stat-label{display:block;color:var(--cr-text-muted);font-size:9px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.users-stat-value{display:block;margin-top:8px;font-size:25px;line-height:1;letter-spacing:-.045em}.users-stat-note{display:block;margin-top:7px;color:#728096;font-size:9px}.users-stat-primary .users-stat-value{color:#6dd9d2}
          .users-directory{overflow:hidden;border:1px solid var(--cr-border);border-radius:19px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm)}.users-directory-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 22px;border-bottom:1px solid var(--cr-border)}.users-directory-head h2{margin:0;font-size:16px;letter-spacing:-.025em}.users-directory-head p{margin:4px 0 0;color:var(--cr-text-muted);font-size:11px}.users-directory-count{color:#8d9bb0;font-size:10px;font-weight:800}.users-directory-count b{color:#69d8d0}
          .users-table-wrap{overflow-x:auto}.users-table{width:100%;border-collapse:collapse;min-width:780px}.users-table th{padding:11px 22px;text-align:left;color:#718096;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--cr-border);white-space:nowrap}.users-table td{padding:13px 22px;border-bottom:1px solid rgba(255,255,255,.045);vertical-align:middle}.users-table tbody tr{transition:background .18s ease}.users-table tbody tr:hover{background:rgba(255,255,255,.018)}.users-table tbody tr:last-child td{border-bottom:0}
          .user-cell{display:flex;align-items:center;gap:11px;min-width:235px}.user-avatar{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;border:1px solid rgba(15,167,160,.15);border-radius:11px;background:linear-gradient(145deg,#17343b,#10262d);color:#72d9d2;font-size:10px;font-weight:900}.user-meta{min-width:0}.user-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:850}.user-email{display:block;max-width:250px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--cr-text-muted);font-size:9px}
          .user-role{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid transparent;border-radius:999px;font-size:9px;font-weight:850;white-space:nowrap}.user-role:before{content:"";width:5px;height:5px;border-radius:50%}.user-role-free{color:#a7b2c3;background:rgba(145,160,182,.08);border-color:rgba(145,160,182,.11)}.user-role-free:before{background:#8794a8}.user-role-pro{color:#70d9d1;background:rgba(15,167,160,.09);border-color:rgba(15,167,160,.14)}.user-role-pro:before{background:var(--cr-primary)}.user-role-admin{color:#aaa9ff;background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.15)}.user-role-admin:before{background:#7779ed}
          .user-status{display:inline-flex;align-items:center;gap:6px;font-size:9px;font-weight:850}.user-status:before{content:"";width:6px;height:6px;border-radius:50%}.user-status-active{color:#6fd7a9}.user-status-active:before{background:var(--cr-success);box-shadow:0 0 0 4px rgba(50,181,122,.08)}.user-status-inactive{color:#e39a9a}.user-status-inactive:before{background:var(--cr-danger)}.user-date{color:#96a4b8;font-size:10px;white-space:nowrap}
          .user-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}.user-actions form{display:flex;align-items:center;gap:6px}.user-role-select{height:33px;padding:0 9px;border:1px solid var(--cr-border-strong);border-radius:9px;background:var(--cr-surface-2);color:var(--cr-text);font-size:9px;font-weight:750;outline:none}.user-action{height:33px;padding:0 10px;border:1px solid var(--cr-border-strong);border-radius:9px;background:rgba(255,255,255,.025);color:var(--cr-text);font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap;transition:.18s ease}.user-action:hover{background:rgba(255,255,255,.065);transform:translateY(-1px)}.user-action-save{border-color:var(--cr-primary);background:var(--cr-primary);color:#fff}.user-action-save:hover{background:var(--cr-primary-hover)}
          .users-mobile-list{display:none}.users-empty{padding:58px 22px;text-align:center;color:var(--cr-text-muted)}.users-empty-icon{width:46px;height:46px;margin:0 auto 12px;display:grid;place-items:center;border-radius:14px;background:var(--cr-surface-2);color:#6dd9d2;font-size:18px}.users-empty strong{display:block;color:var(--cr-text);font-size:13px;margin-bottom:5px}.users-empty span{font-size:11px}
          @media(max-width:1050px){.users-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
          @media(max-width:760px){.users-header{display:block}.users-admin{width:max-content;margin-top:18px}.users-directory-head{padding:17px}.users-directory-count{display:none}.users-table-wrap{display:none}.users-mobile-list{display:block}.users-mobile-card{padding:16px;border-bottom:1px solid rgba(255,255,255,.05)}.users-mobile-card:last-child{border-bottom:0}.users-mobile-main{display:flex;align-items:center;gap:11px}.users-mobile-info{min-width:0;flex:1}.users-mobile-info strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.users-mobile-info small{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--cr-text-muted);font-size:9px}.users-mobile-date{color:#8795a9;font-size:9px;white-space:nowrap}.users-mobile-tags{display:flex;align-items:center;gap:7px;margin-top:12px}.users-mobile-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.users-mobile-actions form{display:flex;min-width:0}.users-mobile-actions form>*{flex:1;min-width:0}.users-mobile-actions .user-role-select{width:100%}}
          @media(max-width:500px){.users-content{padding-bottom:35px}.users-header h1{font-size:32px}.users-header p{font-size:12px}.users-stats{gap:8px}.users-stat{padding:14px}.users-stat-value{font-size:21px}.users-stat-note{font-size:8px}.users-admin span{display:none}.users-directory{border-radius:16px}}
        `}</style>

        <header className="app-topbar dashboard-topbar-modern">
          <div className="dashboard-search">⌕ <span>Buscar por usuario, email...</span></div>
          <div className="topbar-actions"><span className="notification">♧<i /></span><span className="profile-chip">{initials(adminName)}</span><div className="profile-summary"><strong>{adminName}</strong><span>Administrador</span></div><span className="profile-chevron">⌄</span></div>
        </header>

        <section className="dashboard-content users-content">
          <div className="users-header">
            <div className="users-header-copy"><div className="users-eyebrow">Administración</div><h1>Usuarios</h1><p>Gestiona las cuentas de CoinRenta, sus permisos y el acceso a la plataforma.</p></div>
            <div className="users-admin"><span className="users-admin-avatar">{initials(adminName)}</span><div><strong>{adminName}</strong><span>Sesión de administrador</span></div></div>
          </div>

          <div className="users-stats">
            <article className="users-stat users-stat-primary"><span className="users-stat-label">Usuarios totales</span><strong className="users-stat-value">{users.length}</strong><small className="users-stat-note">Cuentas registradas</small></article>
            <article className="users-stat"><span className="users-stat-label">Activos</span><strong className="users-stat-value">{active}</strong><small className="users-stat-note">Acceso habilitado</small></article>
            <article className="users-stat"><span className="users-stat-label">Plan Pro</span><strong className="users-stat-value">{pro}</strong><small className="users-stat-note">Suscripciones Pro</small></article>
            <article className="users-stat"><span className="users-stat-label">Administradores</span><strong className="users-stat-value">{admins}</strong><small className="users-stat-note">Permisos de gestión</small></article>
          </div>

          <section className="users-directory">
            <div className="users-directory-head"><div><h2>Directorio de usuarios</h2><p>Consulta y modifica el estado o el rol de cada cuenta.</p></div><div className="users-directory-count"><b>{active}</b> activos · {inactive} inactivos</div></div>
            {users.length ? <>
              <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Usuario</th><th>Plan / rol</th><th>Estado</th><th>Alta</th><th style={{textAlign:"right"}}>Gestionar</th></tr></thead><tbody>
                {users.map((item) => { const label=item.display_name||item.email?.split("@")[0]||"Usuario"; const isActive=item.is_active!==false; const rc=roleClass(item.role); return <tr key={item.id}>
                  <td><div className="user-cell"><span className="user-avatar">{initials(label)}</span><div className="user-meta"><strong className="user-name">{label}</strong><small className="user-email">{item.email||item.id}</small></div></div></td>
                  <td><span className={`user-role user-role-${rc}`}>{roleLabel(item.role)}</span></td><td><span className={`user-status ${isActive?"user-status-active":"user-status-inactive"}`}>{isActive?"Activo":"Inactivo"}</span></td><td><span className="user-date">{formatDate(item.created_at)}</span></td>
                  <td><div className="user-actions"><form action={adminUpdateUser}><input type="hidden" name="user_id" value={item.id}/><input type="hidden" name="role" value={item.role||"free"}/><input type="hidden" name="is_active" value={isActive?"false":"true"}/><button className="user-action" type="submit">{isActive?"Desactivar":"Reactivar"}</button></form><form action={adminUpdateUser}><input type="hidden" name="user_id" value={item.id}/><input type="hidden" name="is_active" value={isActive?"true":"false"}/><select className="user-role-select" name="role" defaultValue={item.role||"free"} aria-label={`Rol de ${label}`}><option value="free">Free</option><option value="pro">Pro</option><option value="admin">Admin</option></select><button className="user-action user-action-save" type="submit">Guardar</button></form></div></td>
                </tr>; })}
              </tbody></table></div>
              <div className="users-mobile-list">{users.map((item)=>{const label=item.display_name||item.email?.split("@")[0]||"Usuario";const isActive=item.is_active!==false;const rc=roleClass(item.role);return <article className="users-mobile-card" key={item.id}><div className="users-mobile-main"><span className="user-avatar">{initials(label)}</span><div className="users-mobile-info"><strong>{label}</strong><small>{item.email||item.id}</small></div><span className="users-mobile-date">{formatDate(item.created_at)}</span></div><div className="users-mobile-tags"><span className={`user-role user-role-${rc}`}>{roleLabel(item.role)}</span><span className={`user-status ${isActive?"user-status-active":"user-status-inactive"}`}>{isActive?"Activo":"Inactivo"}</span></div><div className="users-mobile-actions"><form action={adminUpdateUser}><input type="hidden" name="user_id" value={item.id}/><input type="hidden" name="role" value={item.role||"free"}/><input type="hidden" name="is_active" value={isActive?"false":"true"}/><button className="user-action" type="submit">{isActive?"Desactivar":"Reactivar"}</button></form><form action={adminUpdateUser}><input type="hidden" name="user_id" value={item.id}/><input type="hidden" name="is_active" value={isActive?"true":"false"}/><select className="user-role-select" name="role" defaultValue={item.role||"free"} aria-label={`Rol de ${label}`}><option value="free">Free</option><option value="pro">Pro</option><option value="admin">Admin</option></select><button className="user-action user-action-save" type="submit">OK</button></form></div></article>})}</div>
            </> : <div className="users-empty"><div className="users-empty-icon">♙</div><strong>No hay usuarios registrados</strong><span>Las nuevas cuentas aparecerán aquí automáticamente.</span></div>}
          </section>
        </section>
      </main>
    </div>
  );
}
