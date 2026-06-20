'use strict';
// backend/contacto-config.js — Cómo contacta el huésped a recepción, configurable
// por hotel: WhatsApp (default), citófono de la habitación, bajar a recepción en
// persona, u otro método con mensaje libre.

const db = require('./db');

const now = () => new Date().toISOString();

const METODOS = ['whatsapp', 'citofono', 'bajar_recepcion', 'otro'];
const DEFAULTS = { metodo: 'whatsapp', mensaje_otro: null };
const ALLOWED = ['metodo', 'mensaje_otro'];

function getConfig(hotelId) {
  const row = db.prepare('SELECT * FROM contacto_config WHERE hotel_id = ?').get(hotelId);
  if (row) return row;
  return { hotel_id: hotelId, ...DEFAULTS };
}

function upsertConfig(hotelId, fields) {
  if (fields.metodo && !METODOS.includes(fields.metodo)) {
    throw new Error(`metodo debe ser uno de: ${METODOS.join(', ')}`);
  }
  const ts       = now();
  const existing = db.prepare('SELECT hotel_id FROM contacto_config WHERE hotel_id = ?').get(hotelId);

  if (!existing) {
    const merged = { ...DEFAULTS };
    for (const [k, v] of Object.entries(fields)) {
      if (ALLOWED.includes(k)) merged[k] = v;
    }
    db.prepare(`
      INSERT INTO contacto_config (hotel_id, metodo, mensaje_otro, created_at, updated_at)
      VALUES (?,?,?,?,?)
    `).run(hotelId, merged.metodo, merged.mensaje_otro, ts, ts);
  } else {
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.includes(k)) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length) {
      sets.push('updated_at = ?');
      vals.push(ts, hotelId);
      db.prepare(`UPDATE contacto_config SET ${sets.join(', ')} WHERE hotel_id = ?`).run(...vals);
    }
  }
  return getConfig(hotelId);
}

module.exports = { getConfig, upsertConfig, METODOS };
