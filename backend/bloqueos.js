'use strict';
// backend/bloqueos.js — CRUD de bloqueos manuales de habitaciones (mantenimiento, limpieza, etc.)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function createBloqueo(hotelId, roomId, desde, hasta, motivo, notas) {
  const id = genId();
  db.prepare(`
    INSERT INTO room_blocks (id, room_id, hotel_id, desde, hasta, motivo, notas, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(id, roomId, hotelId, desde, hasta, motivo || null, notas || null, now());
  return db.prepare('SELECT * FROM room_blocks WHERE id = ?').get(id);
}

function getBloqueosByRoom(roomId) {
  const hoy = new Date().toISOString().slice(0, 10);
  return db.prepare(
    'SELECT * FROM room_blocks WHERE room_id = ? AND hasta >= ? ORDER BY desde'
  ).all(roomId, hoy);
}

function getBloqueosByHotelEnRango(hotelId, checkin, checkout) {
  return db.prepare(`
    SELECT * FROM room_blocks
    WHERE hotel_id = ? AND desde < ? AND hasta > ?
  `).all(hotelId, checkout, checkin);
}

function deleteBloqueo(id) {
  const r = db.prepare('DELETE FROM room_blocks WHERE id = ?').run(id);
  return r.changes > 0;
}

module.exports = { createBloqueo, getBloqueosByRoom, getBloqueosByHotelEnRango, deleteBloqueo };
