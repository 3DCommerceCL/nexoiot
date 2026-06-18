'use strict';
// backend/checkin-previo.js — Formulario de pre-checkin del huésped (documento, T&C, firma digital)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function getByReserva(reservaId) {
  return db.prepare('SELECT * FROM checkin_previo WHERE reserva_id = ?').get(reservaId) || null;
}

function crear(reservaId, hotelId, { docTipo, docNumero, telefono, nombresAdicionales, aceptaTyc, firmaBase64 }) {
  if (getByReserva(reservaId)) throw new Error('Esta reserva ya tiene un pre-checkin completado');
  const id = genId();
  db.prepare(`
    INSERT INTO checkin_previo
      (id, reserva_id, hotel_id, doc_tipo, doc_numero, telefono, nombres_adicionales, acepta_tyc, firma_base64, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, reservaId, hotelId, docTipo, docNumero, telefono || null,
    nombresAdicionales?.length ? JSON.stringify(nombresAdicionales) : null,
    aceptaTyc ? 1 : 0, firmaBase64, now()
  );
  return getByReserva(reservaId);
}

module.exports = { getByReserva, crear };
