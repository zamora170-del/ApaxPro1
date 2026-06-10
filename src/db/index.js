// ═══════════════════════════════════════════════════════════════════════════
// CAPA DE BASE DE DATOS — localStorage como espejo del schema SQLite v5.0
// Fiel a: PROMPT_TALLER_v5.0_FINAL.md, sección 2
//
// REAJUSTE PWA: localStorage reemplaza SQLite+better-sqlite3.
// Todos los constraints (FK, CHECK, UNIQUE) se implementan en la capa de
// servicio (services/*). Los triggers se reimplementan como funciones JS.
// ═══════════════════════════════════════════════════════════════════════════

// ─── CLAVES DE ALMACENAMIENTO ─────────────────────────────────────────────────
export const T = {
  USUARIOS:        "tp5_usuarios",
  CLIENTES:        "tp5_clientes",
  PROVEEDORES:     "tp5_proveedores",
  LOTES:           "tp5_lotes",
  REPUESTOS:       "tp5_repuestos",
  ORDENES:         "tp5_ordenes",
  ORDEN_REPUESTOS: "tp5_orden_repuestos",
  ORDEN_FOTOS:     "tp5_orden_fotos",
  PAGOS:           "tp5_pagos",
  KARDEX:          "tp5_kardex",
  CAJA:            "tp5_caja",
  MOV_CAJA:        "tp5_mov_caja",
  AUDIT:           "tp5_audit",
  CONFIG:          "tp5_config",
  CONFIG_TALLER:   "tp5_config_taller",
  CONFIG_UI:       "tp5_config_ui",
  WIZARD_DONE:     "tp5_wizard_done",
  SESSION:         "tp5_session",
};

// ─── PRIMITIVAS CRUD ──────────────────────────────────────────────────────────
export const db = {
  get:    k       => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:    (k, v)  => { localStorage.setItem(k, JSON.stringify(v)); },
  getArr: k       => { const v = db.get(k); return Array.isArray(v) ? v : []; },
  setArr: (k, a)  => { db.set(k, a); },
  nextId: k       => { const a = db.getArr(k); return a.length ? Math.max(...a.map(r => r.id ?? 0)) + 1 : 1; },
  now:    ()      => new Date().toISOString(),
  today:  ()      => new Date().toISOString().slice(0, 10),
};

// ─── GENERADORES (sección 7) ──────────────────────────────────────────────────

/** 7.1 Genera código de repuesto: {PREFIJO}{SEQ_6} ej: RQ000001 */
export function generarCodigoRepuesto() {
  const cfg = db.get(T.CONFIG) || {};
  const pfx = cfg.formato_codigo_repuesto?.valor ?? "RQ";
  const arr  = db.getArr(T.REPUESTOS).filter(r => !r.deleted_at);
  if (!arr.length) return `${pfx}000001`;
  const max = Math.max(...arr.map(r => parseInt(r.codigo_interno.replace(pfx, "") || "0", 10)));
  return pfx + String(max + 1).padStart(6, "0");
}

/** 7.2 Genera número de orden: {PFX}-YYYYMMDD-{SEQ5} — secuencia global sin reset diario */
export function generarNumeroOrden() {
  const cfg  = db.get(T.CONFIG) || {};
  const pfx  = cfg.formato_codigo_orden?.valor ?? "ORD";
  const fecha = db.today().replace(/-/g, "");
  const arr   = db.getArr(T.ORDENES);
  let seq = 1;
  if (arr.length) {
    const ultima = arr[arr.length - 1].numero_orden ?? "";
    const partes = ultima.split("-");
    const n = parseInt(partes[partes.length - 1], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${pfx}-${fecha}-${String(seq).padStart(5, "0")}`;
}

// ─── CONFIG HELPERS ───────────────────────────────────────────────────────────
export function getCfg(clave, defVal = null) {
  const cfg = db.get(T.CONFIG);
  if (!cfg || !cfg[clave]) return defVal;
  const { valor, tipo_valor } = cfg[clave];
  if (tipo_valor === "numero") return parseFloat(valor);
  if (tipo_valor === "booleano") return valor === "true";
  return valor;
}

export function getConfigTaller() {
  return db.get(T.CONFIG_TALLER) || {};
}

export function getConfigUI() {
  return db.get(T.CONFIG_UI) || {};
}

// ─── SALDO DE CAJA (sección 2.16 query) ──────────────────────────────────────
/** Reconstruye saldo_actual desde movimientos_caja — [VAL-04] */
export function calcularSaldoCaja() {
  const caja = db.get(T.CAJA);
  if (!caja) return 0;
  const movs = db.getArr(T.MOV_CAJA);
  const delta = movs.reduce((acc, m) => acc + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);
  return (caja.saldo_inicial ?? 0) + delta;
}

/** Total de una orden = (mano_obra + repuestos) × (1 - descuento/100) */
export function calcularTotalOrden(ordenId) {
  const ord = db.getArr(T.ORDENES).find(o => o.id === ordenId);
  if (!ord) return 0;
  const reps = db.getArr(T.ORDEN_REPUESTOS).filter(o => o.orden_id === ordenId);
  const totalRep = reps.reduce((s, r) => s + r.valor_unitario * r.cantidad, 0);
  return ((ord.valor_mano_obra ?? 0) + totalRep) * (1 - (ord.descuento ?? 0) / 100);
}

/** Total pagado de una orden */
export function calcularPagadoOrden(ordenId) {
  return db.getArr(T.PAGOS).filter(p => p.orden_id === ordenId).reduce((s, p) => s + p.monto, 0);
}

// ─── INICIALIZACIÓN — SEEDS (sección 10 PRIMER INICIO) ───────────────────────
export function initDB() {
  // Sólo se ejecuta una vez (detectar si ya existe CONFIG)
  if (db.get(T.CONFIG) !== null) return;

  // configuracion (sección 2.6)
  db.set(T.CONFIG, {
    factor_instalacion:      { valor:"1.5",  tipo_valor:"numero",  descripcion:"Multiplicador sobre costo_unitario del lote" },
    stock_minimo_global:     { valor:"2",    tipo_valor:"numero",  descripcion:"Alerta cuando stock cae por debajo de este valor" },
    plazo_recogida_dias:     { valor:"30",   tipo_valor:"numero",  descripcion:"Días antes de considerar equipo abandonado" },
    garantia_taller_dias:    { valor:"30",   tipo_valor:"numero",  descripcion:"Días de garantía post-reparación" },
    formato_codigo_repuesto: { valor:"RQ",   tipo_valor:"texto",   descripcion:"Prefijo para códigos internos de repuestos" },
    formato_codigo_orden:    { valor:"ORD",  tipo_valor:"texto",   descripcion:"Prefijo para número de orden" },
    intentos_maximos_login:  { valor:"5",    tipo_valor:"numero",  descripcion:"Intentos fallidos antes de bloquear cuenta" },
    tiempo_bloqueo_minutos:  { valor:"15",   tipo_valor:"numero",  descripcion:"Minutos de bloqueo tras exceder intentos" },
    backup_contrasena:       { valor:"",     tipo_valor:"texto",   descripcion:"Contraseña ZIP del backup (vacío = sin cifrar)" },
    backup_dias_retener:     { valor:"30",   tipo_valor:"numero",  descripcion:"Días que se conservan backups automáticos" },
    reserva_duracion_horas:  { valor:"2",    tipo_valor:"numero",  descripcion:"Horas que dura una reserva de repuesto" },
  });

  // configuracion_taller (sección 2.14) — 1 fila fija
  db.set(T.CONFIG_TALLER, {
    nombre_taller:"Mi Taller", nit_rut:"", propietario:"", direccion:"",
    ciudad:"", telefono:"", whatsapp:"", email:"", sitio_web:"",
    slogan:"", pie_factura:"Garantía 30 días en mano de obra.",
    logo_path:null, logo_mini_path:null,
  });

  // configuracion_ui (sección 2.15) — 1 fila fija
  db.set(T.CONFIG_UI, {
    tema:"claro", color_primario:"#4f46e5", color_secundario:"#64748B", color_acento:"#f59e0b",
    fuente_interfaz:"DM Sans", escala_fuente:1.0,
    moneda_simbolo:"$", moneda_codigo:"COP",
    formato_fecha:"DD/MM/YYYY", separador_decimal:",", separador_miles:".",
    idioma:"es", mostrar_logo_login:1, sidebar_compacta:0,
  });

  // Proveedor APERTURA — id fijo = 1 (sección 2.4 seed)
  db.setArr(T.PROVEEDORES, [{
    id:1, nombre:"APERTURA", telefono:"", email:"", confiabilidad:5,
    created_at: db.now(),
  }]);

  // Lote STOCK INICIAL — id fijo = 1
  db.setArr(T.LOTES, [{
    id:1, referencia:"STOCK INICIAL 2026", proveedor_id:1,
    fecha_compra:"2026-01-01", factura:"APERTURA",
    cantidad:999, costo_unitario:0, created_at: db.now(),
  }]);

  // Colecciones vacías (se llenan con datos demo o en wizard)
  db.setArr(T.USUARIOS, []);
  db.setArr(T.CLIENTES, []);
  db.setArr(T.REPUESTOS, []);
  db.setArr(T.ORDENES, []);
  db.setArr(T.ORDEN_REPUESTOS, []);
  db.setArr(T.ORDEN_FOTOS, []);
  db.setArr(T.PAGOS, []);
  db.setArr(T.KARDEX, []);
  db.setArr(T.MOV_CAJA, []);
  db.setArr(T.AUDIT, []);
  db.set(T.CAJA, null); // se abre explícitamente
}
