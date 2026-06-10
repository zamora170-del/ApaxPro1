// ─── CAJA SERVICE — sección 6.4, 2.13, 2.16 [VAL-04] ─────────────────────────
import { db, T, calcularSaldoCaja } from "../db/index.js";
import { insertAuditLog } from "./audit.js";

// ─── APERTURA DE CAJA ─────────────────────────────────────────────────────────
export function abrirCaja(saldoInicial, userId) {
  const cajaActual = db.get(T.CAJA);
  if (cajaActual?.abierta) throw new Error("CAJA_YA_ABIERTA");
  const caja = {
    fecha: db.today(), saldo_inicial: saldoInicial, saldo_final: null,
    abierta: true, usuario_id: userId, cerrado_por: null, created_at: db.now(),
  };
  db.set(T.CAJA, caja);
  db.setArr(T.MOV_CAJA, []);  // nueva jornada → movimientos limpios
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "caja", entidadId: null,
    payload: { antes: null, despues: { saldo_inicial: saldoInicial }, campos: ["saldo_inicial"] } });
}

// ─── CIERRE DE CAJA ───────────────────────────────────────────────────────────
export function cerrarCaja(userId) {
  const caja = db.get(T.CAJA);
  if (!caja?.abierta) throw new Error("CAJA_NO_ABIERTA");
  const saldo_final = calcularSaldoCaja();
  db.set(T.CAJA, { ...caja, abierta: false, saldo_final, cerrado_por: userId });
  insertAuditLog({ usuarioId: userId, accion: "CONFIG_CHANGE", entidad: "caja", entidadId: null,
    payload: { antes: { abierta: true }, despues: { abierta: false, saldo_final }, campos: ["abierta","saldo_final"] } });
  return saldo_final;
}

// ─── 6.4 REGISTRAR PAGO (transacción atómica) ────────────────────────────────
/**
 * INSERT pagos + INSERT movimientos_caja en la misma "transacción" JS.
 * Lanza CAJA_NO_ABIERTA si no hay caja del día. [VAL-04]
 */
export function registrarPago(ordenId, monto, metodo, notas, userId) {
  const caja = db.get(T.CAJA);
  if (!caja?.abierta) throw new Error("CAJA_NO_ABIERTA");

  // 1. Insertar pago
  const pagos = db.getArr(T.PAGOS);
  const pagoId = db.nextId(T.PAGOS);
  pagos.push({ id: pagoId, orden_id: ordenId, monto, metodo, notas: notas ?? null, fecha: db.now() });
  db.setArr(T.PAGOS, pagos);

  // 2. Insertar movimiento_caja (fuente de verdad)
  const movs = db.getArr(T.MOV_CAJA);
  movs.push({
    id: db.nextId(T.MOV_CAJA),
    tipo: "ingreso", monto,
    concepto: `Pago orden ${ordenId}`,
    referencia: `pago:${pagoId}`,
    usuario_id: userId, metodo,
    created_at: db.now(),
  });
  db.setArr(T.MOV_CAJA, movs);

  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "pagos", entidadId: pagoId,
    payload: { antes: null, despues: { orden_id: ordenId, monto, metodo }, campos: ["monto","metodo"] } });
  return pagoId;
}

// ─── REGISTRAR EGRESO ─────────────────────────────────────────────────────────
export function registrarEgreso(concepto, monto, metodo, userId) {
  const caja = db.get(T.CAJA);
  if (!caja?.abierta) throw new Error("CAJA_NO_ABIERTA");
  if (!concepto?.trim()) throw new Error("CONCEPTO_REQUERIDO");
  const movs = db.getArr(T.MOV_CAJA);
  const id = db.nextId(T.MOV_CAJA);
  movs.push({ id, tipo: "egreso", monto, concepto, referencia: null, usuario_id: userId, metodo, created_at: db.now() });
  db.setArr(T.MOV_CAJA, movs);
  insertAuditLog({ usuarioId: userId, accion: "CREATE", entidad: "movimientos_caja", entidadId: id,
    payload: { antes: null, despues: { tipo:"egreso", monto, concepto }, campos: ["tipo","monto","concepto"] } });
}
