'use strict';
// backend/canales.js — CRUD para canales de distribución OTA y sus mappings de habitaciones

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

// ── CANALES ───────────────────────────────────────────────────────────────────
function createCanal(hotelId, nombre, config) {
  const id = genId();
  db.prepare(`
    INSERT INTO canales (id, hotel_id, nombre, activo, config, created_at)
    VALUES (?,?,?,1,?,?)
  `).run(id, hotelId, nombre, config ? JSON.stringify(config) : null, now());
  return getById(id);
}

function getById(id) {
  const c = db.prepare('SELECT * FROM canales WHERE id = ?').get(id);
  return c ? parseConfig(c) : null;
}

function getByHotel(hotelId) {
  return db.prepare('SELECT * FROM canales WHERE hotel_id = ? ORDER BY nombre').all(hotelId)
    .map(parseConfig);
}

function updateCanal(id, fields) {
  const ALLOWED = ['activo', 'config'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!ALLOWED.includes(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(k === 'config' ? JSON.stringify(v) : v);
  }
  if (!sets.length) return getById(id);
  vals.push(id);
  db.prepare(`UPDATE canales SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getById(id);
}

function deleteCanal(id) {
  db.prepare('DELETE FROM canal_room_mapping WHERE canal_id = ?').run(id);
  return db.prepare('DELETE FROM canales WHERE id = ?').run(id).changes > 0;
}

function parseConfig(c) {
  try { return { ...c, config: c.config ? JSON.parse(c.config) : null }; }
  catch { return { ...c, config: null }; }
}

// ── ROOM MAPPINGS ─────────────────────────────────────────────────────────────
function addMapping(canalId, roomId, otaRoomId, otaRateId) {
  const id = genId();
  db.prepare(`
    INSERT INTO canal_room_mapping (id, canal_id, room_id, ota_room_id, ota_rate_id, created_at)
    VALUES (?,?,?,?,?,?)
  `).run(id, canalId, roomId, otaRoomId, otaRateId || null, now());
  return db.prepare('SELECT * FROM canal_room_mapping WHERE id = ?').get(id);
}

function getMappings(canalId) {
  return db.prepare('SELECT * FROM canal_room_mapping WHERE canal_id = ?').all(canalId);
}

function getMappingById(id) {
  return db.prepare('SELECT * FROM canal_room_mapping WHERE id = ?').get(id) || null;
}

function deleteMapping(id) {
  return db.prepare('DELETE FROM canal_room_mapping WHERE id = ?').run(id).changes > 0;
}

// ── SYNC LOG ──────────────────────────────────────────────────────────────────
function getSyncStatus(canalId, limit = 10) {
  return db.prepare(
    'SELECT * FROM sync_log WHERE canal_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(canalId, limit);
}

module.exports = { createCanal, getById, getByHotel, updateCanal, deleteCanal, addMapping, getMappings, getMappingById, deleteMapping, getSyncStatus };
