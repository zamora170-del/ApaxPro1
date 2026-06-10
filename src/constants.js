// ─── ESTADOS DE ORDEN (sección 2.7) ─────────────────────────────────────────
export const ESTADOS = ["recibido","diagnostico","espera_repuesto","reparando","calidad","listo","entregado","anulado"];

export const ESTADO_LABEL = {
  recibido:"Recibido", diagnostico:"Diagnóstico", espera_repuesto:"Espera Repuesto",
  reparando:"Reparando", calidad:"Control Calidad", listo:"Listo",
  entregado:"Entregado", anulado:"Anulado",
};

export const ESTADO_COLOR = {
  recibido:        "bg-slate-100 text-slate-700 border-slate-200",
  diagnostico:     "bg-blue-100 text-blue-700 border-blue-200",
  espera_repuesto: "bg-amber-100 text-amber-700 border-amber-200",
  reparando:       "bg-orange-100 text-orange-700 border-orange-200",
  calidad:         "bg-purple-100 text-purple-700 border-purple-200",
  listo:           "bg-green-100 text-green-700 border-green-200",
  entregado:       "bg-teal-100 text-teal-700 border-teal-200",
  anulado:         "bg-red-100 text-red-700 border-red-200",
};

// Transiciones válidas — sección 10 flujo normal
export const TRANSICIONES = {
  recibido:        ["diagnostico","anulado"],
  diagnostico:     ["espera_repuesto","reparando","anulado"],
  espera_repuesto: ["reparando","anulado"],
  reparando:       ["calidad","anulado"],
  calidad:         ["listo","reparando"],
  listo:           ["entregado","anulado"],
  entregado:       [],
  anulado:         [],
};

// ─── ROLES Y PERMISOS (sección 3) ────────────────────────────────────────────
export const ROLES = ["ADM","CON","TEC","REC","AUD"];

export const ROL_LABEL = {
  ADM:"Administrador", CON:"Contador", TEC:"Técnico", REC:"Recepcionista", AUD:"Auditor",
};

export const ROL_COLOR = {
  ADM:"bg-violet-100 text-violet-700", CON:"bg-blue-100 text-blue-700",
  TEC:"bg-orange-100 text-orange-700", REC:"bg-green-100 text-green-700",
  AUD:"bg-slate-100 text-slate-600",
};

// Matriz completa de permisos — fiel a sección 3
export const PERMISOS = {
  ADM: {
    dashboard:true, dashboard_fin:true,
    clientes_ver:true, clientes_editar:true, clientes_eliminar:true,
    ordenes_ver:true, ordenes_ver_todas:true, ordenes_crear:true, ordenes_estado:true, ordenes_anular:true,
    inventario_ver:true, inventario_lote:true, inventario_ajuste:true, inventario_perdida:true,
    repuestos_asignar:true, repuestos_instalar:true,
    pagos_registrar:true, pagos_ver:true,
    caja_abrir:true, caja_egreso:true,
    reportes_operativos:true, reportes_financieros:true, reportes_auditoria:true,
    config:true, usuarios:true,
  },
  CON: {
    dashboard:true, dashboard_fin:true,
    clientes_ver:true, clientes_editar:false, clientes_eliminar:false,
    ordenes_ver:true, ordenes_ver_todas:true, ordenes_crear:false, ordenes_estado:false, ordenes_anular:false,
    inventario_ver:true, inventario_lote:true, inventario_ajuste:false, inventario_perdida:true,
    repuestos_asignar:false, repuestos_instalar:false,
    pagos_registrar:true, pagos_ver:true,
    caja_abrir:true, caja_egreso:true,
    reportes_operativos:true, reportes_financieros:true, reportes_auditoria:false,
    config:false, usuarios:false,
  },
  TEC: {
    dashboard:true, dashboard_fin:false,
    clientes_ver:true, clientes_editar:false, clientes_eliminar:false,
    ordenes_ver:true, ordenes_ver_todas:false, ordenes_crear:false, ordenes_estado:true, ordenes_anular:false,
    inventario_ver:true, inventario_lote:false, inventario_ajuste:false, inventario_perdida:true,
    repuestos_asignar:true, repuestos_instalar:true,
    pagos_registrar:false, pagos_ver:false,
    caja_abrir:false, caja_egreso:false,
    reportes_operativos:true, reportes_financieros:false, reportes_auditoria:false,
    config:false, usuarios:false,
  },
  REC: {
    dashboard:true, dashboard_fin:false,
    clientes_ver:true, clientes_editar:true, clientes_eliminar:false,
    ordenes_ver:true, ordenes_ver_todas:true, ordenes_crear:true, ordenes_estado:true, ordenes_anular:true,
    inventario_ver:true, inventario_lote:false, inventario_ajuste:false, inventario_perdida:false,
    repuestos_asignar:false, repuestos_instalar:false,
    pagos_registrar:true, pagos_ver:true,
    caja_abrir:false, caja_egreso:false,
    reportes_operativos:true, reportes_financieros:false, reportes_auditoria:false,
    config:false, usuarios:false,
  },
  AUD: {
    dashboard:true, dashboard_fin:true,
    clientes_ver:true, clientes_editar:false, clientes_eliminar:false,
    ordenes_ver:true, ordenes_ver_todas:true, ordenes_crear:false, ordenes_estado:false, ordenes_anular:false,
    inventario_ver:true, inventario_lote:false, inventario_ajuste:false, inventario_perdida:false,
    repuestos_asignar:false, repuestos_instalar:false,
    pagos_registrar:false, pagos_ver:true,
    caja_abrir:false, caja_egreso:false,
    reportes_operativos:true, reportes_financieros:true, reportes_auditoria:true,
    config:false, usuarios:false,
  },
};

// ─── CALIDAD REPUESTOS ────────────────────────────────────────────────────────
export const CALIDAD_COLOR = {
  original:        "bg-emerald-100 text-emerald-700",
  compatible:      "bg-blue-100 text-blue-700",
  remanufacturado: "bg-amber-100 text-amber-700",
};

// ─── TIPOS KARDEX ─────────────────────────────────────────────────────────────
export const KARDEX_TIPOS = ["entrada","salida","ajuste_entrada","ajuste_salida","perdida"];
export const KARDEX_LABEL = {
  entrada:"Entrada", salida:"Salida", ajuste_entrada:"Ajuste (+)",
  ajuste_salida:"Ajuste (−)", perdida:"Pérdida",
};
export const KARDEX_COLOR = {
  entrada:"bg-emerald-100 text-emerald-700",
  salida:"bg-red-100 text-red-700",
  ajuste_entrada:"bg-blue-100 text-blue-700",
  ajuste_salida:"bg-amber-100 text-amber-700",
  perdida:"bg-slate-100 text-slate-600",
};
export const KARDEX_SIGNO = { entrada:"+", salida:"−", ajuste_entrada:"+", ajuste_salida:"−", perdida:"−" };

// ─── MÉTODOS DE PAGO ──────────────────────────────────────────────────────────
export const METODOS_PAGO = ["efectivo","tarjeta","transferencia","otros"];

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────
export const NAV = [
  { id:"dashboard",  label:"Dashboard",     icon:"LayoutDashboard", perms:["ADM","CON","TEC","REC","AUD"] },
  { id:"clientes",   label:"Clientes",      icon:"Users",           perms:["ADM","CON","TEC","REC","AUD"] },
  { id:"ordenes",    label:"Órdenes",       icon:"ClipboardList",   perms:["ADM","CON","TEC","REC","AUD"] },
  { id:"inventario", label:"Inventario",    icon:"Package",         perms:["ADM","CON","TEC","REC","AUD"] },
  { id:"kardex",     label:"Kardex",        icon:"BookOpen",        perms:["ADM","CON","TEC","REC","AUD"] },
  { id:"caja",       label:"Caja",          icon:"DollarSign",      perms:["ADM","CON"] },
  { id:"reportes",   label:"Reportes",      icon:"BarChart3",       perms:["ADM","CON","TEC","REC","AUD"] },
  { id:"config",     label:"Configuración", icon:"Settings",        perms:["ADM"] },
];
