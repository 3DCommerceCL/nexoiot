'use strict';
// backend/alarmas-puerta.js — Aviso a recepción cuando se abre la puerta de una
// habitación con la alarma armada por el huésped (ver rooms.js:updateTokenPrefs,
// campo doorAlarm). El huésped detecta la apertura por polling en el cliente
// (frontend/app.js) y llama a registrarDisparo(); esto solo guarda el aviso
// para que recepción lo vea, no dispara nada del lado del huésped.

const crypto = require('crypto');
const db     = require('./db');

const genId = () => crypto.randomBytes(8).toString('hex');

function registrarDisparo(hotelId, roomId) {
  const id = genId();
  db.prepare(`
    INSERT INTO alarmas_puerta (id, hotel_id, room_id, disparada_at, reconocida)
    VALUES (?,?,?,?,0)
  `).run(id, hotelId, roomId, new Date().toISOString());
  return db.prepare('SELECT * FROM alarmas_puerta WHERE id = ?').get(id);
}

function listarNoReconocidas(hotelId) {
  return db.prepare(`
    SELECT * FROM alarmas_puerta WHERE hotel_id = ? AND reconocida = 0 ORDER BY disparada_at DESC
  `).all(hotelId);
}

function getById(id) {
  return db.prepare('SELECT * FROM alarmas_puerta WHERE id = ?').get(id);
}

function reconocer(id) {
  db.prepare('UPDATE alarmas_puerta SET reconocida = 1 WHERE id = ?').run(id);
}

module.exports = { registrarDisparo, listarNoReconocidas, getById, reconocer };
