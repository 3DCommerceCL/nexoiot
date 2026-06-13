'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// rooms.js — Gestión de habitaciones y tokens de estadía
// Los datos se guardan en JSON; reemplazar con SQLite/PG en v2.
// ─────────────────────────────────────────────────────────────────────────────

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOMS_FILE    = path.join(__dirname, 'data/rooms.json');
const TOKENS_FILE   = path.join(__dirname, 'data/tokens.json');
const HOTELS_FILE   = path.join(__dirname, 'data/hotels.json');
const REQUESTS_FILE = path.join(__dirname, 'data/requests.json');

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
  // Token sin vencimiento para feedback/demos comerciales — habitación simulada,
  // no controla dispositivos reales (ver rooms.json → "demo" y tuya.js → demo_*).
  FEEDBACK01: {
    roomId:    'demo',
    guestName: 'Visitante Demo',
    phone:     '',
    checkin:   '2026-01-01T00:00:00Z',
    checkout:  '2099-12-31T23:59:59Z',
    active:    true,
    createdAt: '2026-01-01T00:00:00Z',
  },
};

// ── I/O JSON (con cache en memoria invalidada por mtime) ─────────────────────
// Evita releer y re-parsear los archivos completos en cada request (p.ej. el
// polling de /api/tv/:roomId cada 60s). Solo se vuelve a leer del disco si el
// archivo cambió desde la última lectura (mtime distinto) o tras escribirlo.
const _cache = new Map(); // file -> { mtimeMs, data }

function readJSON(file) {
  try {
    const { mtimeMs } = fs.statSync(file);
    const cached = _cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) return cached.data;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    _cache.set(file, { mtimeMs, data });
    return data;
  } catch {
    // Si tokens.json no existe (primer arranque en Railway), sembrarlo
    if (file === TOKENS_FILE) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const data = { ...SEED_TOKENS };
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        console.log('[rooms] tokens.json creado con token de demo');
        _cache.set(file, { mtimeMs: fs.statSync(file).mtimeMs, data });
        return data;
      } catch {}
      return { ...SEED_TOKENS };
    }
    if (file === REQUESTS_FILE) return [];
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  _cache.set(file, { mtimeMs: fs.statSync(file).mtimeMs, data });
}

const getRooms    = () => readJSON(ROOMS_FILE);
const getTokens   = () => readJSON(TOKENS_FILE);
const getHotels   = () => readJSON(HOTELS_FILE);
const getRequests = () => readJSON(REQUESTS_FILE);

// ── IDIOMA Y ACCESIBILIDAD DEL HUÉSPED ───────────────────────────────────────
const GUEST_LANGS          = ['es', 'en', 'pt'];
const ACCESSIBILITY_MODES  = ['none', 'vision', 'hearing'];

// ── GENERAR TOKEN ─────────────────────────────────────────────────────────────
function generateToken(roomId, guestName, checkin, checkout, phone = '', lang = 'es', accessibility = 'none') {
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
    lang:          GUEST_LANGS.includes(lang) ? lang : 'es',
    accessibility: ACCESSIBILITY_MODES.includes(accessibility) ? accessibility : 'none',
    active:    true,
    createdAt: new Date().toISOString(),
  };

  writeJSON(TOKENS_FILE, tokens);
  return token;
}

// ── ACTUALIZAR PREFERENCIAS (idioma / accesibilidad) ─────────────────────────
function updateTokenPrefs(token, { lang, accessibility, dnd } = {}) {
  const tokens = getTokens();
  const entry  = tokens[token];
  if (!entry || !entry.active) return false;
  if (lang          && GUEST_LANGS.includes(lang))                   entry.lang = lang;
  if (accessibility && ACCESSIBILITY_MODES.includes(accessibility))  entry.accessibility = accessibility;
  if (typeof dnd === 'boolean')                                      entry.dnd = dnd;
  writeJSON(TOKENS_FILE, tokens);
  return true;
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
      lang:          t.lang || 'es',
      accessibility: t.accessibility || 'none',
      dnd:           t.dnd || false,
      createdAt: t.createdAt,
    }));
}

// ── TOKEN ACTIVO MÁS RECIENTE DE UNA HABITACIÓN ──────────────────────────────
// Usado por la pantalla de TV para mostrar el QR del huésped actual.
function getActiveTokenForRoom(roomId) {
  const tokens = getTokens();
  const now = new Date();
  const candidates = Object.entries(tokens)
    .filter(([, t]) => t.roomId === roomId && t.active && new Date(t.checkout) >= now)
    .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));
  return candidates.length ? candidates[0][0] : null;
}

// ── SOLICITUDES DE SERVICIO (toallas/amenities, room service) ───────────────
const REQUEST_TYPES = ['towels', 'roomservice'];

function createRequest(token, type, note = '') {
  if (!REQUEST_TYPES.includes(type)) return null;
  const entry = validateToken(token);
  if (!entry) return null;

  const allRooms = getRooms();
  const room     = allRooms[entry.roomId] || {};
  const requests = getRequests();

  const request = {
    id:        crypto.randomBytes(6).toString('base64url').slice(0, 10),
    roomId:    entry.roomId,
    roomName:  room.name || entry.roomId,
    hotelId:   room.hotelId || null,
    guestName: entry.guestName,
    type,
    note:      (note || '').trim(),
    status:    'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  requests.push(request);
  writeJSON(REQUESTS_FILE, requests);
  return request;
}

// ── LISTAR SOLICITUDES (filtrar por hotel y/o estado) ────────────────────────
function listRequests({ hotelId, status } = {}) {
  let list = getRequests();
  if (hotelId) list = list.filter(r => r.hotelId === hotelId);
  if (status)  list = list.filter(r => r.status === status);
  return list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── RESOLVER SOLICITUD ────────────────────────────────────────────────────────
function resolveRequest(id) {
  const requests = getRequests();
  const request  = requests.find(r => r.id === id);
  if (!request) return false;
  request.status     = 'done';
  request.resolvedAt = new Date().toISOString();
  writeJSON(REQUESTS_FILE, requests);
  return true;
}

module.exports = { generateToken, validateToken, expireToken, getRoomByToken, listActiveTokens, getActiveTokenForRoom, getRooms, getHotels, updateTokenPrefs, createRequest, listRequests, resolveRequest };
