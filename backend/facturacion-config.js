'use strict';
// backend/facturacion-config.js — Credenciales Tupana/SII por hotel.
// Cada hotel emite sus propios documentos tributarios bajo su propio RUT —
// nunca un emisor global compartido (ver docs/prompts/06-facturacion-sii-tupana.md
// para el contexto legal de por qué esto tiene que ser por hotel).

const db = require('./db');

const now = () => new Date().toISOString();

const DEFAULTS = {
  tupana_api_url: null,
  tupana_api_key: null,
  rut_emisor:     null,
  razon_social:   null,
  giro:           null,
  ambiente:       'cert',
  activo:         0,
};

const ALLOWED = ['tupana_api_url', 'tupana_api_key', 'rut_emisor', 'razon_social', 'giro', 'ambiente', 'activo'];

function getConfig(hotelId) {
  const row = db.prepare('SELECT * FROM facturacion_config WHERE hotel_id = ?').get(hotelId);
  if (row) return { ...row, activo: !!row.activo };
  return { hotel_id: hotelId, ...DEFAULTS, activo: false };
}

function upsertConfig(hotelId, fields) {
  const ts       = now();
  const existing = db.prepare('SELECT hotel_id FROM facturacion_config WHERE hotel_id = ?').get(hotelId);

  if (!existing) {
    const merged = { ...DEFAULTS };
    for (const [k, v] of Object.entries(fields)) {
      if (ALLOWED.includes(k)) merged[k] = v;
    }
    db.prepare(`
      INSERT INTO facturacion_config
        (hotel_id, tupana_api_url, tupana_api_key, rut_emisor, razon_social, giro, ambiente, activo, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(hotelId, merged.tupana_api_url, merged.tupana_api_key, merged.rut_emisor,
      merged.razon_social, merged.giro, merged.ambiente, merged.activo ? 1 : 0, ts, ts);
  } else {
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.includes(k)) continue;
      sets.push(`${k} = ?`);
      vals.push(k === 'activo' ? (v ? 1 : 0) : v);
    }
    if (sets.length) {
      sets.push('updated_at = ?');
      vals.push(ts, hotelId);
      db.prepare(`UPDATE facturacion_config SET ${sets.join(', ')} WHERE hotel_id = ?`).run(...vals);
    }
  }
  return getConfig(hotelId);
}

module.exports = { getConfig, upsertConfig };
