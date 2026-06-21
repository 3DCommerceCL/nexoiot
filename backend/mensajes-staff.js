'use strict';
// backend/mensajes-staff.js — Aviso de recepción/owner hacia un rol personalizado
// completo (ej. "Aseo"), opcionalmente sobre una habitación puntual. No hay
// asignación de "quién atiende qué habitación" — el aviso llega a cualquiera que
// esté logueado con ese rol, vía polling (mismo patrón que alarmas-puerta.js).

const crypto = require('crypto');
const db     = require('./db');

const genId = () => crypto.randomBytes(8).toString('hex');

function crear(hotelId, { roomId, deUsuarioId, deNombre, paraRol, texto }) {
  if (!texto || !texto.trim()) throw new Error('texto requerido');
  if (!paraRol) throw new Error('paraRol requerido');
  const id = genId();
  db.prepare(`
    INSERT INTO mensajes_staff (id, hotel_id, room_id, de_usuario_id, de_nombre, para_rol, texto, leido, created_at)
    VALUES (?,?,?,?,?,?,?,0,?)
  `).run(id, hotelId, roomId || null, deUsuarioId, deNombre, paraRol, texto.trim(), new Date().toISOString());
  return db.prepare('SELECT * FROM mensajes_staff WHERE id = ?').get(id);
}

function listarNoLeidosParaRol(hotelId, rol) {
  return db.prepare(`
    SELECT * FROM mensajes_staff WHERE hotel_id = ? AND para_rol = ? AND leido = 0 ORDER BY created_at ASC
  `).all(hotelId, rol);
}

function getById(id) {
  return db.prepare('SELECT * FROM mensajes_staff WHERE id = ?').get(id);
}

function marcarLeido(id) {
  db.prepare('UPDATE mensajes_staff SET leido = 1 WHERE id = ?').run(id);
}

module.exports = { crear, listarNoLeidosParaRol, getById, marcarLeido };
