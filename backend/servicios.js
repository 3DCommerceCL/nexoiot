'use strict';
// backend/servicios.js — Directorio de servicios del hotel (informativo + upsell)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function createServicio(hotelId, nombre, descripcion, precioCLP, tipo) {
  const id = genId();
  db.prepare(`
    INSERT INTO servicios_hotel (id, hotel_id, nombre, descripcion, precio_clp, tipo, activo, created_at)
    VALUES (?,?,?,?,?,?,1,?)
  `).run(id, hotelId, nombre, descripcion || null, precioCLP || null, tipo || 'servicio', now());
  return getById(id);
}

function getById(id) {
  return db.prepare('SELECT * FROM servicios_hotel WHERE id = ?').get(id) || null;
}

function getByHotel(hotelId, soloActivos = false) {
  const sql = soloActivos
    ? 'SELECT * FROM servicios_hotel WHERE hotel_id = ? AND activo = 1 ORDER BY tipo, nombre'
    : 'SELECT * FROM servicios_hotel WHERE hotel_id = ? ORDER BY tipo, nombre';
  return db.prepare(sql).all(hotelId);
}

function updateServicio(id, fields) {
  const ALLOWED = ['nombre', 'descripcion', 'precio_clp', 'tipo', 'activo'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return getById(id);
  vals.push(id);
  db.prepare(`UPDATE servicios_hotel SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

function deleteServicio(id) {
  return db.prepare('DELETE FROM servicios_hotel WHERE id = ?').run(id).changes > 0;
}

module.exports = { createServicio, getById, getByHotel, updateServicio, deleteServicio };
