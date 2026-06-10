// ─── AUTH SERVICE — sección 1.4 y flujo PRIMER INICIO / LOGIN ────────────────
import { db, T, getCfg } from "../db/index.js";
import { insertAuditLog } from "./audit.js";

/** SHA-256 via Web Crypto API (reemplaza bcrypt en PWA) */
export async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd + "tp5salt"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Verifica credenciales e inicia sesión.
 *  Implementa: bloqueo por intentos, normalización email, audit log.
 *  Sección 10 — Paso 1 flujo normal. */
export async function loginUser(email, password) {
  const maxInt = getCfg("intentos_maximos_login", 5);
  const blqMin = getCfg("tiempo_bloqueo_minutos", 15);
  const emailN = (email ?? "").toLowerCase().trim();
  const usuarios = db.getArr(T.USUARIOS);
  const user = usuarios.find(u => u.email?.toLowerCase().trim() === emailN);

  if (!user || !user.activo || user.deleted_at) {
    throw new Error("CREDENCIALES_INVALIDAS");
  }

  // Verificar bloqueo
  if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
    const mins = Math.ceil((new Date(user.bloqueado_hasta) - Date.now()) / 60000);
    throw new Error(`BLOQUEADO:${mins}`);
  }

  const hash = await hashPassword(password);
  if (hash !== user.password_hash) {
    const intentos = (user.intentos_login ?? 0) + 1;
    const bloqueado = intentos >= maxInt
      ? new Date(Date.now() + blqMin * 60_000).toISOString()
      : user.bloqueado_hasta;
    db.setArr(T.USUARIOS, usuarios.map(u =>
      u.id === user.id ? { ...u, intentos_login: intentos, bloqueado_hasta: bloqueado } : u
    ));
    insertAuditLog({ usuarioId: user.id, accion: "LOGIN_FALLIDO", entidad: "usuarios", entidadId: user.id,
      payload: { antes: null, despues: null, campos: ["email"] } });
    throw new Error("CREDENCIALES_INVALIDAS");
  }

  // Éxito — reset intentos
  db.setArr(T.USUARIOS, usuarios.map(u =>
    u.id === user.id ? { ...u, intentos_login: 0, bloqueado_hasta: null } : u
  ));
  insertAuditLog({ usuarioId: user.id, accion: "LOGIN", entidad: "usuarios", entidadId: user.id,
    payload: { antes: null, despues: { nombre: user.nombre, rol: user.rol }, campos: [] } });

  const sesion = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, ts: Date.now() };
  db.set(T.SESSION, sesion);
  return sesion;
}

export function getSession() { return db.get(T.SESSION); }

export function logout(userId) {
  insertAuditLog({ usuarioId: userId, accion: "LOGOUT", entidad: "usuarios", entidadId: userId,
    payload: { antes: null, despues: null, campos: [] } });
  db.set(T.SESSION, null);
}

/** Crea el usuario ADM inicial desde el Wizard */
export async function crearAdminInicial(nombre, email, password) {
  const hash = await hashPassword(password);
  const usuario = {
    id: 1, email: email.toLowerCase().trim(), password_hash: hash,
    rol: "ADM", nombre, activo: 1, intentos_login: 0,
    bloqueado_hasta: null, deleted_at: null, created_at: db.now(),
  };
  db.setArr(T.USUARIOS, [usuario]);
  return usuario;
}

/** Crea un usuario normal (solo ADM) */
export async function crearUsuario({ nombre, email, rol, password }, adminId) {
  const usuarios = db.getArr(T.USUARIOS);
  const emailN = email.toLowerCase().trim();
  if (usuarios.find(u => u.email === emailN && !u.deleted_at)) throw new Error("EMAIL_DUPLICADO");
  const hash = await hashPassword(password);
  const nuevo = {
    id: db.nextId(T.USUARIOS), email: emailN, password_hash: hash,
    rol, nombre, activo: 1, intentos_login: 0,
    bloqueado_hasta: null, deleted_at: null, created_at: db.now(),
  };
  db.setArr(T.USUARIOS, [...usuarios, nuevo]);
  insertAuditLog({ usuarioId: adminId, accion: "CREATE", entidad: "usuarios", entidadId: nuevo.id,
    payload: { antes: null, despues: { nombre, email: emailN, rol }, campos: ["nombre","email","rol"] } });
  return nuevo;
}

/** Cambia contraseña */
export async function cambiarPassword(userId, nuevaPassword, adminId) {
  const hash = await hashPassword(nuevaPassword);
  const usuarios = db.getArr(T.USUARIOS);
  db.setArr(T.USUARIOS, usuarios.map(u => u.id === userId ? { ...u, password_hash: hash } : u));
  insertAuditLog({ usuarioId: adminId ?? userId, accion: "UPDATE", entidad: "usuarios", entidadId: userId,
    payload: { antes: null, despues: { password_changed: true }, campos: ["password_hash"] } });
}

/** Toggle activo/inactivo — no desactivar último ADM */
export function toggleUsuario(userId, adminId) {
  const usuarios = db.getArr(T.USUARIOS);
  const target = usuarios.find(u => u.id === userId);
  if (!target) throw new Error("USUARIO_NO_ENCONTRADO");
  if (target.rol === "ADM" && target.activo) {
    const admsActivos = usuarios.filter(u => u.rol === "ADM" && u.activo && !u.deleted_at);
    if (admsActivos.length <= 1) throw new Error("ULTIMO_ADM");
  }
  const updated = { ...target, activo: target.activo ? 0 : 1 };
  db.setArr(T.USUARIOS, usuarios.map(u => u.id === userId ? updated : u));
  insertAuditLog({ usuarioId: adminId, accion: "UPDATE", entidad: "usuarios", entidadId: userId,
    payload: { antes: { activo: target.activo }, despues: { activo: updated.activo }, campos: ["activo"] } });
}
