'use strict';
// backend/tarifas-dia.js — Overrides de precio por día individual (grid tipo planilla).
// Capa por encima de las tarifas por rango: si existe un override para una fecha puntual,
// gana sobre la tarifa de rango/categoría/general de tarifas.js.

const db = require('./db');

const now = () => new Date().toISOString();

function setPrecio(hotelId, ambito, ambitoId, fecha, precioUF) {
  db.prepare(`
    INSERT INTO tarifas_dia (hotel_id, ambito, ambito_id, fecha, precio_uf, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(hotel_id, ambito, ambito_id, fecha) DO UPDATE SET precio_uf = excluded.precio_uf, updated_at = excluded.updated_at
  `).run(hotelId, ambito, ambitoId, fecha, precioUF, now());
  return db.prepare(
    'SELECT * FROM tarifas_dia WHERE hotel_id = ? AND ambito = ? AND ambito_id = ? AND fecha = ?'
  ).get(hotelId, ambito, ambitoId, fecha);
}

function borrarPrecio(hotelId, ambito, ambitoId, fecha) {
  return db.prepare(
    'DELETE FROM tarifas_dia WHERE hotel_id = ? AND ambito = ? AND ambito_id = ? AND fecha = ?'
  ).run(hotelId, ambito, ambitoId, fecha).changes > 0;
}

// Overrides en un rango de fechas, para uno o varios objetivos (habitaciones o categorías).
function getEnRango(hotelId, ambito, ambitoIds, desde, hasta) {
  if (!ambitoIds.length) return [];
  const placeholders = ambitoIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT * FROM tarifas_dia
    WHERE hotel_id = ? AND ambito = ? AND ambito_id IN (${placeholders}) AND fecha >= ? AND fecha < ?
  `).all(hotelId, ambito, ...ambitoIds, desde, hasta);
}

// Resuelve el override para una habitación/categoría puntual, room primero y luego categoría.
function resolverOverride(roomId, categoriaId, fecha, overridesRoom, overridesCategoria) {
  const porRoom = overridesRoom.find(o => o.ambito_id === roomId && o.fecha === fecha);
  if (porRoom) return porRoom;
  if (!categoriaId) return null;
  return overridesCategoria.find(o => o.ambito_id === categoriaId && o.fecha === fecha) || null;
}

module.exports = { setPrecio, borrarPrecio, getEnRango, resolverOverride };
