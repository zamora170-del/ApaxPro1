// ─── LAYOUT COMPONENTS ────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, ClipboardList, Package, BookOpen,
  DollarSign, BarChart3, Settings, LogOut, Menu, Bell,
  Wrench, ChevronRight
} from "lucide-react";
import { NAV, ROL_LABEL, ROL_COLOR, PERMISOS } from "../../constants.js";
import { db, T, calcularSaldoCaja } from "../../db/index.js";
import { logout } from "../../services/auth.js";
import { liberarReservasVencidas } from "../../services/repuestos.js";
import { Badge } from "../ui/index.jsx";

const ICONS = { LayoutDashboard, Users, ClipboardList, Package, BookOpen, DollarSign, BarChart3, Settings };

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({ user, page, onNav, open }) {
  const perms   = PERMISOS[user.rol] || {};
  const taller  = db.get(T.CONFIG_TALLER) || {};
  const items   = NAV.filter(n => n.perms.includes(user.rol));

  return (
    <aside className={`${open ? "w-58" : "w-16"} flex-shrink-0 bg-slate-900 flex flex-col transition-all duration-200 overflow-hidden`}
      style={{ width: open ? 232 : 64 }}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-700/50 flex-shrink-0">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <Wrench size={16} className="text-white" />
        </div>
        {open && (
          <div className="ml-3 min-w-0">
            <p className="font-black text-white text-sm leading-tight truncate">
              {taller.nombre_taller || "TallerPro"}
            </p>
            <p className="text-indigo-400 text-[10px]">v5.0</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {items.map(item => {
          const Icon    = ICONS[item.icon];
          const isActive = page === item.id;
          return (
            <button key={item.id} onClick={() => onNav(item.id)}
              title={!open ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-left
                ${isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              {Icon && <Icon size={18} className="flex-shrink-0" />}
              {open && <span className="text-sm font-medium truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-slate-700/50 flex-shrink-0">
        <div className={`flex items-center gap-3 ${!open ? "justify-center" : ""}`}>
          <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {user.nombre?.[0]?.toUpperCase()}
          </div>
          {open && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{user.nombre}</p>
                <Badge className={`text-[10px] mt-0.5 ${ROL_COLOR[user.rol]}`}>{ROL_LABEL[user.rol]}</Badge>
              </div>
              <button onClick={() => { logout(user.id); window.location.reload(); }}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition flex-shrink-0"
                title="Cerrar sesión">
                <LogOut size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({ user, onToggleSidebar, onNav }) {
  const caja    = db.get(T.CAJA);
  const perms   = PERMISOS[user.rol] || {};
  const stockBajoCount = db.getArr(T.REPUESTOS).filter(r => {
    const cfg = db.get(T.CONFIG);
    const min = parseFloat(cfg?.stock_minimo_global?.valor ?? "2");
    return !r.deleted_at && (r.stock - r.stock_reservado) <= min;
  }).length;
  const listasCount = db.getArr(T.ORDENES).filter(o => o.estado === "listo").length;
  const notifCount  = stockBajoCount + listasCount;

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-4 flex-shrink-0">
      <button onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
        <Menu size={18} />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {/* Estado caja */}
        {perms.caja_abrir && (
          <button onClick={() => onNav("caja")}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition
              ${caja?.abierta ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {caja?.abierta ? "🟢 Caja abierta" : "🔴 Caja cerrada"}
          </button>
        )}
        {/* Notificaciones */}
        {notifCount > 0 && (
          <button onClick={() => onNav("dashboard")}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <Bell size={16} />
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center px-0.5">
              {notifCount}
            </span>
          </button>
        )}
        {/* Salir */}
        <button onClick={() => { logout(user.id); window.location.reload(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-sm font-medium transition">
          <LogOut size={15} /><span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}

// ─── APP LAYOUT ──────────────────────────────────────────────────────────────
export function AppLayout({ user, page, onNav, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Job: liberar reservas vencidas cada 5 min (sección 6.5)
  useEffect(() => {
    liberarReservasVencidas();
    const job = setInterval(liberarReservasVencidas, 5 * 60_000);
    return () => clearInterval(job);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <Sidebar user={user} page={page} onNav={onNav} open={sidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} onToggleSidebar={() => setSidebarOpen(v => !v)} onNav={onNav} />
        <main className="flex-1 overflow-y-auto p-6 page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
