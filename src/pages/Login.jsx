// ─── LOGIN — sección 10 flujo normal paso 1 ──────────────────────────────────
import { useState } from "react";
import { Wrench, Eye, EyeOff, AlertCircle } from "lucide-react";
import { loginUser } from "../services/auth.js";
import { db, T } from "../db/index.js";
import { Input, Button } from "../components/ui/index.jsx";

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const taller  = db.get(T.CONFIG_TALLER) || {};
  const usuarios = db.getArr(T.USUARIOS).filter(u => u.activo && !u.deleted_at);

  const handle = async () => {
    if (!email.trim() || !password) { setError("Completa todos los campos."); return; }
    setLoading(true); setError("");
    try {
      const user = await loginUser(email, password);
      onLogin(user);
    } catch (e) {
      const msg = e.message ?? "";
      if (msg.startsWith("BLOQUEADO:")) {
        setError(`Cuenta bloqueada. Intenta en ${msg.split(":")[1]} minuto(s).`);
      } else {
        setError("Credenciales incorrectas. Intenta de nuevo.");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily:"'DM Sans',system-ui,sans-serif", background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)" }}>
      {/* Panel izquierdo */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow:"0 0 60px rgba(99,102,241,.45)" }}>
            <Wrench size={38} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
            {taller.nombre_taller || "TallerPro"}
          </h1>
          <p className="text-indigo-300 text-lg">Sistema de Gestión v5.0</p>
          <p className="text-indigo-400/70 text-sm mt-1">Offline-first · 100% local · Sin servidor</p>

          {/* Feature pills */}
          <div className="mt-10 grid grid-cols-2 gap-3 text-left max-w-sm">
            {[["📱","Órdenes","Flujo completo 8 estados"],["📦","Inventario","Kardex FIFO inmutable"],["💳","Caja","Movimientos contables seguros"],["📊","Reportes","Dashboard financiero y operativo"]].map(([emoji,t,d]) => (
              <div key={t} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="font-bold text-white text-sm">{emoji} {t}</div>
                <div className="text-indigo-300 text-xs mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="w-full lg:w-[440px] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Wrench size={20} className="text-white" />
            </div>
            <span className="text-xl font-black text-slate-900">{taller.nombre_taller || "TallerPro"}</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Bienvenido</h2>
          <p className="text-slate-500 text-sm mb-8">Ingresa tus credenciales para continuar</p>

          <div className="space-y-4">
            <Input label="Correo electrónico" value={email} onChange={setEmail} type="email"
              placeholder="usuario@taller.co" onKeyDown={e => e.key === "Enter" && handle()} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contraseña</label>
              <div className="relative">
                <input type={show ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handle()}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                <button type="button" onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <AlertCircle size={16} className="flex-shrink-0" />{error}
              </div>
            )}

            <Button onClick={handle} disabled={loading} className="w-full justify-center py-2.5 text-sm">
              {loading ? "Verificando..." : "Iniciar sesión"}
            </Button>
          </div>

          {/* Accesos demo */}
          {usuarios.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
                Accesos registrados
              </p>
              <div className="space-y-2">
                {usuarios.slice(0, 5).map(u => (
                  <button key={u.id} type="button"
                    onClick={() => { setEmail(u.email); setPassword(""); }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200
                      hover:border-indigo-300 hover:bg-indigo-50 transition-all text-xs">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-bold mr-2 text-[10px] ${
                      u.rol==="ADM"?"bg-violet-100 text-violet-700":
                      u.rol==="CON"?"bg-blue-100 text-blue-700":
                      u.rol==="TEC"?"bg-orange-100 text-orange-700":
                      u.rol==="REC"?"bg-green-100 text-green-700":
                      "bg-slate-100 text-slate-600"}`}>{u.rol}</span>
                    <span className="text-slate-700 font-medium">{u.nombre}</span>
                    <span className="text-slate-400 ml-1">· {u.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
