'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// reservas.js — CRUD de reservas sobre SQLite
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

// ── DISPONIBILIDAD ────────────────────────────────────────────────────────────
// Retorna true si room_id no tiene reservas activas que se solapen con [checkin, checkout).
// Solapamiento: reserva.checkin < checkout_pedido AND reserva.checkout > checkin_pedido
function checkDisponibilidad(roomId, checkin, checkout, excludeId = null) {
  const base = `
    SELECT id FROM reservas
    WHERE room_id = ?
      AND status NOT IN ('cancelled','checked_out')
      AND checkin  < ?
      AND checkout > ?
  `;
  const row = excludeId
    ? db.prepare(base + ' AND id != ? LIMIT 1').get(roomId, checkout, checkin, excludeId)
    : db.prepare(base + ' LIMIT 1').get(roomId, checkout, checkin);
  return !row;
}

// ── CREATE ────────────────────────────────────────────────────────────────────
function createReserva(hotelId, roomId, guestName, checkin, checkout, opts = {}) {
  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO reservas
      (id, hotel_id, room_id, guest_name, guest_email, guest_phone,
       checkin, checkout, status, source, plan, notes, token, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, hotelId, roomId, guestName.trim(),
    opts.guestEmail  || null,
    opts.guestPhone  || null,
    checkin, checkout,
    opts.status  || 'confirmed',
    opts.source  || 'direct',
    opts.plan    || null,
    opts.notes   || null,
    opts.token   || null,
    ts, ts
  );
  return getById(id);
}

// ── READ ──────────────────────────────────────────────────────────────────────
function getById(id) {
  return db.prepare('SELECT * FROM reservas WHERE id = ?').get(id) || null;
}

// Reservas que se solapan con el rango [from, to) — para el calendario
function getByHotel(hotelId, from, to) {
  return db.prepare(`
    SELECT * FROM reservas
    WHERE hotel_id = ? AND checkin < ? AND checkout > ?
    ORDER BY checkin
  `).all(hotelId, to, from);
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
const UPDATABLE = ['checkin','checkout','room_id','status','guest_name','guest_email','guest_phone','notes','plan','token'];

function updateReserva(id, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (UPDATABLE.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return getById(id);
  sets.push('updated_at = ?');
  vals.push(now(), id);
  db.prepare(`UPDATE reservas SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

// ── CANCEL ────────────────────────────────────────────────────────────────────
function cancelReserva(id) {
  const r = db.prepare(`UPDATE reservas SET status='cancelled', updated_at=? WHERE id=?`).run(now(), id);
  return r.changes > 0;
}

module.exports = { createReserva, getById, getByHotel, updateReserva, cancelReserva, checkDisponibilidad };
