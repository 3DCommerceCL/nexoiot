'use strict';
// backend/housekeeping.js — Estado de limpieza por habitación

const db = require('./db');

const now = () => new Date().toISOString();
const ESTADOS = ['limpia', 'sucia', 'en_proceso', 'inspeccion'];

function getByHotel(hotelId) {
  return db.prepare('SELECT * FROM housekeeping WHERE hotel_id = ?').all(hotelId);
}

function getByRoom(roomId) {
  return db.prepare('SELECT * FROM housekeeping WHERE room_id = ?').get(roomId) || null;
}

function setEstado(roomId, hotelId, estado, notas) {
  if (!ESTADOS.includes(estado)) throw new Error('Estado inválido');
  db.prepare(`
    INSERT INTO housekeeping (room_id, hotel_id, estado, notas, updated_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(room_id) DO UPDATE SET estado = excluded.estado, notas = excluded.notas, updated_at = excluded.updated_at
  `).run(roomId, hotelId, estado, notas || null, now());
  return getByRoom(roomId);
}

module.exports = { ESTADOS, getByHotel, getByRoom, setEstado };
