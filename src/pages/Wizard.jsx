// ─── WIZARD DE PRIMER INICIO — sección 10 ────────────────────────────────────
import { useState } from "react";
import { Wrench, ChevronRight, Check, User, Building2, Palette } from "lucide-react";
import { db, T } from "../db/index.js";
import { crearAdminInicial } from "../services/auth.js";
import { guardarConfigTaller, guardarConfigUI } from "../services/config.js";
import { Input, Button, Select, Alert } from "../components/ui/index.jsx";

const PASOS = [
  { id: 1, label: "Datos del Taller", icon: Building2 },
  { id: 2, label: "Usuario ADM",      icon: User },
  { id: 3, label: "Apariencia",       icon: Palette },
];

export default function Wizard({ onDone }) {
  const [paso, setPaso]   = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Paso 1 — Datos del taller
  const [taller, setTaller] = useState({
    nombre_taller: "", ciudad: "", telefono: "", email: "",
    nit_rut: "", propietario: "",
  });

  // Paso 2 — Admin
  const [admin, setAdmin] = useState({ nombre: "", email: "", password: "", confirm: "" });

  // Paso 3 — Apariencia (opcional, tiene defaults)
  const [ui, setUi] = useState({ color_primario: "#4f46e5", moneda_codigo: "COP", idioma: "es" });

  const setT = f => setTaller(p => ({ ...p, ...f }));
  const setA = f => setAdmin(p => ({ ...p, ...f }));
  const setU = f => setUi(p => ({ ...p, ...f }));

  // ─── Validaciones por paso ────────────────────────────────────────────────
  function validarPaso1() {
    if (!taller.nombre_taller.trim()) return "El nombre del taller es requerido.";
    return null;
  }
  function validarPaso2() {
    if (!admin.nombre.trim())   return "El nombre es requerido.";
    if (!admin.email.includes("@")) return "Email inválido.";
    if (admin.password.length < 8)  return "La contraseña debe tener mínimo 8 caracteres.";
    if (admin.password !== admin.confirm) return "Las contraseñas no coinciden.";
    return null;
  }

  // ─── Finalizar wizard ─────────────────────────────────────────────────────
  async function finalizar() {
    setLoading(true); setError("");
    try {
      // a. Guardar datos del taller
      guardarConfigTaller(taller, null);
      // b. Crear usuario ADM (sección 10 wizard paso b)
      await crearAdminInicial(admin.nombre, admin.email, admin.password);
      // c. Guardar apariencia (opcional)
      guardarConfigUI(ui, null);
      // Marcar wizard como completado
      db.set(T.WIZARD_DONE, true);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Navegar entre pasos ─────────────────────────────────────────────────
  async function siguiente() {
    setError("");
    if (paso === 1) {
      const err = validarPaso1();
      if (err) { setError(err); return; }
      setPaso(2);
    } else if (paso === 2) {
      const err = validarPaso2();
      if (err) { setError(err); return; }
      setPaso(3);
    } else {
      await finalizar();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4"
      style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
            style={{ boxShadow: "0 0 48px rgba(99,102,241,.5)" }}>
            <Wrench size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">TallerPro v5.0</h1>
          <p className="text-indigo-300 mt-1 text-sm">Configuración inicial · {paso} de {PASOS.length}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {PASOS.map((p, i) => {
            const done   = paso > p.id;
            const active = paso === p.id;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition
                  ${active ? "bg-indigo-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"}`}>
                  {done ? <Check size={12} /> : <p.icon size={12} />}
                  <span className="hidden sm:inline">{p.label}</span>
                </div>
                {i < PASOS.length - 1 && <ChevronRight size={14} className="text-white/30" />}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* PASO 1 */}
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Datos del Taller</h2>
                <p className="text-sm text-slate-500 mt-1">Información institucional que aparecerá en tickets y reportes.</p>
              </div>
              <Input label="Nombre del taller *" value={taller.nombre_taller} onChange={v => setT({ nombre_taller: v })} placeholder="Ej: TechFix Bogotá" autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Ciudad" value={taller.ciudad} onChange={v => setT({ ciudad: v })} placeholder="Bogotá" />
                <Input label="NIT / RUT" value={taller.nit_rut} onChange={v => setT({ nit_rut: v })} placeholder="900.123.456-7" />
                <Input label="Teléfono" value={taller.telefono} onChange={v => setT({ telefono: v })} placeholder="3001234567" />
                <Input label="Email" value={taller.email} onChange={v => setT({ email: v })} type="email" placeholder="info@taller.co" />
              </div>
              <Input label="Propietario" value={taller.propietario} onChange={v => setT({ propietario: v })} />
            </div>
          )}

          {/* PASO 2 */}
          {paso === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Crear usuario Administrador</h2>
                <p className="text-sm text-slate-500 mt-1">Este usuario tendrá acceso total al sistema.</p>
              </div>
              <Input label="Nombre completo *" value={admin.nombre} onChange={v => setA({ nombre: v })} autoFocus />
              <Input label="Correo electrónico *" value={admin.email} onChange={v => setA({ email: v })} type="email" />
              <Input label="Contraseña * (mín. 8 caracteres)" value={admin.password} onChange={v => setA({ password: v })} type="password" />
              <Input label="Confirmar contraseña *" value={admin.confirm} onChange={v => setA({ confirm: v })} type="password"
                onKeyDown={e => e.key === "Enter" && siguiente()} />
            </div>
          )}

          {/* PASO 3 */}
          {paso === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Apariencia</h2>
                <p className="text-sm text-slate-500 mt-1">Personalización básica. Puedes cambiarla después en Configuración.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Color primario</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={ui.color_primario} onChange={e => setU({ color_primario: e.target.value })}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-slate-200" />
                  <span className="text-sm font-mono text-slate-600">{ui.color_primario}</span>
                </div>
              </div>
              <Select label="Moneda" value={ui.moneda_codigo} onChange={v => setU({ moneda_codigo: v })}
                options={[{ value:"COP", label:"COP — Peso colombiano" },{ value:"USD", label:"USD — Dólar" },{ value:"EUR", label:"EUR — Euro" }]} />
              <div className="p-4 bg-indigo-50 rounded-xl text-sm text-indigo-700 border border-indigo-100">
                ✨ Todo listo. Al continuar se creará tu base de datos y podrás empezar a usar TallerPro.
              </div>
            </div>
          )}

          {/* Error */}
          {error && <Alert type="danger" className="mt-4">{error}</Alert>}

          {/* Botones */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setPaso(p => p - 1)} disabled={paso === 1}>
              ← Anterior
            </Button>
            <Button onClick={siguiente} disabled={loading} icon={paso < 3 ? <ChevronRight size={16} /> : <Check size={16} />}>
              {loading ? "Guardando..." : paso < 3 ? "Continuar" : "Comenzar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
