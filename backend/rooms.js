'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// rooms.js — Gestión de habitaciones y tokens de estadía
// Los datos se guardan en JSON; reemplazar con SQLite/PG en v2.
// ─────────────────────────────────────────────────────────────────────────────

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOMS_FILE  = path.join(__dirname, 'data/rooms.json');
const TOKENS_FILE = path.join(__dirname, 'data/tokens.json');

// Token de demo preincluido — siempre disponible para pruebas
const SEED_TOKENS = {
  DEMO1234: {
    roomId:    '101',
    guestName: 'Demo Huésped',
    phone:     '+56900000000',
    checkin:   '2026-01-01T14:00:00Z',
    checkout:  '2030-12-31T12:00:00Z',
    active:    true,
    createdAt: '2026-01-01T00:00:00Z',
  },
};

// ── I/O JSON ──────────────────────────────────────────────────────────────────
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch {
    // Si tokens.json no existe (primer arranque en Railway), sembrarlo
    if (file === TOKENS_FILE) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(SEED_TOKENS, null, 2), 'utf8');
        console.log('[rooms] tokens.json creado con token de demo');
      } catch {}
      return { ...SEED_TOKENS };
    }
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const getRooms  = () => readJSON(ROOMS_FILE);
const getTokens = () => readJSON(TOKENS_FILE);

// ── GENERAR TOKEN ─────────────────────────────────────────────────────────────
function generateToken(roomId, guestName, checkin, checkout, phone = '') {
  const rooms  = getRooms();
  const tokens = getTokens();

  if (!rooms[roomId]) throw new Error(`Habitación ${roomId} no encontrada en rooms.json`);

  // Token único de 8 caracteres alfanuméricos URL-safe
  let token;
  do { token = crypto.randomBytes(6).toString('base64url').slice(0, 8); }
  while (tokens[token]);

  tokens[token] = {
    roomId,
    guestName: guestName.trim(),
    phone:     (phone || '').trim(),
    checkin:   new Date(checkin).toISOString(),
    checkout:  new Date(checkout).toISOString(),
    active:    true,
    createdAt: new Date().toISOString(),
  };

  writeJSON(TOKENS_FILE, tokens);
  return token;
}

// ── VALIDAR TOKEN ─────────────────────────────────────────────────────────────
// Retorna el registro del token si es válido y activo, o null si no.
function validateToken(token) {
  const tokens = getTokens();
  const entry  = tokens[token];
  if (!entry)          return null;
  if (!entry.active)   return null;
  if (new Date(entry.checkout) < new Date()) return null; // expirado
  return entry;
}

// ── EXPIRAR TOKEN ─────────────────────────────────────────────────────────────
function expireToken(token) {
  const tokens = getTokens();
  if (!tokens[token]) return false;
  tokens[token].active    = false;
  tokens[token].expiredAt = new Date().toISOString();
  writeJSON(TOKENS_FILE, tokens);
  return true;
}

// ── OBTENER DISPOSITIVOS DE UNA HABITACIÓN ────────────────────────────────────
// Retorna { room, entry } si el token es válido, o null.
function getRoomByToken(token) {
  const entry = validateToken(token);
  if (!entry) return null;
  const rooms = getRooms();
  const room  = rooms[entry.roomId];
  if (!room) return null;
  return { room, entry };
}

// ── LISTAR TOKENS ACTIVOS ─────────────────────────────────────────────────────
function listActiveTokens() {
  const tokens = getTokens();
  const rooms  = getRooms();
  return Object.entries(tokens)
    .filter(([, t]) => t.active && new Date(t.checkout) >= new Date())
    .map(([token, t]) => ({
      token,
      roomId:    t.roomId,
      roomName:  rooms[t.roomId]?.name || t.roomId,
      guestName: t.guestName,
      phone:     t.phone,
      checkin:   t.checkin,
      checkout:  t.checkout,
      createdAt: t.createdAt,
    }));
}

module.exports = { generateToken, validateToken, expireToken, getRoomByToken, listActiveTokens, getRooms };
