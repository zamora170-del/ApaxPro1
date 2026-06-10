// ─── APP RAÍZ — TallerPro v5.0 ───────────────────────────────────────────────
import { useState, useEffect } from "react";
import { initDB, db, T } from "./db/index.js";
import { getSession } from "./services/auth.js";
import { AppLayout } from "./components/layout/index.jsx";
import Wizard        from "./pages/Wizard.jsx";
import Login         from "./pages/Login.jsx";
import Dashboard     from "./pages/Dashboard.jsx";
import Clientes      from "./pages/Clientes.jsx";
import Ordenes       from "./pages/Ordenes.jsx";
import Inventario    from "./pages/Inventario.jsx";
import Kardex        from "./pages/Kardex.jsx";
import Caja          from "./pages/Caja.jsx";
import Reportes      from "./pages/Reportes.jsx";
import Configuracion from "./pages/Configuracion.jsx";
import { PERMISOS }  from "./constants.js";

// ─── Spinner de carga inicial ─────────────────────────────────────────────────
function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔧</span>
        </div>
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full spin mx-auto mt-3" />
      </div>
    </div>
  );
}

// ─── Enrutador de páginas ─────────────────────────────────────────────────────
function PageRouter({ page, user, onNav }) {
  const perms = PERMISOS[user.rol] || {};

  // Guard: si el rol no tiene acceso a la página, redirigir al dashboard
  const guarded = {
    caja:   perms.caja_abrir || perms.caja_egreso,
    config: perms.config,
  };
  if (guarded[page] === false) return <Dashboard user={user} />;

  switch (page) {
    case "dashboard":  return <Dashboard     user={user} />;
    case "clientes":   return <Clientes      user={user} />;
    case "ordenes":    return <Ordenes       user={user} />;
    case "inventario": return <Inventario    user={user} />;
    case "kardex":     return <Kardex        user={user} />;
    case "caja":       return <Caja          user={user} />;
    case "reportes":   return <Reportes      user={user} />;
    case "config":     return <Configuracion user={user} />;
    default:           return <Dashboard     user={user} />;
  }
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function App() {
  const [ready,       setReady]       = useState(false);
  const [wizardDone,  setWizardDone]  = useState(false);
  const [user,        setUser]        = useState(null);
  const [page,        setPage]        = useState("dashboard");

  useEffect(() => {
    // 1. Inicializar DB (sección 10 — PRIMER INICIO)
    initDB();
    // 2. Verificar si el wizard ya se completó
    const done = db.get(T.WIZARD_DONE);
    setWizardDone(!!done);
    // 3. Recuperar sesión activa
    const sesion = getSession();
    if (sesion) {
      // Verificar que el usuario aún existe y está activo
      const u = db.getArr(T.USUARIOS).find(x => x.id === sesion.id && x.activo);
      if (u) setUser(sesion);
      else   db.set(T.SESSION, null);
    }
    setReady(true);
  }, []);

  if (!ready) return <Loader />;

  // Wizard de primer inicio
  if (!wizardDone) {
    return <Wizard onDone={() => setWizardDone(true)} />;
  }

  // Login
  if (!user) {
    return <Login onLogin={u => { setUser(u); setPage("dashboard"); }} />;
  }

  // App principal
  return (
    <AppLayout user={user} page={page} onNav={setPage}>
      <PageRouter page={page} user={user} onNav={setPage} />
    </AppLayout>
  );
}
