'use strict';
// backend/reglas-rendimiento.js — Reglas simples de cierre automático por disponibilidad
// (ej: "si quedan <= 2 habitaciones libres de la categoría Doble, cerrar venta online").

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function createRegla(hotelId, nombre, ambito, ambitoId, umbral) {
  const id = genId();
  db.prepare(`
    INSERT INTO reglas_rendimiento (id, hotel_id, nombre, ambito, ambito_id, umbral, activa, created_at)
    VALUES (?,?,?,?,?,?,1,?)
  `).run(id, hotelId, nombre, ambito, ambitoId || null, umbral, now());
  return getById(id);
}

function getById(id) {
  return db.prepare('SELECT * FROM reglas_rendimiento WHERE id = ?').get(id) || null;
}

function getByHotel(hotelId) {
  return db.prepare('SELECT * FROM reglas_rendimiento WHERE hotel_id = ? ORDER BY created_at DESC').all(hotelId);
}

function updateRegla(id, fields) {
  const ALLOWED = ['nombre', 'umbral', 'activa'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return getById(id);
  vals.push(id);
  db.prepare(`UPDATE reglas_rendimiento SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

function deleteRegla(id) {
  return db.prepare('DELETE FROM reglas_rendimiento WHERE id = ?').run(id).changes > 0;
}

// Evalúa si `room` ({ categoriaId }) queda cerrada por alguna regla activa en alguna noche
// dentro de [checkin, checkout). hotelRooms = [{id, categoriaId}] y reservasActivas ya
// vienen filtrados por hotel/rango desde el caller, para no recalcularlos por habitación.
// Retorna el nombre de la regla que la cerró, o false si no aplica ninguna.
function estaCerradaPorReglas(hotelId, room, checkin, checkout, hotelRooms, reservasActivas) {
  const reglasActivas = getByHotel(hotelId).filter(r => r.activa);
  if (!reglasActivas.length) return false;

  const aplicables = reglasActivas.filter(r => r.ambito === 'general' || r.ambito_id === room.categoriaId);
  if (!aplicables.length) return false;

  let d = new Date(checkin + 'T00:00:00Z');
  const end = new Date(checkout + 'T00:00:00Z');
  while (d < end) {
    const noche = d.toISOString().slice(0, 10);
    for (const regla of aplicables) {
      const scopeRooms = regla.ambito === 'general' ? hotelRooms : hotelRooms.filter(r => r.categoriaId === regla.ambito_id);
      const ocupadas = reservasActivas.filter(r =>
        scopeRooms.some(sr => sr.id === r.room_id) && r.checkin <= noche && r.checkout > noche
      ).length;
      const libres = scopeRooms.length - ocupadas;
      if (libres <= regla.umbral) return regla.nombre;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return false;
}

module.exports = { createRegla, getById, getByHotel, updateRegla, deleteRegla, estaCerradaPorReglas };
