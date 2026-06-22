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
const ACTIVITY_FILE = path.join(__dirname, 'data/activity.json');

// Semillas de fábrica para rooms.json/hotels.json — viven fuera de data/ (no está
// en el volumen persistente de Railway) para poder reconstruir el archivo si el
// volumen arranca vacío (pasó en producción: el volumen nunca tuvo estos 2 archivos,
// solo db/tokens, porque no tenían fallback de siembra como tokens.json sí tiene).
const ROOMS_SEED_FILE  = path.join(__dirname, 'seed/rooms.seed.json');
const HOTELS_SEED_FILE = path.join(__dirname, 'seed/hotels.seed.json');

// Cantidad máxima de registros de actividad guardados (global, los más viejos se descartan)
const ACTIVITY_MAX = 500;

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
    // Si rooms.json/hotels.json no existen (volumen nuevo o recién montado),
    // reconstruirlos desde la semilla de fábrica versionada en backend/seed/.
    if (file === ROOMS_FILE || file === HOTELS_FILE) {
      const seedFile = file === ROOMS_FILE ? ROOMS_SEED_FILE : HOTELS_SEED_FILE;
      try {
        const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[rooms] ${path.basename(file)} creado desde semilla de fábrica`);
        _cache.set(file, { mtimeMs: fs.statSync(file).mtimeMs, data });
        return data;
      } catch {}
      return {};
    }
    if (file === REQUESTS_FILE) return [];
    if (file === ACTIVITY_FILE) return [];
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
const getActivityLog = () => readJSON(ACTIVITY_FILE);

// Asigna (o quita, con categoriaId=null) la categoría de habitación (Individual/Doble/etc).
function setRoomCategoria(roomId, categoriaId) {
  const allRooms = getRooms();
  const room = allRooms[roomId];
  if (!room) return false;
  room.categoriaId = categoriaId || null;
  writeJSON(ROOMS_FILE, allRooms);
  return true;
}

// Renombra un canal de un enchufe inteligente (switch_3ch) a la función que
// realmente controla (ej. "🔥 Estufa" en vez de "Entrada 1") — el enchufe es
// el mecanismo, no el aparato.
function setDeviceChannelLabel(roomId, deviceKey, index, label) {
  const allRooms = getRooms();
  const room = allRooms[roomId];
  const dev  = room && room.devices[deviceKey];
  if (!dev || !Array.isArray(dev.channels) || index < 0 || index >= dev.channels.length) return false;
  dev.channels[index] = label;
  writeJSON(ROOMS_FILE, allRooms);
  return true;
}

// Habilita/deshabilita el modo manual (motor desbloqueado) de una cortina
// según lo configure el hotel desde el panel.
function setManualUnlock(roomId, deviceKey, allowed) {
  const allRooms = getRooms();
  const room = allRooms[roomId];
  if (!room || !room.devices[deviceKey]) return false;
  room.devices[deviceKey].manualUnlock = !!allowed;
  writeJSON(ROOMS_FILE, allRooms);
  return true;
}

// Oculta/muestra un dispositivo en la app del huésped — el dueño lo usa para
// dispositivos que prefiere seguir controlando solo desde el hotel. El
// dashboard de staff sigue viendo y controlando el dispositivo igual,
// independiente de este campo (se filtra solo del lado del huésped).
function setDeviceHidden(roomId, deviceKey, hidden) {
  const allRooms = getRooms();
  const room = allRooms[roomId];
  if (!room || !room.devices[deviceKey]) return false;
  room.devices[deviceKey].hidden = !!hidden;
  writeJSON(ROOMS_FILE, allRooms);
  return true;
}

// ── REGISTRO DE ACTIVIDAD POR HABITACIÓN ──────────────────────────────────────
// type: 'checkin' | 'qr_resent' | 'checkout' | 'prefs_changed' | 'service_request'
//       | 'request_resolved' | 'scene_off'
function addActivity(roomId, type, detail = '') {
  const log = getActivityLog();
  log.push({
    id:     crypto.randomBytes(6).toString('base64url').slice(0, 10),
    roomId,
    type,
    detail,
    at:     new Date().toISOString(),
  });
  if (log.length > ACTIVITY_MAX) log.splice(0, log.length - ACTIVITY_MAX);
  writeJSON(ACTIVITY_FILE, log);
}

function listActivity(roomId, limit = 20) {
  return getActivityLog()
    .filter(a => a.roomId === roomId)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

// Log maestro: junta la actividad de todas las habitaciones de un hotel (en
// vez de una sola, como listActivity) — para la vista "Log" del dashboard.
function listActivityByHotel(hotelId, { roomId, type, desde, hasta, q } = {}) {
  const allRooms = getRooms();
  const roomIds = Object.entries(allRooms)
    .filter(([id, r]) => r.hotelId === hotelId && (!roomId || id === roomId))
    .map(([id]) => id);

  let log = getActivityLog().filter(a => roomIds.includes(a.roomId));
  if (type)  log = log.filter(a => a.type === type);
  if (desde) log = log.filter(a => a.at >= desde);
  if (hasta) log = log.filter(a => a.at <= hasta + 'T23:59:59Z');
  if (q) {
    const ql = q.toLowerCase();
    log = log.filter(a => (a.detail || '').toLowerCase().includes(ql) || a.roomId.toLowerCase().includes(ql));
  }

  return log
    .map(a => ({ ...a, roomName: allRooms[a.roomId]?.name || a.roomId }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 500);
}

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
  addActivity(roomId, 'checkin', guestName.trim());
  return token;
}

// ── ACTUALIZAR PREFERENCIAS (idioma / accesibilidad) ─────────────────────────
function updateTokenPrefs(token, { lang, accessibility, dnd, alarmSensors } = {}) {
  const tokens = getTokens();
  const entry  = tokens[token];
  if (!entry || !entry.active) return false;
  const changes = [];
  if (lang          && GUEST_LANGS.includes(lang) && lang !== entry.lang) {
    entry.lang = lang;
    changes.push(`idioma → ${lang}`);
  }
  if (accessibility && ACCESSIBILITY_MODES.includes(accessibility) && accessibility !== entry.accessibility) {
    entry.accessibility = accessibility;
    changes.push(`accesibilidad → ${accessibility}`);
  }
  if (typeof dnd === 'boolean' && dnd !== entry.dnd) {
    entry.dnd = dnd;
    changes.push(dnd ? 'No molestar activado' : 'No molestar desactivado');
  }
  if (alarmSensors && typeof alarmSensors === 'object') {
    entry.alarmSensors = entry.alarmSensors || {};
    for (const [key, armed] of Object.entries(alarmSensors)) {
      if (typeof armed !== 'boolean' || armed === entry.alarmSensors[key]) continue;
      entry.alarmSensors[key] = armed;
      changes.push(`Alarma de ${key} ${armed ? 'activada' : 'desactivada'}`);
    }
  }
  writeJSON(TOKENS_FILE, tokens);
  if (changes.length) addActivity(entry.roomId, 'prefs_changed', changes.join(', '));
  return true;
}

// ── ESCENAS PERSONALIZADAS DEL HUÉSPED (por estadía/token) ───────────────────
const DEFAULT_SCENE_IDS = ['night', 'morning', 'relax', 'off'];
const MAX_CUSTOM_SCENES = 6;
const MAX_SCENE_STEPS   = 20;

// Guarda/sobrescribe una escena para la estadía actual.
// id: uno de DEFAULT_SCENE_IDS (sobrescribe sus pasos) o 'custom_<...>' (nueva o existente).
// Si id no se entrega o no existe como personalizada, se genera una nueva.
function saveScene(token, { id, name, icon, steps } = {}) {
  const tokens = getTokens();
  const entry  = tokens[token];
  if (!entry || !entry.active) return null;

  const result = getRoomByToken(token);
  if (!result) return null;
  const { room } = result;

  if (!Array.isArray(steps) || steps.length === 0 || steps.length > MAX_SCENE_STEPS) return null;

  const cleanSteps = [];
  for (const step of steps) {
    if (!step || typeof step.dev !== 'string' || !room.devices[step.dev]) return null;
    if (!step.cmd || typeof step.cmd !== 'object' || Array.isArray(step.cmd)) return null;
    const cmd = {};
    for (const [k, v] of Object.entries(step.cmd)) {
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') cmd[k] = v;
    }
    cleanSteps.push({ dev: step.dev, cmd });
  }

  if (!entry.scenes) entry.scenes = {};

  if (id && DEFAULT_SCENE_IDS.includes(id)) {
    entry.scenes[id] = { steps: cleanSteps };
    writeJSON(TOKENS_FILE, tokens);
    return { id };
  }

  // Escena personalizada: nueva o existente
  const cleanName = (name || '').toString().trim().slice(0, 30);
  const cleanIcon = (icon || '🎬').toString().trim().slice(0, 4);

  let targetId = (id && typeof id === 'string' && id.startsWith('custom_') && entry.scenes[id]) ? id : null;

  if (!targetId) {
    if (!cleanName) return null;
    const customCount = Object.keys(entry.scenes).filter(k => k.startsWith('custom_')).length;
    if (customCount >= MAX_CUSTOM_SCENES) return null;
    targetId = `custom_${crypto.randomBytes(4).toString('base64url')}`;
  }

  entry.scenes[targetId] = {
    name: cleanName || entry.scenes[targetId]?.name || 'Escena',
    icon: cleanIcon,
    steps: cleanSteps,
  };
  writeJSON(TOKENS_FILE, tokens);
  return { id: targetId };
}

// Elimina una escena personalizada, o restaura una escena por defecto a su configuración original.
function deleteScene(token, id) {
  const tokens = getTokens();
  const entry  = tokens[token];
  if (!entry || !entry.active) return false;
  if (!entry.scenes || !entry.scenes[id]) return false;
  delete entry.scenes[id];
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
  const entry = tokens[token];
  if (!entry) return false;
  entry.active    = false;
  entry.expiredAt = new Date().toISOString();
  writeJSON(TOKENS_FILE, tokens);
  addActivity(entry.roomId, 'checkout', entry.guestName);
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
// "Activo" = el huésped está actualmente en la habitación (checkin <= ahora <= checkout),
// no solo que el token no haya expirado — una reserva futura no debe verse como ocupada hoy.
function listActiveTokens() {
  const tokens = getTokens();
  const rooms  = getRooms();
  const ahora  = new Date();
  return Object.entries(tokens)
    .filter(([, t]) => t.active && new Date(t.checkin) <= ahora && new Date(t.checkout) >= ahora)
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
    .filter(([, t]) => t.roomId === roomId && t.active && new Date(t.checkin) <= now && new Date(t.checkout) >= now)
    .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));
  return candidates.length ? candidates[0][0] : null;
}

// ── SOLICITUDES DE SERVICIO ───────────────────────────────────────────────────
// towels/roomservice: amenities. cleaning: aseo. late_checkout: salida tardía.
// maintenance/other: requieren note describiendo el problema o pedido.
// app_problem: problema con la app/PMS en sí (no con la habitación) — además de
// quedar como solicitud normal, server.js le manda un correo aparte al admin.
const REQUEST_TYPES = ['towels', 'roomservice', 'cleaning', 'late_checkout', 'maintenance', 'other', 'app_problem'];

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
  addActivity(entry.roomId, 'service_request', type);
  return request;
}

// ── LISTAR SOLICITUDES (filtrar por hotel, estado y/o rango de fecha) ────────
// from/to comparan contra createdAt (fecha de la solicitud, no de resolución),
// como YYYY-MM-DD — para el registro/log que revisa el hotel.
function listRequests({ hotelId, status, from, to } = {}) {
  let list = getRequests();
  if (hotelId) list = list.filter(r => r.hotelId === hotelId);
  if (status)  list = list.filter(r => r.status === status);
  if (from)    list = list.filter(r => r.createdAt.slice(0, 10) >= from);
  if (to)      list = list.filter(r => r.createdAt.slice(0, 10) <= to);
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
  addActivity(request.roomId, 'request_resolved', request.type);
  return true;
}

// Migración única: enchufes inteligentes con las etiquetas genéricas
// "Entrada 1"/"Entrada 2" de antes de renombrarlos a la función real que
// controlan (🔥 Estufa, 🌸 Aromatizador). En Railway el volumen de backend/data/
// persiste entre deploys y rooms.json solo se siembra si el archivo no existe
// (ver readJSON arriba) — así que un cambio al JSON commiteado en git nunca
// llega solo a un volumen que ya tenía el archivo de antes. Esto se autocorrige
// la próxima vez que arranca el servidor, sin depender de tocar el volumen a mano.
(function migrarEtiquetasEnchufe() {
  const allRooms = getRooms();
  let changed = false;
  for (const room of Object.values(allRooms)) {
    const dev = room.devices && room.devices.enchufe;
    if (!dev || !Array.isArray(dev.channels)) continue;
    if (dev.channels.length === 1 && dev.channels[0] === 'Entrada 1') {
      dev.channels = ['🔥 Estufa'];
      dev.label = 'Enchufe inteligente';
      changed = true;
    } else if (dev.channels.length === 2 && dev.channels[0] === 'Entrada 1' && dev.channels[1] === 'Entrada 2') {
      dev.channels = ['🔥 Estufa', '🌸 Aromatizador'];
      dev.label = 'Enchufe inteligente';
      changed = true;
    }
  }
  if (changed) {
    writeJSON(ROOMS_FILE, allRooms);
    console.log('[rooms] Migración: etiquetas de enchufe actualizadas a funciones (Estufa/Aromatizador)');
  }
})();

// Migración única: doorAlarm (boolean único, asumía una sola puerta) pasó a
// alarmSensors (mapa por deviceKey, soporta puerta + N ventanas armadas
// independientemente). Tokens activos en producción ya tienen doorAlarm
// guardado — se traduce su valor a alarmSensors.puerta antes de que nada más
// lea tokens.json, sin perder la preferencia que el huésped ya eligió.
(function migrarAlarmaPuertaAAlarmSensors() {
  const tokens = getTokens();
  let changed = false;
  for (const entry of Object.values(tokens)) {
    if (entry.alarmSensors) continue;
    entry.alarmSensors = { puerta: entry.doorAlarm === true };
    delete entry.doorAlarm;
    changed = true;
  }
  if (changed) {
    writeJSON(TOKENS_FILE, tokens);
    console.log('[rooms] Migración: doorAlarm → alarmSensors (por dispositivo)');
  }
})();

module.exports = { generateToken, validateToken, expireToken, getRoomByToken, listActiveTokens, getActiveTokenForRoom, getRooms, getHotels, updateTokenPrefs, createRequest, listRequests, resolveRequest, addActivity, listActivity, listActivityByHotel, setManualUnlock, setDeviceHidden, setDeviceChannelLabel, setRoomCategoria, saveScene, deleteScene };
