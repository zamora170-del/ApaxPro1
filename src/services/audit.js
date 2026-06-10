// ─── AUDIT SERVICE — sección 7.3 ────────────────────────────────────────────
// insertAuditLog() con JSON tipado y validado antes de INSERT [VAL-07]
import { db, T } from "../db/index.js";

/**
 * @param {{ usuarioId:number|null, accion:string, entidad:string, entidadId:number|null, payload:{antes:any,despues:any,campos?:string[]} }} p
 */
export function insertAuditLog({ usuarioId, accion, entidad, entidadId, payload }) {
  let cambios;
  try {
    cambios = JSON.stringify({
      antes:  payload.antes  ?? null,
      despues:payload.despues ?? null,
      campos: payload.campos ?? [],
    });
  } catch {
    cambios = JSON.stringify({ error: "payload_no_serializable" });
  }
  const logs = db.getArr(T.AUDIT);
  logs.push({
    id:         db.nextId(T.AUDIT),
    usuario_id: usuarioId,
    accion,
    entidad,
    entidad_id: entidadId,
    cambios,
    fecha:      db.now(),
  });
  db.setArr(T.AUDIT, logs);
}
