import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminUpdateUser } from "../actions";
import DashboardSidebar from "../dashboard-sidebar";

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
  updated_at: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2)).toUpperCase();
}

function roleLabel(role: string | null) {
  if (role === "admin") return "Administrador";
  if (role === "pro") return "Pro";
  return "Free";
}

function roleClass(role: string | null) {
  if (role === "admin") return "users-role-admin";
  if (role === "pro") return "users-role-pro";
  return "users-role-free";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("id,email,display_name,role,is_active,created_at,updated_at")
    .order("created_at", { ascending: false });

  const users = (data || []) as UserRow[];
  const active = users.filter((item) => item.is_active !== false).length;
  const inactive = users.length - active;
  const admins = users.filter((item) => item.role === "admin").length;
  const pro = users.filter((item) => item.role === "pro").length;
  const adminName = me.display_name || user.email?.split("@")[0] || "Administrador";

  return (
    <div className="app-shell users-page">
      <DashboardSidebar role="admin" />
      <main className="app-main">
        <style>{`
          .users-page .app-main{min-width:0}
          .users-content{padding-bottom:48px}
          .users-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:28px}
          .users-kicker{display:inline-flex;align-items:center;gap:8px;color:#61D7CF;font-size:11px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}
          .users-kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--cr-primary);box-shadow:0 0 0 5px rgba(15,167,160,.1)}
          .users-hero h1{margin:10px 0 7px;font-size:clamp(30px,3vw,42px);line-height:1.02;letter-spacing:-.045em}
          .users-hero p{margin:0;color:var(--cr-text-muted);font-size:14px}
          .users-admin-badge{display:flex;align-items:center;gap:10px;padding:10px 13px;border:1px solid var(--cr-border);border-radius:14px;background:rgba(255,255,255,.025);white-space:nowrap}
          .users-admin-avatar{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:var(--cr-primary-soft);color:#75DCD5;font-size:11px;font-weight:900}
          .users-admin-badge strong{display:block;font-size:12px}.users-admin-badge span{display:block;color:var(--cr-text-muted);font-size:10px;margin-top:1px}
          .users-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:18px}
          .users-stat{position:relative;overflow:hidden;padding:18px 19px;border:1px solid var(--cr-border);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.015));box-shadow:var(--cr-shadow-sm)}
          .users-stat:after{content:"";position:absolute;width:90px;height:90px;right:-38px;top:-42px;border-radius:50%;background:rgba(15,167,160,.06);filter:blur(3px)}
          .users-stat-label{display:block;color:var(--cr-text-muted);font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.users-stat-value{display:block;margin-top:6px;font-size:25px;line-height:1;font-weight:850;letter-spacing:-.04em}.users-stat-note{display:block;margin-top:8px;color:#718198;font-size:10px}
          .users-stat-accent .users-stat-value{color:#67D8D0}
          .users-panel{overflow:hidden;padding:0;border:1px solid var(--cr-border);border-radius:20px;background:var(--cr-surface);box-shadow:var(--cr-shadow-sm)}
          .users-panel-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 24px;border-bottom:1px solid var(--cr-border)}
          .users-panel-head h2{margin:0;font-size:17px;letter-spacing:-.02em}.users-panel-head p{margin:4px 0 0;color:var(--cr-text-muted);font-size:12px}
          .users-count{padding:7px 10px;border:1px solid var(--cr-border);border-radius:999px;color:#9DABC0;font-size:10px;font-weight:800;background:rgba(255,255,255,.02)}
          .users-table-wrap{overflow-x:auto}.users-table{width:100%;border-collapse:collapse;min-width:850px}.users-table th{padding:12px 24px;text-align:left;color:#728198;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--cr-border);white-space:nowrap}.users-table td{padding:15px 24px;border-bottom:1px solid rgba(255,255,255,.055);vertical-align:middle}.users-table tbody tr{transition:background .18s ease}.users-table tbody tr:hover{background:rgba(255,255,255,.018)}.users-table tbody tr:last-child td{border-bottom:0}
          .users-user{display:flex;align-items:center;gap:11px;min-width:230px}.users-avatar{width:38px;height:38px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:linear-gradient(145deg,#17323A,#10252C);border:1px solid rgba(15,167,160,.16);color:#78DAD3;font-size:10px;font-weight:900}.users-user strong{display:block;font-size:12px;font-weight:800}.users-user small{display:block;margin-top:2px;color:var(--cr-text-muted);font-size:10px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .users-role{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:850}.users-role:before{content:"";width:5px;height:5px;border-radius:50%}.users-role-free{background:rgba(145,160,182,.09);color:#A9B5C7;border:1px solid rgba(145,160,182,.12)}.users-role-free:before{background:#8795AA}.users-role-pro{background:rgba(15,167,160,.1);color:#70D8D1;border:1px solid rgba(15,167,160,.16)}.users-role-pro:before{background:var(--cr-primary)}.users-role-admin{background:rgba(99,102,241,.11);color:#A9A8FF;border:1px solid rgba(99,102,241,.17)}.users-role-admin:before{background:#7B7EF2}
          .users-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800}.users-status:before{content:"";width:6px;height:6px;border-radius:50%;background:#65748A}.users-status-active{color:#76D9AD}.users-status-active:before{background:var(--cr-success);box-shadow:0 0 0 4px rgba(50,181,122,.09)}.users-status-inactive{color:#E59A9A}.users-status-inactive:before{background:var(--cr-danger)}
          .users-date{color:#9AA8BC;font-size:11px;white-space:nowrap}.users-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px}.users-actions form{display:flex;align-items:center;gap:6px}.users-select{height:36px;padding:0 10px;border:1px solid var(--cr-border-strong);border-radius:10px;background:var(--cr-surface-2);color:var(--cr-text);font-size:11px;font-weight:700;outline:none}.users-select:focus{border-color:rgba(15,167,160,.5);box-shadow:0 0 0 3px rgba(15,167,160,.08)}.users-btn{height:36px;padding:0 11px;border-radius:10px;border:1px solid var(--cr-border-strong);font-size:10px;font-weight:800;cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease}.users-btn:hover{transform:translateY(-1px)}.users-btn-save{background:var(--cr-primary);border-color:var(--cr-primary);color:#fff}.users-btn-save:hover{background:var(--cr-primary-hover)}.users-btn-toggle{background:rgba(255,255,255,.025);color:var(--cr-text)}.users-btn-toggle:hover{background:rgba(255,255,255,.06)}
          .users-empty{padding:54px 24px;text-align:center;color:var(--cr-text-muted)}.users-empty strong{display:block;color:var(--cr-text);font-size:14px;margin-bottom:5px}.users-empty span{font-size:12px}
          @media(max-width:1000px){.users-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.users-hero{align-items:flex-start}}
          @media(max-width:620px){.users-hero{display:block}.users-admin-badge{margin-top:18px;width:max-content}.users-stat-grid{grid-template-columns:1fr 1fr;gap:9px}.users-stat{padding:15px}.users-stat-value{font-size:21px}.users-panel-head{padding:18px}.users-table th,.users-table td{padding-left:18px;padding-right:18px}}
        `}</style>

        <header className="app-topbar dashboard-topbar-modern">
          <div className="dashboard-search">⌕ <span>Buscar por usuario, email...</span></div>
          <div className="topbar-actions">
            <span className="notification">♧<i /></span>
            <span className="profile-chip">{initials(adminName)}</span>
            <div className="profile-summary"><strong>{adminName}</strong><span>Administrador</span></div>
            <span className="profile-chevron">⌄</span>
          </div>
        </header>

        <section className="dashboard-content users-content">
          <div className="users-hero">
            <div>
              <span className="users-kicker">Administración</span>
              <h1>Usuarios</h1>
              <p>Controla las cuentas, permisos y estado de acceso de CoinRenta desde un único lugar.</p>
            </div>
            <div className="users-admin-badge">
              <span className="users-admin-avatar">{initials(adminName)}</span>
              <div><strong>{adminName}</strong><span>Sesión de administrador</span></div>
            </div>
          </div>

          <div className="users-stat-grid">
            <article className="users-stat users-stat-accent"><span className="users-stat-label">Usuarios totales</span><strong className="users-stat-value">{users.length}</strong><span className="users-stat-note">Cuentas registradas</span></article>
            <article className="users-stat"><span className="users-stat-label">Activos</span><strong className="users-stat-value">{active}</strong><span className="users-stat-note">Con acceso habilitado</span></article>
            <article className="users-stat"><span className="users-stat-label">Plan Pro</span><strong className="users-stat-value">{pro}</strong><span className="users-stat-note">Usuarios con Pro</span></article>
            <article className="users-stat"><span className="users-stat-label">Administradores</span><strong className="users-stat-value">{admins}</strong><span className="users-stat-note">Permisos de gestión</span></article>
          </div>

          <section className="users-panel">
            <div className="users-panel-head">
              <div><h2>Directorio de usuarios</h2><p>Gestiona el acceso y el nivel de cada cuenta.</p></div>
              <span className="users-count">{active} activos · {inactive} de baja</span>
            </div>
            {users.length ? (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead><tr><th>Usuario</th><th>Plan / rol</th><th>Estado</th><th>Alta</th><th style={{ textAlign: "right" }}>Acciones</th></tr></thead>
                  <tbody>
                    {users.map((item) => {
                      const label = item.display_name || item.email?.split("@")[0] || "Usuario";
                      const isActive = item.is_active !== false;
                      return (
                        <tr key={item.id}>
                          <td><div className="users-user"><span className="users-avatar">{initials(label)}</span><div><strong>{label}</strong><small>{item.email || item.id}</small></div></div></td>
                          <td><span className={`users-role ${roleClass(item.role)}`}>{roleLabel(item.role)}</span></td>
                          <td><span className={`users-status ${isActive ? "users-status-active" : "users-status-inactive"}`}>{isActive ? "Activo" : "De baja"}</span></td>
                          <td><span className="users-date">{formatDate(item.created_at)}</span></td>
                          <td>
                            <div className="users-actions">
                              <form action={adminUpdateUser}>
                                <input type="hidden" name="user_id" value={item.id} />
                                <input type="hidden" name="role" value={item.role || "free"} />
                                <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
                                <button className="users-btn users-btn-toggle" type="submit">{isActive ? "Dar de baja" : "Reactivar"}</button>
                              </form>
                              <form action={adminUpdateUser}>
                                <input type="hidden" name="user_id" value={item.id} />
                                <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
                                <select className="users-select" name="role" defaultValue={item.role || "free"} aria-label={`Rol de ${label}`}>
                                  <option value="free">Free</option>
                                  <option value="pro">Pro</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button className="users-btn users-btn-save" type="submit">Guardar</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="users-empty"><strong>No hay usuarios registrados.</strong><span>Las nuevas cuentas aparecerán aquí automáticamente.</span></div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
