'use strict';
// backend/categorias.js — CRUD de categorías de habitación (ej: Individual, Doble, Triple) por número de camas

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function createCategoria(hotelId, nombre, camas) {
  const id = genId();
  db.prepare(`
    INSERT INTO categorias (id, hotel_id, nombre, camas, created_at)
    VALUES (?,?,?,?,?)
  `).run(id, hotelId, nombre, camas, now());
  return getById(id);
}

function getById(id) {
  return db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) || null;
}

function getByHotel(hotelId) {
  return db.prepare('SELECT * FROM categorias WHERE hotel_id = ? ORDER BY camas, nombre').all(hotelId);
}

function updateCategoria(id, fields) {
  const ALLOWED = ['nombre', 'camas'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return getById(id);
  vals.push(id);
  db.prepare(`UPDATE categorias SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

function deleteCategoria(id) {
  // Las tarifas que apuntaban a esta categoría quedan con categoria_id huérfano —
  // se desactivan para que no sigan aplicando un precio a una categoría que ya no existe.
  db.prepare("UPDATE tarifas SET activa = 0 WHERE categoria_id = ?").run(id);
  return db.prepare('DELETE FROM categorias WHERE id = ?').run(id).changes > 0;
}

module.exports = { createCategoria, getById, getByHotel, updateCategoria, deleteCategoria };
