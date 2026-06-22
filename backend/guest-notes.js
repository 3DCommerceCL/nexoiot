'use strict';
// backend/guest-notes.js — Notas de recepción/dueño sobre un huésped (preferencias, quejas,
// pedidos especiales), asociadas al mismo guestKey que ya usa el CRM (huespedes.js).

const crypto = require('crypto');
const db     = require('./db');

const genId = () => crypto.randomBytes(8).toString('hex');

function crear(hotelId, guestKey, nota, creadoPor) {
  const id = genId();
  db.prepare(`
    INSERT INTO guest_notes (id, hotel_id, guest_key, nota, creado_por, created_at)
    VALUES (?,?,?,?,?,?)
  `).run(id, hotelId, guestKey, nota, creadoPor || null, new Date().toISOString());
  return db.prepare('SELECT * FROM guest_notes WHERE id = ?').get(id);
}

function listar(hotelId, guestKey) {
  return db.prepare(`
    SELECT * FROM guest_notes WHERE hotel_id = ? AND guest_key = ? ORDER BY created_at DESC
  `).all(hotelId, guestKey);
}

module.exports = { crear, listar };
