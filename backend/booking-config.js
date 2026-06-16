'use strict';
// backend/booking-config.js — Configuración del booking engine por hotel

const db = require('./db');

const now = () => new Date().toISOString();

const DEFAULTS = {
  titulo:           null,
  color_primario:   '#009D71',
  color_secundario: '#102943',
  logo_url:         null,
  politica_cancel:  'Cancelación gratuita hasta 24 horas antes del check-in.',
  idiomas:          '["es"]',
  rooms_visibles:   null,
  activo:           1,
};

const ALLOWED = ['titulo', 'color_primario', 'color_secundario', 'logo_url', 'politica_cancel', 'idiomas', 'rooms_visibles', 'activo'];

function getConfig(hotelId) {
  const row = db.prepare('SELECT * FROM booking_config WHERE hotel_id = ?').get(hotelId);
  if (row) return parse(row);
  return {
    hotel_id: hotelId,
    titulo: DEFAULTS.titulo,
    color_primario: DEFAULTS.color_primario,
    color_secundario: DEFAULTS.color_secundario,
    logo_url: DEFAULTS.logo_url,
    politica_cancel: DEFAULTS.politica_cancel,
    idiomas: ['es'],
    rooms_visibles: null,
    activo: true,
  };
}

function upsertConfig(hotelId, fields) {
  const ts       = now();
  const existing = db.prepare('SELECT hotel_id FROM booking_config WHERE hotel_id = ?').get(hotelId);

  // Serializar arrays
  const serialize = (k, v) => {
    if ((k === 'idiomas' || k === 'rooms_visibles') && Array.isArray(v)) return JSON.stringify(v);
    return v;
  };

  if (!existing) {
    const merged = { ...DEFAULTS };
    for (const [k, v] of Object.entries(fields)) {
      if (ALLOWED.includes(k)) merged[k] = serialize(k, v);
    }
    db.prepare(`
      INSERT INTO booking_config
        (hotel_id, titulo, color_primario, color_secundario, logo_url, politica_cancel, idiomas, rooms_visibles, activo, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(hotelId, merged.titulo, merged.color_primario, merged.color_secundario,
      merged.logo_url, merged.politica_cancel, merged.idiomas, merged.rooms_visibles, merged.activo, ts, ts);
  } else {
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.includes(k)) continue;
      sets.push(`${k} = ?`);
      vals.push(serialize(k, v));
    }
    if (sets.length) {
      sets.push('updated_at = ?');
      vals.push(ts, hotelId);
      db.prepare(`UPDATE booking_config SET ${sets.join(', ')} WHERE hotel_id = ?`).run(...vals);
    }
  }
  return getConfig(hotelId);
}

function isActivo(hotelId) {
  const row = db.prepare('SELECT activo FROM booking_config WHERE hotel_id = ?').get(hotelId);
  return row ? !!row.activo : true; // sin config = activo por defecto
}

function parse(row) {
  const tryParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
  return {
    ...row,
    idiomas:        tryParse(row.idiomas, ['es']),
    rooms_visibles: row.rooms_visibles ? tryParse(row.rooms_visibles, null) : null,
    activo:         !!row.activo,
  };
}

module.exports = { getConfig, upsertConfig, isActivo };
