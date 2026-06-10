// ─── CONFIG SERVICE — sección 9 ──────────────────────────────────────────────
import { db, T } from "../db/index.js";
import { insertAuditLog } from "./audit.js";

export function guardarConfig(nuevosCampos, userId) {
  const actual = db.get(T.CONFIG) || {};
  const updated = { ...actual };
  for (const [clave, valor] of Object.entries(nuevosCampos)) {
    if (updated[clave]) updated[clave] = { ...updated[clave], valor: String(valor), modificado_en: db.now() };
    else updated[clave] = { valor: String(valor), tipo_valor: "texto", modificado_en: db.now() };
  }
  db.set(T.CONFIG, updated);
  insertAuditLog({ usuarioId: userId, accion: "CONFIG_CHANGE", entidad: "configuracion", entidadId: null,
    payload: { antes: actual, despues: updated, campos: Object.keys(nuevosCampos) } });
}

export function guardarConfigTaller(campos, userId) {
  const actual = db.get(T.CONFIG_TALLER) || {};
  const updated = { ...actual, ...campos };
  db.set(T.CONFIG_TALLER, updated);
  insertAuditLog({ usuarioId: userId, accion: "CONFIG_CHANGE", entidad: "configuracion_taller", entidadId: null,
    payload: { antes: actual, despues: updated, campos: Object.keys(campos) } });
}

export function guardarConfigUI(campos, userId) {
  const actual = db.get(T.CONFIG_UI) || {};
  const updated = { ...actual, ...campos };
  db.set(T.CONFIG_UI, updated);
  insertAuditLog({ usuarioId: userId, accion: "CONFIG_CHANGE", entidad: "configuracion_ui", entidadId: null,
    payload: { antes: actual, despues: updated, campos: Object.keys(campos) } });
}

// ─── BACKUP/RESTORE [VAL-05 equivalente] ──────────────────────────────────────
export function exportarBackup() {
  const data = {};
  Object.entries(T).forEach(([k, v]) => { data[k] = db.get(v); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `tallerpro-backup-${db.today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importarBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  // Verificar integridad: debe tener claves básicas [VAL-05 adaptado]
  if (!data.CONFIG && !data.USUARIOS) throw new Error("BACKUP_INVALIDO");
  Object.entries(data).forEach(([k, v]) => { if (T[k]) db.set(T[k], v); });
}

export function exportarCSV(tabla) {
  const data = db.getArr(tabla);
  if (!data.length) return;
  const cols = Object.keys(data[0]);
  const rows = data.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([cols.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `${tabla}-${db.today()}.csv`;
  a.click();
}
