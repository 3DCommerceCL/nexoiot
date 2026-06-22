'use strict';
// backend/encuesta-config.js — Preguntas de la encuesta de satisfacción que cada hotel define
// (distinto de booking-config.link_resenas, que es un link externo de reseñas, no preguntas
// propias con respuestas guardadas — ver backend/encuesta-respuestas.js).

const db = require('./db');

function getConfig(hotelId) {
  const row = db.prepare('SELECT * FROM encuesta_config WHERE hotel_id = ?').get(hotelId);
  if (!row) return { hotel_id: hotelId, preguntas: [] };
  let preguntas = [];
  try { preguntas = JSON.parse(row.preguntas); } catch { /* deja [] */ }
  return { hotel_id: hotelId, preguntas };
}

function upsertConfig(hotelId, preguntas) {
  const ts  = new Date().toISOString();
  const row = db.prepare('SELECT hotel_id FROM encuesta_config WHERE hotel_id = ?').get(hotelId);
  const json = JSON.stringify(Array.isArray(preguntas) ? preguntas : []);
  if (row) {
    db.prepare('UPDATE encuesta_config SET preguntas = ?, updated_at = ? WHERE hotel_id = ?').run(json, ts, hotelId);
  } else {
    db.prepare('INSERT INTO encuesta_config (hotel_id, preguntas, updated_at) VALUES (?,?,?)').run(hotelId, json, ts);
  }
  return getConfig(hotelId);
}

module.exports = { getConfig, upsertConfig };
