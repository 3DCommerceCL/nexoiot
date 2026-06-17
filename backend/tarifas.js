'use strict';
// backend/tarifas.js — CRUD de tarifas por habitación y temporada (precio en UF)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

// roomId y categoriaId son mutuamente excluyentes: si ambos son null, la tarifa es general del hotel.
function createTarifa(hotelId, roomId, categoriaId, nombre, precioUF, desde, hasta, minNoches = 1) {
  const id = genId();
  db.prepare(`
    INSERT INTO tarifas (id, hotel_id, room_id, categoria_id, nombre, precio_uf, desde, hasta, min_noches, activa, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,?)
  `).run(id, hotelId, roomId || null, categoriaId || null, nombre, precioUF, desde, hasta, minNoches, now());
  return getById(id);
}

function getById(id) {
  return db.prepare('SELECT * FROM tarifas WHERE id = ?').get(id) || null;
}

function getByHotel(hotelId) {
  return db.prepare(
    'SELECT * FROM tarifas WHERE hotel_id = ? ORDER BY desde DESC, room_id'
  ).all(hotelId);
}

// Retorna un Map de tarifas vigentes en el rango, con 3 niveles de llave:
//   room_id        → tarifa específica de esa habitación (máxima prioridad)
//   'cat:'+categoria_id → tarifa de la categoría (Doble, Triple, etc.)
//   '__gen__'      → tarifa general del hotel (room_id y categoria_id NULL)
// Resolución para una habitación: map.get(room.id) || map.get('cat:'+room.categoriaId) || map.get('__gen__')
function getTarifasVigentes(hotelId, checkin, checkout) {
  const rows = db.prepare(`
    SELECT * FROM tarifas
    WHERE hotel_id = ?
      AND activa = 1
      AND desde <= ?
      AND hasta >= ?
    ORDER BY room_id DESC, categoria_id DESC, desde DESC
  `).all(hotelId, checkin, checkout);

  const map = new Map();
  for (const t of rows) {
    const key = t.room_id ? t.room_id : (t.categoria_id ? `cat:${t.categoria_id}` : '__gen__');
    if (!map.has(key)) map.set(key, t); // primera = más reciente / más específica
  }
  return map;
}

function updateTarifa(id, fields) {
  const ALLOWED = ['nombre', 'precio_uf', 'desde', 'hasta', 'min_noches', 'activa'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return getById(id);
  vals.push(id);
  db.prepare(`UPDATE tarifas SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

function deleteTarifa(id) {
  return db.prepare('DELETE FROM tarifas WHERE id = ?').run(id).changes > 0;
}

module.exports = { createTarifa, getById, getByHotel, getTarifasVigentes, updateTarifa, deleteTarifa };
