import { useState, useEffect } from "react";
import { Building2, Palette, Settings, Shield, Database, Users, Save, CheckCircle, Plus, Lock, Unlock, RefreshCw, Download, Upload } from "lucide-react";
import { db, T, getCfg } from "../db/index.js";
import { guardarConfig, guardarConfigTaller, guardarConfigUI, exportarBackup, importarBackup } from "../services/config.js";
import { crearUsuario, cambiarPassword, toggleUsuario } from "../services/auth.js";
import { ROL_LABEL, ROL_COLOR } from "../constants.js";
import { PageHeader, Card, Button, Input, Select, Textarea, Toggle, Modal, DataTable, Badge, Alert, ConfirmDialog, fmtDate } from "../components/ui/index.jsx";

const TABS_CFG = [
  { id:"taller",    label:"Datos del Taller",  icon:Building2 },
  { id:"apariencia",label:"Apariencia",         icon:Palette },
  { id:"operacion", label:"Operación",          icon:Settings },
  { id:"seguridad", label:"Seguridad",          icon:Shield },
  { id:"backup",    label:"Backup y Datos",     icon:Database },
  { id:"usuarios",  label:"Usuarios",           icon:Users },
];

export default function Configuracion({ user }) {
  const [tab,   setTab]   = useState("taller");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  // ─── TALLER ──────────────────────────────────────────────────────────────
  const [taller, setTaller] = useState(() => db.get(T.CONFIG_TALLER) || {});
  const setT = f => setTaller(p => ({ ...p, ...f }));

  const guardarTaller = () => {
    if (!taller.nombre_taller?.trim()) { setError("El nombre del taller es requerido."); return; }
    setError("");
    guardarConfigTaller(taller, user.id);
    showSaved();
  };

  // ─── APARIENCIA ──────────────────────────────────────────────────────────
  const [ui, setUi] = useState(() => db.get(T.CONFIG_UI) || {});
  const setU = f => setUi(p => ({ ...p, ...f }));

  const guardarApariencia = () => {
    guardarConfigUI(ui, user.id);
    showSaved();
  };

  // ─── OPERACIÓN ───────────────────────────────────────────────────────────
  const [ops, setOps] = useState(() => {
    const cfg = db.get(T.CONFIG) || {};
    return {
      factor_instalacion:      parseFloat(cfg.factor_instalacion?.valor ?? "1.5"),
      stock_minimo_global:     parseInt(cfg.stock_minimo_global?.valor ?? "2"),
      plazo_recogida_dias:     parseInt(cfg.plazo_recogida_dias?.valor ?? "30"),
      garantia_taller_dias:    parseInt(cfg.garantia_taller_dias?.valor ?? "30"),
      reserva_duracion_horas:  parseInt(cfg.reserva_duracion_horas?.valor ?? "2"),
      formato_codigo_repuesto: cfg.formato_codigo_repuesto?.valor ?? "RQ",
      formato_codigo_orden:    cfg.formato_codigo_orden?.valor ?? "ORD",
    };
  });
  const setO = f => setOps(p => ({ ...p, ...f }));

  const guardarOps = () => {
    if (ops.factor_instalacion <= 0) { setError("El factor de instalación debe ser > 0."); return; }
    if (ops.stock_minimo_global < 0) { setError("El stock mínimo no puede ser negativo."); return; }
    if (!ops.formato_codigo_repuesto.trim() || !ops.formato_codigo_orden.trim()) { setError("Los prefijos no pueden estar vacíos."); return; }
    setError("");
    guardarConfig({
      factor_instalacion:      ops.factor_instalacion,
      stock_minimo_global:     ops.stock_minimo_global,
      plazo_recogida_dias:     ops.plazo_recogida_dias,
      garantia_taller_dias:    ops.garantia_taller_dias,
      reserva_duracion_horas:  ops.reserva_duracion_horas,
      formato_codigo_repuesto: ops.formato_codigo_repuesto,
      formato_codigo_orden:    ops.formato_codigo_orden,
    }, user.id);
    showSaved();
  };

  // ─── SEGURIDAD ───────────────────────────────────────────────────────────
  const [seg, setSeg] = useState(() => {
    const cfg = db.get(T.CONFIG) || {};
    return {
      intentos_maximos_login: parseInt(cfg.intentos_maximos_login?.valor ?? "5"),
      tiempo_bloqueo_minutos: parseInt(cfg.tiempo_bloqueo_minutos?.valor ?? "15"),
    };
  });

  const guardarSeg = () => {
    const i = seg.intentos_maximos_login;
    const t = seg.tiempo_bloqueo_minutos;
    if (i < 1 || i > 10)    { setError("Intentos debe estar entre 1 y 10."); return; }
    if (t < 1 || t > 1440)  { setError("Tiempo de bloqueo debe ser entre 1 y 1440 minutos."); return; }
    setError("");
    guardarConfig({ intentos_maximos_login: i, tiempo_bloqueo_minutos: t }, user.id);
    showSaved();
  };

  // ─── USUARIOS ────────────────────────────────────────────────────────────
  const [usuarios,   setUsuarios]   = useState([]);
  const [userModal,  setUserModal]  = useState(null);
  const [pwdModal,   setPwdModal]   = useState(null);
  const [userForm,   setUserForm]   = useState({ nombre:"", email:"", rol:"TEC", password:"", confirm:"" });
  const [newPwd,     setNewPwd]     = useState({ password:"", confirm:"" });
  const [userError,  setUserError]  = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const cargarUsuarios = () => setUsuarios(db.getArr(T.USUARIOS));
  useEffect(cargarUsuarios, []);

  const handleCrearUsuario = async () => {
    setUserError("");
    if (!userForm.nombre.trim())           { setUserError("El nombre es requerido."); return; }
    if (!userForm.email.includes("@"))     { setUserError("Email inválido."); return; }
    if (userForm.password.length < 8)      { setUserError("La contraseña debe tener mínimo 8 caracteres."); return; }
    if (userForm.password !== userForm.confirm) { setUserError("Las contraseñas no coinciden."); return; }
    try {
      await crearUsuario({ nombre:userForm.nombre, email:userForm.email, rol:userForm.rol, password:userForm.password }, user.id);
      cargarUsuarios(); setUserModal(null); setUserForm({ nombre:"", email:"", rol:"TEC", password:"", confirm:"" });
    } catch(e) {
      setUserError(e.message === "EMAIL_DUPLICADO" ? "Ya existe un usuario con ese email." : e.message);
    }
  };

  const handleCambiarPwd = async () => {
    setUserError("");
    if (newPwd.password.length < 8)             { setUserError("Mínimo 8 caracteres."); return; }
    if (newPwd.password !== newPwd.confirm)      { setUserError("Las contraseñas no coinciden."); return; }
    try {
      await cambiarPassword(pwdModal.id, newPwd.password, user.id);
      setPwdModal(null); setNewPwd({ password:"", confirm:"" });
      showSaved();
    } catch(e) { setUserError(e.message); }
  };

  const handleToggle = (u) => {
    try { toggleUsuario(u.id, user.id); cargarUsuarios(); }
    catch(e) { alert(e.message === "ULTIMO_ADM" ? "No puedes desactivar el único Administrador activo." : e.message); }
  };

  // ─── BACKUP ──────────────────────────────────────────────────────────────
  const handleImportar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importarBackup(file);
      alert("Backup restaurado correctamente. La app se recargará.");
      window.location.reload();
    } catch { alert("Archivo de backup inválido. Verifique el formato JSON."); }
  };

  const resetearDatos = () => {
    const conf = prompt("Escribe CONFIRMAR para borrar todos los datos:");
    if (conf !== "CONFIRMAR") return;
    Object.values(T).forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <div className="page-in">
      <PageHeader title="Configuración" subtitle="Administración del sistema · Solo ADM"
        actions={<>
          {saved && <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold"><CheckCircle size={16}/>Guardado</span>}
        </>}
      />

      <div className="flex gap-6">
        {/* Sidebar de navegación */}
        <div className="w-52 flex-shrink-0">
          <Card className="p-2">
            <nav className="space-y-0.5">
              {TABS_CFG.map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setError(""); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition
                    ${tab === t.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <t.icon size={16} className="flex-shrink-0" />{t.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">

          {/* ─── DATOS DEL TALLER ─────────────────────────────────────────── */}
          {tab === "taller" && (
            <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-5">Datos del Taller</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre del taller *" value={taller.nombre_taller} onChange={v=>setT({nombre_taller:v})} required className="col-span-2" />
                <Input label="NIT / RUT" value={taller.nit_rut??""} onChange={v=>setT({nit_rut:v})} />
                <Input label="Propietario" value={taller.propietario??""} onChange={v=>setT({propietario:v})} />
                <Input label="Dirección" value={taller.direccion??""} onChange={v=>setT({direccion:v})} />
                <Input label="Ciudad" value={taller.ciudad??""} onChange={v=>setT({ciudad:v})} />
                <Input label="Teléfono" value={taller.telefono??""} onChange={v=>setT({telefono:v})} />
                <Input label="WhatsApp" value={taller.whatsapp??""} onChange={v=>setT({whatsapp:v})} />
                <Input label="Email" value={taller.email??""} onChange={v=>setT({email:v})} type="email" className="col-span-2" />
                <Input label="Sitio web" value={taller.sitio_web??""} onChange={v=>setT({sitio_web:v})} className="col-span-2" />
                <Input label="Slogan" value={taller.slogan??""} onChange={v=>setT({slogan:v})} className="col-span-2" />
                <Textarea label="Pie de factura" value={taller.pie_factura??""} onChange={v=>setT({pie_factura:v})} className="col-span-2" hint="Texto que aparece al pie de tickets y reportes." />
              </div>
              {error && <Alert type="danger" className="mt-4">{error}</Alert>}
              <div className="flex justify-end mt-6"><Button onClick={guardarTaller} icon={<Save size={14}/>}>Guardar cambios</Button></div>
            </Card>
          )}

          {/* ─── APARIENCIA ───────────────────────────────────────────────── */}
          {tab === "apariencia" && (
            <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-5">Apariencia e Interfaz</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Tema</label>
                  <div className="flex gap-2">
                    {["claro","oscuro","sistema"].map(t => (
                      <button key={t} type="button" onClick={()=>setU({tema:t})}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition
                          ${ui.tema===t?"border-indigo-600 bg-indigo-50 text-indigo-700":"border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        {t==="claro"?"☀️ Claro":t==="oscuro"?"🌙 Oscuro":"💻 Sistema"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[["color_primario","Color primario"],["color_secundario","Color secundario"],["color_acento","Color acento"]].map(([k,l])=>(
                    <div key={k}>
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">{l}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={ui[k]||"#000000"} onChange={e=>setU({[k]:e.target.value})} className="w-10 h-10 rounded cursor-pointer border border-slate-200" />
                        <span className="text-sm font-mono text-slate-600">{ui[k]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Escala de fuente: {Math.round((ui.escala_fuente??1)*100)}%</label>
                  <input type="range" min={0.8} max={1.4} step={0.1} value={ui.escala_fuente??1} onChange={e=>setU({escala_fuente:parseFloat(e.target.value)})} className="w-full" />
                  <div className="flex justify-between text-xs text-slate-400 mt-1"><span>80%</span><span>100%</span><span>140%</span></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Select label="Formato de fecha" value={ui.formato_fecha} onChange={v=>setU({formato_fecha:v})}
                    options={["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].map(v=>({value:v,label:v}))} />
                  <Select label="Moneda" value={ui.moneda_codigo} onChange={v=>setU({moneda_codigo:v})}
                    options={[{value:"COP",label:"COP — Peso colombiano"},{value:"USD",label:"USD — Dólar"},{value:"EUR",label:"EUR — Euro"}]} />
                  <Select label="Separador decimal" value={ui.separador_decimal} onChange={v=>setU({separador_decimal:v})}
                    options={[{value:",",label:"Coma (1.234,56)"},{value:".",label:"Punto (1,234.56)"}]} />
                </div>
                <Toggle checked={!!ui.sidebar_compacta} onChange={v=>setU({sidebar_compacta:v?1:0})} label="Sidebar compacta" />
              </div>
              <div className="flex justify-end mt-6"><Button onClick={guardarApariencia} icon={<Save size={14}/>}>Guardar cambios</Button></div>
            </Card>
          )}

          {/* ─── OPERACIÓN ────────────────────────────────────────────────── */}
          {tab === "operacion" && (
            <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-5">Parámetros Operativos</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Factor de instalación" value={ops.factor_instalacion} onChange={v=>setO({factor_instalacion:parseFloat(v)||1.5})} type="number" hint="Multiplicador sobre costo del lote (e.g. 1.5 = 50% margen)" />
                <Input label="Stock mínimo global" value={ops.stock_minimo_global} onChange={v=>setO({stock_minimo_global:parseInt(v)||2})} type="number" hint="Alerta cuando el disponible cae por debajo" />
                <Input label="Plazo recogida (días)" value={ops.plazo_recogida_dias} onChange={v=>setO({plazo_recogida_dias:parseInt(v)||30})} type="number" hint="Días antes de considerar equipo abandonado" />
                <Input label="Garantía taller (días)" value={ops.garantia_taller_dias} onChange={v=>setO({garantia_taller_dias:parseInt(v)||30})} type="number" hint="Días de garantía post-reparación" />
                <Input label="Duración reserva (horas)" value={ops.reserva_duracion_horas} onChange={v=>setO({reserva_duracion_horas:parseInt(v)||2})} type="number" hint="Horas que dura una reserva de repuesto" />
                <div />
                <Input label="Prefijo código repuesto" value={ops.formato_codigo_repuesto} onChange={v=>setO({formato_codigo_repuesto:v})} hint={`Ej: RQ → ${ops.formato_codigo_repuesto}000001`} />
                <Input label="Prefijo número de orden" value={ops.formato_codigo_orden} onChange={v=>setO({formato_codigo_orden:v})} hint={`Ej: ORD → ${ops.formato_codigo_orden}-20260501-00001`} />
              </div>
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                <strong>Vista previa:</strong> Repuesto → <code className="font-mono">{ops.formato_codigo_repuesto}000001</code> · Orden → <code className="font-mono">{ops.formato_codigo_orden}-{db.today().replace(/-/g,"")}-00001</code>
              </div>
              {error && <Alert type="danger" className="mt-4">{error}</Alert>}
              <div className="flex justify-end mt-6"><Button onClick={guardarOps} icon={<Save size={14}/>}>Guardar cambios</Button></div>
            </Card>
          )}

          {/* ─── SEGURIDAD ────────────────────────────────────────────────── */}
          {tab === "seguridad" && (
            <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-5">Seguridad de la Cuenta</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Intentos máximos de login" value={seg.intentos_maximos_login} onChange={v=>setSeg(p=>({...p,intentos_maximos_login:parseInt(v)||5}))} type="number" hint="1–10 intentos antes de bloquear" />
                <Input label="Tiempo de bloqueo (minutos)" value={seg.tiempo_bloqueo_minutos} onChange={v=>setSeg(p=>({...p,tiempo_bloqueo_minutos:parseInt(v)||15}))} type="number" hint="1–1440 minutos" />
              </div>
              <Alert type="warning" className="mt-4">
                Las contraseñas se almacenan como <strong>hash SHA-256</strong> vía Web Crypto API. La sesión activa solo existe en memoria del navegador y expira al cerrarla.
              </Alert>
              {error && <Alert type="danger" className="mt-4">{error}</Alert>}
              <div className="flex justify-end mt-6"><Button onClick={guardarSeg} icon={<Save size={14}/>}>Guardar cambios</Button></div>
            </Card>
          )}

          {/* ─── BACKUP Y DATOS ───────────────────────────────────────────── */}
          {tab === "backup" && (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-bold text-slate-800 mb-4">Exportar / Importar datos</h3>
                <p className="text-sm text-slate-500 mb-4">Todos los datos se almacenan localmente en el navegador (localStorage). Exporta un backup JSON para conservarlos.</p>
                <div className="flex gap-3">
                  <Button onClick={exportarBackup} icon={<Download size={14}/>}>Exportar backup JSON</Button>
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer transition">
                    <Upload size={14}/> Restaurar desde backup
                    <input type="file" accept=".json" className="hidden" onChange={handleImportar} />
                  </label>
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold text-slate-800 mb-4">Exportar tablas a CSV</h3>
                <div className="flex flex-wrap gap-2">
                  {[["Clientes",T.CLIENTES],["Órdenes",T.ORDENES],["Repuestos",T.REPUESTOS],["Kardex",T.KARDEX],["Caja",T.MOV_CAJA],["Auditoría",T.AUDIT]].map(([label,key])=>(
                    <Button key={key} variant="secondary" size="sm" onClick={()=>exportarCSV(key)} icon={<Download size={13}/>}>{label}</Button>
                  ))}
                </div>
              </Card>
              <Card className="p-6 border-red-200">
                <div className="flex items-center gap-2 mb-4"><span className="text-red-600">⚠️</span><h3 className="font-bold text-red-800">Zona de peligro</h3></div>
                <p className="text-sm text-slate-500 mb-4">Estas acciones son irreversibles. Requieren confirmación explícita.</p>
                <Button variant="danger" onClick={resetearDatos}>Borrar todos los datos y reiniciar</Button>
              </Card>
            </div>
          )}

          {/* ─── USUARIOS ─────────────────────────────────────────────────── */}
          {tab === "usuarios" && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={()=>{setUserModal("nuevo");setUserForm({nombre:"",email:"",rol:"TEC",password:"",confirm:""});setUserError("");}} icon={<Plus size={14}/>}>Crear usuario</Button>
              </div>
              <Card>
                <DataTable
                  columns={[
                    { key:"nombre", label:"Nombre",  render:v=><span className="font-semibold">{v}</span> },
                    { key:"email",  label:"Email",   render:v=><span className="text-slate-500 text-xs">{v}</span> },
                    { key:"rol",    label:"Rol",     render:v=><Badge className={ROL_COLOR[v]}>{ROL_LABEL[v]}</Badge> },
                    { key:"activo", label:"Estado",  render:v=>v?<Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>:<Badge className="bg-slate-100 text-slate-500">Inactivo</Badge> },
                    { key:"created_at",label:"Alta", render:v=>fmtDate(v) },
                    { key:"_acc", label:"", render:(_,row)=>(
                      <div className="flex gap-1">
                        <button onClick={()=>handleToggle(row)} className={`p-1.5 rounded hover:bg-slate-100 transition ${row.activo?"text-emerald-600":"text-slate-400"}`} title={row.activo?"Desactivar":"Activar"}>
                          {row.activo?<Unlock size={14}/>:<Lock size={14}/>}
                        </button>
                        <button onClick={()=>{setPwdModal(row);setNewPwd({password:"",confirm:""});setUserError("");}} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition" title="Cambiar contraseña"><RefreshCw size={14}/></button>
                      </div>
                    )},
                  ]}
                  data={usuarios}
                />
              </Card>

              {/* Modal crear usuario */}
              {userModal === "nuevo" && (
                <Modal title="Crear usuario" onClose={()=>setUserModal(null)} size="sm"
                  footer={<><Button variant="secondary" onClick={()=>setUserModal(null)}>Cancelar</Button><Button onClick={handleCrearUsuario}>Crear</Button></>}>
                  <div className="space-y-3">
                    <Input label="Nombre completo *" value={userForm.nombre} onChange={v=>setUserForm(p=>({...p,nombre:v}))} required />
                    <Input label="Correo electrónico *" value={userForm.email} onChange={v=>setUserForm(p=>({...p,email:v}))} type="email" required />
                    <Select label="Rol" value={userForm.rol} onChange={v=>setUserForm(p=>({...p,rol:v}))}
                      options={Object.entries(ROL_LABEL).map(([v,l])=>({value:v,label:l}))} />
                    <Input label="Contraseña * (mín. 8)" value={userForm.password} onChange={v=>setUserForm(p=>({...p,password:v}))} type="password" />
                    <Input label="Confirmar contraseña *" value={userForm.confirm} onChange={v=>setUserForm(p=>({...p,confirm:v}))} type="password" />
                  </div>
                  {userError && <Alert type="danger" className="mt-3">{userError}</Alert>}
                </Modal>
              )}

              {/* Modal cambiar contraseña */}
              {pwdModal && (
                <Modal title={`Cambiar contraseña · ${pwdModal.nombre}`} onClose={()=>setPwdModal(null)} size="sm"
                  footer={<><Button variant="secondary" onClick={()=>setPwdModal(null)}>Cancelar</Button><Button onClick={handleCambiarPwd}>Guardar</Button></>}>
                  <div className="space-y-3">
                    <Input label="Nueva contraseña * (mín. 8)" value={newPwd.password} onChange={v=>setNewPwd(p=>({...p,password:v}))} type="password" />
                    <Input label="Confirmar contraseña *" value={newPwd.confirm} onChange={v=>setNewPwd(p=>({...p,confirm:v}))} type="password" />
                  </div>
                  {userError && <Alert type="danger" className="mt-3">{userError}</Alert>}
                </Modal>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
