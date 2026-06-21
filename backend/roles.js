'use strict';
// backend/roles.js — Roles personalizados por hotel (ej: "Aseo", "Mayordomo"), cada
// uno con un subconjunto de permisos de un catálogo cerrado. Los 3 roles fijos
// (superadmin/owner/recepcion) NO pasan por aquí — siguen viviendo en los
// requireAuth(...) de server.js exactamente como antes, sin cambios. Este sistema
// es aditivo: solo abre permisos puntuales a roles nuevos, nunca reemplaza nada.

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => 'role_' + crypto.randomBytes(8).toString('hex');

// Catálogo cerrado — el dueño elige permisos de esta lista, no escribe texto libre.
// Se amplía sin migración (es código + ids guardados como JSON en la fila del rol).
const PERMISOS_CATALOGO = [
  { id: 'housekeeping.gestionar', label: 'Gestionar aseo', desc: 'Ver y cambiar el estado de limpieza de las habitaciones' },
];

function row(r) {
  return { ...r, permisos: JSON.parse(r.permisos) };
}

function listByHotel(hotelId) {
  return db.prepare('SELECT * FROM roles WHERE hotel_id = ? ORDER BY created_at DESC').all(hotelId).map(row);
}

function getById(id) {
  const r = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  return r ? row(r) : null;
}

function validarPermisos(permisos) {
  if (!Array.isArray(permisos)) throw new Error('permisos debe ser un array');
  const validos = new Set(PERMISOS_CATALOGO.map(p => p.id));
  for (const p of permisos) {
    if (!validos.has(p)) throw new Error(`Permiso desconocido: ${p}`);
  }
}

function create(hotelId, nombre, permisos = []) {
  if (!nombre || !nombre.trim()) throw new Error('nombre requerido');
  validarPermisos(permisos);
  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO roles (id, hotel_id, nombre, permisos, created_at, updated_at)
    VALUES (?,?,?,?,?,?)
  `).run(id, hotelId, nombre.trim(), JSON.stringify(permisos), ts, ts);
  return getById(id);
}

function update(id, fields) {
  if (fields.permisos) validarPermisos(fields.permisos);
  const sets = [], vals = [];
  if (fields.nombre !== undefined)   { sets.push('nombre = ?');   vals.push(fields.nombre.trim()); }
  if (fields.permisos !== undefined) { sets.push('permisos = ?'); vals.push(JSON.stringify(fields.permisos)); }
  if (!sets.length) return getById(id);
  sets.push('updated_at = ?');
  vals.push(now(), id);
  db.prepare(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

function remove(id) {
  const enUso = db.prepare('SELECT COUNT(*) AS c FROM usuarios WHERE rol = ? AND activo = 1').get(id).c;
  if (enUso > 0) throw new Error('No se puede eliminar: hay usuarios activos con este rol. Reasígnalos primero.');
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  return true;
}

// true si el usuario (por su campo .rol, ya sea literal fijo o id de rol personalizado)
// tiene el permiso dado. Los 3 roles fijos NO pasan por aquí en los requireAuth ya
// existentes — esta función solo se usa en los puntos nuevos que adoptan permisos.
function tienePermiso(rolUsuario, permiso) {
  if (rolUsuario === 'superadmin' || rolUsuario === 'owner') return true;
  if (rolUsuario === 'recepcion') return false;
  const rol = getById(rolUsuario);
  return !!rol && rol.permisos.includes(permiso);
}

module.exports = { PERMISOS_CATALOGO, listByHotel, getById, create, update, remove, tienePermiso };
