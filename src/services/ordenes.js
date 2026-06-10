// ─── ORDENES SERVICE — sección 10, flujo completo ────────────────────────────
import { db, T, generarNumeroOrden, calcularTotalOrden, calcularPagadoOrden, getCfg } from "../db/index.js";
import { insertAuditLog } from "./audit.js";
import { liberarReservasVencidas } from "./repuestos.js";

// ─── CRUD CLIENTES ────────────────────────────────────────────────────────────
export function crearCliente({ nombre, telefono, email, direccion }, userId) {
  const clientes = db.getArr(T.CLIENTES);
  // idx_clientes_telefono_activo — unicidad de teléfono
  if (clientes.find(c => c.telefono === telefono && !c.deleted_at))
    throw new Error("TELEFONO_DUPLICADO");
  const nuevo = {
    id: db.nextId(T.CLIENTES), nombre, telefono,
    email: email ?? null, direccion: direccion ?? null,
    deleted_at: null, created_at: db.now(),
  };
  db.setArr(T.CLIENTES, [...clientes, nuevo]);
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "clientes", entidadId: nuevo.id,
    payload: { antes: null, despues: nuevo, campos: Object.keys(nuevo) } });
  return nuevo;
}

export function editarCliente(id, campos, userId) {
  const clientes = db.getArr(T.CLIENTES);
  const prev = clientes.find(c => c.id === id);
  if (!prev) throw new Error("CLIENTE_NO_ENCONTRADO");
  if (campos.telefono && campos.telefono !== prev.telefono) {
    if (clientes.find(c => c.telefono === campos.telefono && !c.deleted_at && c.id !== id))
      throw new Error("TELEFONO_DUPLICADO");
  }
  const updated = { ...prev, ...campos };
  db.setArr(T.CLIENTES, clientes.map(c => c.id === id ? updated : c));
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "clientes", entidadId: id,
    payload: { antes: prev, despues: updated, campos: Object.keys(campos) } });
}

export function eliminarCliente(id, userId) {
  const tieneActivas = db.getArr(T.ORDENES).some(
    o => o.cliente_id === id && !["entregado","anulado"].includes(o.estado) && !o.deleted_at
  );
  if (tieneActivas) throw new Error("CLIENTE_CON_ORDENES_ACTIVAS");
  const clientes = db.getArr(T.CLIENTES);
  const prev = clientes.find(c => c.id === id);
  db.setArr(T.CLIENTES, clientes.map(c => c.id === id ? { ...c, deleted_at: db.now() } : c));
  insertAuditLog({ usuarioId: userId, accion: "DELETE", entidad: "clientes", entidadId: id,
    payload: { antes: prev, despues: null, campos: [] } });
}

// ─── PASO 3 — CREAR ORDEN ─────────────────────────────────────────────────────
export function crearOrden({
  clienteId, equipoMarca, equipoModelo, imei, fallaReportada,
  tecnicoId, prioridad, valorManoObra, descuento,
}, userId) {
  // Validar IMEI si se proporcionó (14-16 dígitos) — sección 2.7
  if (imei && (imei.length < 14 || imei.length > 16))
    throw new Error("IMEI_INVALIDO");

  const cfg = db.get(T.CONFIG);
  const garantiaDias = getCfg("garantia_taller_dias", 30);

  const orden = {
    id:             db.nextId(T.ORDENES),
    numero_orden:   generarNumeroOrden(),
    cliente_id:     clienteId ?? null,
    equipo_marca:   equipoMarca ?? null,
    equipo_modelo:  equipoModelo ?? null,
    imei:           imei ?? null,
    estado:         "recibido",
    falla_reportada: fallaReportada ?? null,
    diagnostico:    null,
    tecnico_id:     tecnicoId ?? null,
    prioridad:      prioridad ?? "normal",
    fecha_ingreso:  db.now(),
    fecha_entrega:  null,
    valor_mano_obra: parseFloat(valorManoObra) || 0,
    descuento:      parseFloat(descuento) || 0,
    garantia_dias:  garantiaDias,
    motivo_anulacion: null,
    deleted_at:     null,
    created_by:     userId,
    created_at:     db.now(),
  };
  db.setArr(T.ORDENES, [...db.getArr(T.ORDENES), orden]);
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "ordenes_reparacion", entidadId: orden.id,
    payload: { antes: null, despues: orden, campos: Object.keys(orden) } });
  return orden;
}

// ─── AVANZAR ESTADO — con validaciones ───────────────────────────────────────
export function avanzarEstado(ordenId, nuevoEstado, nota, userId) {
  const ordenes = db.getArr(T.ORDENES);
  const orden   = ordenes.find(o => o.id === ordenId);
  if (!orden) throw new Error("ORDEN_NO_ENCONTRADA");

  // Validación: saldo pendiente en entregado (solo ADM puede forzar)
  if (nuevoEstado === "entregado") {
    const pendiente = calcularTotalOrden(ordenId) - calcularPagadoOrden(ordenId);
    const user      = db.getArr(T.USUARIOS).find(u => u.id === userId);
    if (pendiente > 0.01 && user?.rol !== "ADM")
      throw new Error(`SALDO_PENDIENTE:${pendiente}`);
  }

  const extra = nuevoEstado === "entregado" ? { fecha_entrega: db.now() } : {};
  db.setArr(T.ORDENES, ordenes.map(o =>
    o.id === ordenId ? { ...o, estado: nuevoEstado, ...extra } : o
  ));
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "ordenes_reparacion", entidadId: ordenId,
    payload: { antes: { estado: orden.estado }, despues: { estado: nuevoEstado }, campos: ["estado"] } });
}

// ─── ANULACIÓN — sección 10 ANULACIÓN ────────────────────────────────────────
export function anularOrden(ordenId, motivoAnulacion, userId) {
  const ordenes = db.getArr(T.ORDENES);
  const orden   = ordenes.find(o => o.id === ordenId);
  if (!orden) throw new Error("ORDEN_NO_ENCONTRADA");
  if (!motivoAnulacion?.trim()) throw new Error("MOTIVO_REQUERIDO");

  // Liberar reservas no instaladas
  const oreps = db.getArr(T.ORDEN_REPUESTOS).filter(o => o.orden_id === ordenId && !o.instalado);
  const reps  = db.getArr(T.REPUESTOS);
  db.setArr(T.REPUESTOS, reps.map(r => {
    const or = oreps.find(o => o.repuesto_id === r.id);
    if (!or) return r;
    return {
      ...r,
      stock_reservado: Math.max(0, r.stock_reservado - or.cantidad),
      reservado_hasta: null, reservado_por: null,
    };
  }));

  db.setArr(T.ORDENES, ordenes.map(o =>
    o.id === ordenId ? { ...o, estado: "anulado", motivo_anulacion: motivoAnulacion } : o
  ));
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "ordenes_reparacion", entidadId: ordenId,
    payload: { antes: { estado: orden.estado }, despues: { estado: "anulado", motivo_anulacion: motivoAnulacion }, campos: ["estado","motivo_anulacion"] } });
}

// ─── ACTUALIZAR DIAGNÓSTICO / MANO DE OBRA ────────────────────────────────────
export function actualizarOrden(ordenId, campos, userId) {
  const ordenes = db.getArr(T.ORDENES);
  const prev    = ordenes.find(o => o.id === ordenId);
  if (!prev) throw new Error("ORDEN_NO_ENCONTRADA");
  if (campos.imei && (campos.imei.length < 14 || campos.imei.length > 16))
    throw new Error("IMEI_INVALIDO");
  const updated = { ...prev, ...campos };
  db.setArr(T.ORDENES, ordenes.map(o => o.id === ordenId ? updated : o));
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "ordenes_reparacion", entidadId: ordenId,
    payload: { antes: prev, despues: updated, campos: Object.keys(campos) } });
}

// ─── ELIMINAR REPUESTO DE ORDEN (antes de instalar) ──────────────────────────
export function quitarRepuestoDeOrden(ordenId, repuestoId, userId) {
  const oreps = db.getArr(T.ORDEN_REPUESTOS);
  const orep  = oreps.find(o => o.orden_id === ordenId && o.repuesto_id === repuestoId);
  if (!orep) throw new Error("ASIGNACION_NO_ENCONTRADA");
  if (orep.instalado) throw new Error("YA_INSTALADO");

  // Liberar reserva
  const reps = db.getArr(T.REPUESTOS);
  db.setArr(T.REPUESTOS, reps.map(r =>
    r.id === repuestoId
      ? { ...r,
          stock_reservado: Math.max(0, r.stock_reservado - orep.cantidad),
          reservado_hasta: null, reservado_por: null }
      : r
  ));
  db.setArr(T.ORDEN_REPUESTOS, oreps.filter(o => !(o.orden_id === ordenId && o.repuesto_id === repuestoId)));
  insertAuditLog({ usuarioId: userId, accion: "DELETE", entidad: "orden_repuestos", entidadId: orep.id,
    payload: { antes: orep, despues: null, campos: [] } });
}
