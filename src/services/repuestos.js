// ─── REPUESTOS SERVICE — secciones 6.1 a 6.5 + triggers 4.1-4.4 ─────────────
import { db, T, getCfg, generarCodigoRepuesto } from "../db/index.js";
import { insertAuditLog } from "./audit.js";

// ─── TRIGGER: actualizar_stock_cache (sección 4.1) ────────────────────────────
/** Aplica delta al stock del repuesto. Lanza si stock < 0 (sección 4.2). */
function _aplicarDeltaStock(repuestoId, delta) {
  const reps = db.getArr(T.REPUESTOS);
  const rep  = reps.find(r => r.id === repuestoId);
  if (!rep) throw new Error("REPUESTO_NO_ENCONTRADO");
  const nuevoStock = rep.stock + delta;
  if (nuevoStock < 0) throw new Error("stock_negativo: operacion rechazada, stock insuficiente");
  db.setArr(T.REPUESTOS, reps.map(r => r.id === repuestoId ? { ...r, stock: nuevoStock } : r));
}

// ─── TRIGGER: validar_stock_reservado_positivo (sección 4.3) ─────────────────
function _aplicarDeltaReservado(repuestoId, delta) {
  const reps = db.getArr(T.REPUESTOS);
  const rep  = reps.find(r => r.id === repuestoId);
  if (!rep) throw new Error("REPUESTO_NO_ENCONTRADO");
  const nuevo = rep.stock_reservado + delta;
  if (nuevo < 0) throw new Error("stock_reservado_negativo: error de logica en reservas");
  db.setArr(T.REPUESTOS, reps.map(r => r.id === repuestoId ? { ...r, stock_reservado: nuevo } : r));
}

// ─── KARDEX: insertar movimiento (inmutable — solo push, nunca delete/update) ─
/** [VAL-02] Los movimientos de kardex son registros contables inmutables. */
export function insertarKardex({ repuestoId, tipo, cantidad, ordenId = null, usuarioId, motivo }) {
  // prevent_delete_kardex / prevent_update_kardex se implementan omitiendo
  // cualquier delete/update en esta colección — solo se usa esta función para agregar.
  if (cantidad <= 0) throw new Error("kardex_cantidad_invalida: cantidad debe ser > 0");
  const kardex = db.getArr(T.KARDEX);
  kardex.push({
    id: db.nextId(T.KARDEX),
    repuesto_id: repuestoId,
    tipo, cantidad,
    orden_id:   ordenId,
    usuario_id: usuarioId,
    motivo,
    created_at: db.now(),
  });
  db.setArr(T.KARDEX, kardex);

  // Trigger actualizar_stock_cache (sección 4.1)
  const DELTA = { entrada:1, ajuste_entrada:1, salida:-1, ajuste_salida:-1, perdida:-1 };
  _aplicarDeltaStock(repuestoId, DELTA[tipo] * cantidad);
}

// ─── 6.1 SELECCIÓN FIFO ───────────────────────────────────────────────────────
/**
 * Retorna el repuesto del lote más antiguo con stock_disponible >= cantidad.
 * Implementa: SELECT ... ORDER BY l.fecha_compra ASC LIMIT 1 + idx_repuestos_busqueda [VAL-08]
 */
export function seleccionarFIFO(tipo, marca, modelo, cantidad = 1) {
  const lotes   = db.getArr(T.LOTES);
  const reps    = db.getArr(T.REPUESTOS).filter(r =>
    !r.deleted_at &&
    r.tipo   === tipo  &&
    r.marca  === marca &&
    r.modelo === modelo &&
    (r.stock - r.stock_reservado) >= cantidad
  );
  if (!reps.length) return null;

  // JOIN con lotes + ORDER BY fecha_compra ASC (FIFO)
  const enriquecidos = reps.map(r => {
    const lote = lotes.find(l => l.id === r.lote_id) || {};
    return { ...r, fecha_compra: lote.fecha_compra ?? "9999-99-99", costo_unitario: lote.costo_unitario ?? 0 };
  });
  enriquecidos.sort((a, b) => a.fecha_compra.localeCompare(b.fecha_compra));
  return enriquecidos[0];
}

// ─── 6.2 RESERVAR REPUESTO [VAL-03] ──────────────────────────────────────────
/**
 * Transacción atómica: verifica disponibilidad → sube stock_reservado → inserta orden_repuestos.
 * stock_disponible = stock - stock_reservado baja INMEDIATAMENTE.
 */
export function reservarRepuesto(repuestoId, ordenId, cantidad, userId, valorUnitario) {
  const reps = db.getArr(T.REPUESTOS);
  const rep  = reps.find(r => r.id === repuestoId && !r.deleted_at);
  if (!rep) throw new Error("REPUESTO_NO_ENCONTRADO");
  if ((rep.stock - rep.stock_reservado) < cantidad) throw new Error("STOCK_INSUFICIENTE");

  // Verificar que no esté ya asignado a esta orden
  const oreps = db.getArr(T.ORDEN_REPUESTOS);
  if (oreps.find(o => o.orden_id === ordenId && o.repuesto_id === repuestoId))
    throw new Error("REPUESTO_YA_ASIGNADO");

  const horas = getCfg("reserva_duracion_horas", 2);
  const hasta = new Date(Date.now() + horas * 3_600_000).toISOString();

  // Incrementar stock_reservado
  _aplicarDeltaReservado(repuestoId, cantidad);
  // Actualizar reservado_hasta y reservado_por
  db.setArr(T.REPUESTOS, db.getArr(T.REPUESTOS).map(r =>
    r.id === repuestoId ? { ...r, reservado_hasta: hasta, reservado_por: userId } : r
  ));

  // Insertar en orden_repuestos
  db.setArr(T.ORDEN_REPUESTOS, [...oreps, {
    id: db.nextId(T.ORDEN_REPUESTOS),
    orden_id: ordenId, repuesto_id: repuestoId,
    cantidad, valor_unitario: valorUnitario, instalado: 0,
    created_at: db.now(),
  }]);
}

// ─── 6.3 INSTALAR REPUESTO ───────────────────────────────────────────────────
/** Libera reserva → descuenta stock (kardex salida) → marca instalado=1 */
export function instalarRepuesto(repuestoId, ordenId, cantidad, userId) {
  const rep = db.getArr(T.REPUESTOS).find(r => r.id === repuestoId);
  if (!rep) throw new Error("REPUESTO_NO_ENCONTRADO");

  // Liberar reserva
  _aplicarDeltaReservado(repuestoId, -cantidad);
  db.setArr(T.REPUESTOS, db.getArr(T.REPUESTOS).map(r =>
    r.id === repuestoId
      ? { ...r, reservado_hasta: null, reservado_por: null }
      : r
  ));

  // Marcar instalado en orden_repuestos
  db.setArr(T.ORDEN_REPUESTOS, db.getArr(T.ORDEN_REPUESTOS).map(o =>
    (o.orden_id === ordenId && o.repuesto_id === repuestoId) ? { ...o, instalado: 1 } : o
  ));

  // Kardex: tipo='salida' — trigger descuenta stock
  insertarKardex({ repuestoId, tipo: "salida", cantidad, ordenId, usuarioId: userId, motivo: "Instalación en orden" });
}

// ─── 6.5 LIBERAR RESERVAS VENCIDAS ──────────────────────────────────────────
/** Job cada 5 minutos. Calcula cantidad desde orden_repuestos (no instalada). */
export function liberarReservasVencidas() {
  const ahora = new Date();
  const reps  = db.getArr(T.REPUESTOS);
  const oreps = db.getArr(T.ORDEN_REPUESTOS);
  const ords  = db.getArr(T.ORDENES);

  let cambios = false;
  const updated = reps.map(r => {
    if (!r.reservado_hasta || new Date(r.reservado_hasta) > ahora) return r;
    // Calcular cantidad reservada no instalada (órdenes activas)
    const cantReservada = oreps
      .filter(o =>
        o.repuesto_id === r.id &&
        o.instalado === 0 &&
        ords.find(ord => ord.id === o.orden_id && !["entregado","anulado"].includes(ord.estado))
      )
      .reduce((s, o) => s + o.cantidad, 0);
    cambios = true;
    return {
      ...r,
      stock_reservado: Math.max(0, r.stock_reservado - cantReservada),
      reservado_hasta: null,
      reservado_por:   null,
    };
  });
  if (cambios) db.setArr(T.REPUESTOS, updated);
}

// ─── AJUSTE MANUAL DE STOCK (ADM) ────────────────────────────────────────────
export function ajustarStock({ repuestoId, tipo, cantidad, motivo, userId }) {
  if (!motivo?.trim()) throw new Error("MOTIVO_REQUERIDO");
  if (cantidad <= 0)   throw new Error("CANTIDAD_INVALIDA");
  // Validar stock no negativo en salidas
  if (["ajuste_salida","perdida"].includes(tipo)) {
    const rep = db.getArr(T.REPUESTOS).find(r => r.id === repuestoId);
    if (!rep || rep.stock < cantidad) throw new Error("STOCK_INSUFICIENTE");
  }
  insertarKardex({ repuestoId, tipo, cantidad, usuarioId: userId, motivo });
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "repuestos", entidadId: repuestoId,
    payload: { antes: null, despues: { ajuste: tipo, cantidad, motivo }, campos: ["stock"] } });
}

// ─── CRUD REPUESTOS ───────────────────────────────────────────────────────────
export function crearRepuesto({ tipo, marca, modelo, calidad, ubicacion, loteId, costoUnitario, stockInicial }, userId) {
  const codigo = generarCodigoRepuesto();
  const cfg = db.getArr(T.REPUESTOS); // para verificar unicidad
  if (cfg.find(r => r.codigo_interno === codigo)) throw new Error("CODIGO_DUPLICADO");

  const nuevo = {
    id: db.nextId(T.REPUESTOS),
    codigo_interno: codigo, tipo, marca, modelo,
    lote_id: loteId ?? 1,
    stock: 0, stock_reservado: 0,
    reservado_hasta: null, reservado_por: null,
    ubicacion: ubicacion ?? null, calidad: calidad ?? "compatible",
    imagen: null, deleted_at: null, created_at: db.now(),
  };
  db.setArr(T.REPUESTOS, [...db.getArr(T.REPUESTOS), nuevo]);

  // Stock inicial → kardex entrada
  if (stockInicial > 0) {
    insertarKardex({ repuestoId: nuevo.id, tipo: "entrada", cantidad: stockInicial,
      usuarioId: userId, motivo: "Stock inicial" });
  }
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "repuestos", entidadId: nuevo.id,
    payload: { antes: null, despues: nuevo, campos: Object.keys(nuevo) } });
  return nuevo;
}

export function editarRepuesto(id, campos, userId) {
  const reps = db.getArr(T.REPUESTOS);
  const prev = reps.find(r => r.id === id);
  if (!prev) throw new Error("REPUESTO_NO_ENCONTRADO");
  const updated = { ...prev, ...campos };
  db.setArr(T.REPUESTOS, reps.map(r => r.id === id ? updated : r));
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "repuestos", entidadId: id,
    payload: { antes: prev, despues: updated, campos: Object.keys(campos) } });
}

export function eliminarRepuesto(id, userId) {
  const reps = db.getArr(T.REPUESTOS);
  const rep  = reps.find(r => r.id === id);
  if (!rep) throw new Error("REPUESTO_NO_ENCONTRADO");
  // Soft delete
  db.setArr(T.REPUESTOS, reps.map(r => r.id === id ? { ...r, deleted_at: db.now() } : r));
  insertAuditLog({ usuarioId: userId, accion: "DELETE", entidad: "repuestos", entidadId: id,
    payload: { antes: rep, despues: null, campos: [] } });
}

// ─── CRUD LOTES Y PROVEEDORES ────────────────────────────────────────────────
export function crearLote({ referencia, proveedorId, fechaCompra, factura, cantidad, costoUnitario }, userId) {
  const lote = {
    id: db.nextId(T.LOTES), referencia, proveedor_id: proveedorId,
    fecha_compra: fechaCompra, factura: factura ?? null,
    cantidad, costo_unitario: costoUnitario, created_at: db.now(),
  };
  db.setArr(T.LOTES, [...db.getArr(T.LOTES), lote]);
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "lotes", entidadId: lote.id,
    payload: { antes: null, despues: lote, campos: Object.keys(lote) } });
  return lote;
}

export function crearProveedor({ nombre, telefono, email, confiabilidad }, userId) {
  const provs = db.getArr(T.PROVEEDORES);
  const prov  = { id: db.nextId(T.PROVEEDORES), nombre, telefono: telefono ?? "", email: email ?? "", confiabilidad: confiabilidad ?? 0, created_at: db.now() };
  db.setArr(T.PROVEEDORES, [...provs, prov]);
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "proveedores", entidadId: prov.id,
    payload: { antes: null, despues: prov, campos: Object.keys(prov) } });
  return prov;
}

export function editarProveedor(id, campos, userId) {
  const provs = db.getArr(T.PROVEEDORES);
  const prev  = provs.find(p => p.id === id);
  if (!prev) throw new Error("PROVEEDOR_NO_ENCONTRADO");
  db.setArr(T.PROVEEDORES, provs.map(p => p.id === id ? { ...p, ...campos } : p));
  insertAuditLog({ usuarioId: userId, accion: "UPDATE", entidad: "proveedores", entidadId: id,
    payload: { antes: prev, despues: { ...prev, ...campos }, campos: Object.keys(campos) } });
}
