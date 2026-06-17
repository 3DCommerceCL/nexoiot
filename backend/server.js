'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// server.js — Nexo IoT Room Server
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const tuya      = require('./tuya');
const rooms     = require('./rooms');
const reservas  = require('./reservas');
const bloqueos  = require('./bloqueos');
const canales       = require('./canales');
const cm            = require('./channel-manager');
const tarifas       = require('./tarifas');
const categorias    = require('./categorias');
const bookingConfig = require('./booking-config');
const pagos         = require('./pagos');
const transacciones = require('./transacciones');
const auth          = require('./auth');

const app       = express();
const PORT        = process.env.PORT      || 3000;
const HOTEL_URL   = process.env.HOTEL_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://3dcommercecl.github.io/nexoiot').replace(/\/$/, '');

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://3dcommercecl.github.io',                   // frontend (GitHub Pages)
  'https://nexoiot-production.up.railway.app',        // mismo Railway (health checks, etc.)
  /^http:\/\/localhost(:\d+)?$/,                       // desarrollo local (cualquier puerto)
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

// Endpoints /api/public/ son de acceso abierto (booking widget embebido en sitios de hoteles)
const corsPublic     = cors({ origin: '*', methods: ['GET', 'OPTIONS'] });
const corsRestricted = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(allowed ? null : new Error(`CORS bloqueado: ${origin}`), allowed);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
});
app.use((req, res, next) =>
  req.path.startsWith('/api/public/') ? corsPublic(req, res, next) : corsRestricted(req, res, next)
);
app.use(express.json());

// Sirve la web app del huésped como archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting: 120 req/min por IP (2 por segundo, suficiente para sliders)
const limiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un momento.' },
});
app.use('/api/', limiter);

// Rate limiter más estricto para endpoints públicos (sin autenticación)
const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un momento.' },
  keyGenerator: req => `${req.ip}:${req.params.slug || ''}`,
});

// ── DISPONIBILIDAD: cache en memoria con TTL de 60 s ─────────────────────────
const disponibilidadCache = new Map();
const CACHE_TTL_MS = 60_000;

function getCached(key) {
  const entry = disponibilidadCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { disponibilidadCache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data) {
  disponibilidadCache.set(key, { ts: Date.now(), data });
}
function invalidarCacheDisponibilidad(slug) {
  for (const key of disponibilidadCache.keys()) {
    if (key.startsWith(`disp:${slug}:`)) disponibilidadCache.delete(key);
  }
}

// ── VALOR UF DEL DÍA (cache diario) ──────────────────────────────────────────
let valorUF = 41000;

async function actualizarUF() {
  try {
    const res  = await fetch('https://mindicador.cl/api/uf');
    const data = await res.json();
    valorUF = data.serie[0].valor;
  } catch { /* usar valor de respaldo */ }
}
actualizarUF();
setInterval(actualizarUF, 24 * 60 * 60 * 1000);

// Logging (el token se oculta en los logs)
app.use((req, _res, next) => {
  const safe = req.path.replace(/\/([A-Za-z0-9_-]{6,16})/g, '/[TOKEN]');
  process.stdout.write(`[${new Date().toISOString()}] ${req.method} ${safe}\n`);
  next();
});

// ── AUTH: sesiones por token (Authorization: Bearer <token>) ────────────────
// requireAuth() sin args → cualquier rol autenticado. requireAuth('owner','recepcion') → solo esos roles.
function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado. Falta token.' });

    const result = auth.getSesionConUsuario(token);
    if (!result) return res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });

    const { usuario } = result;
    // superadmin siempre pasa, sin importar los roles permitidos en este endpoint
    if (roles.length && usuario.rol !== 'superadmin' && !roles.includes(usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    req.user = { id: usuario.id, hotelId: usuario.hotel_id, rol: usuario.rol, email: usuario.email, nombre: usuario.nombre };
    next();
  };
}

// Verifica que el usuario autenticado pueda operar sobre hotelId (superadmin = siempre; resto = solo su propio hotel)
function assertHotelAccess(req, hotelId) {
  return req.user.rol === 'superadmin' || req.user.hotelId === hotelId;
}

// Rate limiter estricto para login (evitar fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un momento.' },
});

// ── AUTH: POST /api/auth/login ────────────────────────────────────────────────
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Requeridos: email, password' });

  const usuario = auth.getUsuarioByEmail(email);
  if (!usuario || !usuario.activo || !auth.verifyPassword(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  const { token } = auth.createSesion(usuario.id);
  auth.marcarLogin(usuario.id);
  res.json({ token, rol: usuario.rol, hotelId: usuario.hotel_id, nombre: usuario.nombre, email: usuario.email });
});

// ── AUTH: POST /api/auth/bootstrap-superadmin ─────────────────────────────────
// Crea el primer superadmin. Se autodeshabilita en cuanto exista uno — no requiere
// secreto ni acceso al servidor: es seguro dejarlo desplegado permanentemente.
app.post('/api/auth/bootstrap-superadmin', loginLimiter, (req, res) => {
  if (auth.hasSuperadmin()) {
    return res.status(403).json({ error: 'Ya existe un superadmin. Este endpoint está deshabilitado.' });
  }
  const { email, password, nombre } = req.body || {};
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Requeridos: email, password, nombre' });
  }
  if (auth.getUsuarioByEmail(email)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }
  const usuario = auth.createUsuario(null, email, password, nombre, 'superadmin');
  res.status(201).json({ id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol });
});

// ── AUTH: POST /api/auth/logout ───────────────────────────────────────────────
app.post('/api/auth/logout', requireAuth(), (req, res) => {
  const token = (req.headers['authorization'] || '').slice(7);
  auth.deleteSesion(token);
  res.json({ success: true });
});

// ── AUTH: GET /api/auth/me ─────────────────────────────────────────────────────
app.get('/api/auth/me', requireAuth(), (req, res) => {
  res.json(req.user);
});

// ── ADMIN: GET /api/admin/usuarios ────────────────────────────────────────────
// ?hotel=<id> opcional — sin filtro, solo superadmin ve todos
app.get('/api/admin/usuarios', requireAuth('superadmin'), (req, res) => {
  res.json(auth.listUsuarios(req.query.hotel || null));
});

// ── ADMIN: POST /api/admin/usuarios ───────────────────────────────────────────
app.post('/api/admin/usuarios', requireAuth('superadmin'), (req, res) => {
  const { email, password, nombre, rol, hotelId } = req.body || {};
  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Requeridos: email, password, nombre, rol' });
  }
  if (!['superadmin', 'owner', 'recepcion'].includes(rol)) {
    return res.status(400).json({ error: 'rol debe ser superadmin, owner o recepcion' });
  }
  if (rol !== 'superadmin' && !hotelId) {
    return res.status(400).json({ error: 'hotelId requerido para rol owner/recepcion' });
  }
  if (auth.getUsuarioByEmail(email)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }
  const usuario = auth.createUsuario(rol === 'superadmin' ? null : hotelId, email, password, nombre, rol);
  res.status(201).json({ id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, hotel_id: usuario.hotel_id });
});

// ── ADMIN: PATCH /api/admin/usuarios/:id ──────────────────────────────────────
app.patch('/api/admin/usuarios/:id', requireAuth('superadmin'), (req, res) => {
  if (!auth.getUsuarioById(req.params.id)) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(auth.updateUsuario(req.params.id, req.body || {}));
});

// ── ADMIN: DELETE /api/admin/usuarios/:id ─────────────────────────────────────
app.delete('/api/admin/usuarios/:id', requireAuth('superadmin'), (req, res) => {
  if (!auth.deleteUsuario(req.params.id)) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ success: true });
});

// ── NORMALIZACIÓN: Tuya → Frontend ───────────────────────────────────────────
function statusToState(type, statuses) {
  if (!statuses) return null; // dispositivo offline
  const get = code => statuses.find(s => s.code === code)?.value;

  switch (type) {
    case 'light':
      return {
        on:        get('switch_led')      ?? false,
        intensity: Math.round((get('bright_value_v2') ?? 500) / 10),  // 0-1000 → 0-100
        colorTemp: Math.round((get('temp_value_v2')   ?? 500) / 10),  // 0-1000 → 0-100
      };
    case 'light_rgb': {
      let cd = get('colour_data_v2') || { h: 0, s: 1000, v: 1000 };
      if (typeof cd === 'string') {
        try { cd = JSON.parse(cd); } catch { cd = { h: 0, s: 1000, v: 1000 }; }
      }
      return {
        on:        get('switch_led')      ?? false,
        intensity: Math.round((get('bright_value_v2') ?? 500) / 10),
        mode:      get('work_mode')       ?? 'white',
        colorTemp: Math.round((get('temp_value_v2')   ?? 500) / 10),
        hue:       cd.h ?? 0,
        saturation:cd.s ?? 1000,
      };
    }
    case 'curtain':
      return {
        control:  get('control')          ?? 'stop',
        position: get('percent_control')  ?? 0,
      };
    case 'switch':
      return { on: get('switch_1') ?? false };
    case 'switch_3ch':
      return {
        ch1: get('switch_1') ?? false,
        ch2: get('switch_2') ?? false,
        ch3: get('switch_3') ?? false,
      };
    case 'ac':
      return {
        on:   get('switch')   ?? false,
        temp: get('temp_set') ?? 22,
        mode: get('mode')     ?? 'cold',
      };
    case 'door_sensor':
      return { open: get('doorcontact_state') ?? false };
    default:
      return Object.fromEntries(statuses.map(s => [s.code, s.value]));
  }
}

// ── NORMALIZACIÓN: Frontend → Tuya ───────────────────────────────────────────
function commandToTuya(type, command) {
  const cmds = [];
  switch (type) {
    case 'light':
      if ('on'        in command) cmds.push({ code: 'switch_led',      value: command.on });
      if ('intensity' in command) cmds.push({ code: 'bright_value_v2', value: Math.min(1000, Math.max(10, Math.round(command.intensity * 10))) });
      if ('colorTemp' in command) cmds.push({ code: 'temp_value_v2',   value: Math.min(1000, Math.max(0,  Math.round(command.colorTemp  * 10))) });
      break;
    case 'light_rgb':
      if ('on'        in command) cmds.push({ code: 'switch_led',      value: command.on });
      if ('intensity' in command) cmds.push({ code: 'bright_value_v2', value: Math.min(1000, Math.max(10, Math.round(command.intensity * 10))) });
      if ('colorTemp' in command) {
        cmds.push({ code: 'work_mode',      value: 'white' });
        cmds.push({ code: 'temp_value_v2',  value: Math.round(command.colorTemp * 10) });
      }
      if ('hue' in command) {
        cmds.push({ code: 'work_mode',     value: 'colour' });
        cmds.push({ code: 'colour_data_v2', value: { h: command.hue ?? 0, s: command.saturation ?? 1000, v: 1000 } });
      }
      break;
    case 'curtain':
      if ('control'  in command) cmds.push({ code: 'control',         value: command.control });
      if ('position' in command) cmds.push({ code: 'percent_control', value: Math.min(100, Math.max(0, command.position)) });
      break;
    case 'switch':
      if ('on' in command) cmds.push({ code: 'switch_1', value: command.on });
      break;
    case 'switch_3ch':
      if ('ch1' in command) cmds.push({ code: 'switch_1', value: command.ch1 });
      if ('ch2' in command) cmds.push({ code: 'switch_2', value: command.ch2 });
      if ('ch3' in command) cmds.push({ code: 'switch_3', value: command.ch3 });
      break;
    case 'ac':
      if ('on'   in command) cmds.push({ code: 'switch',   value: command.on });
      if ('temp' in command) cmds.push({ code: 'temp_set', value: Math.min(30, Math.max(16, command.temp)) });
      if ('mode' in command) cmds.push({ code: 'mode',     value: command.mode });
      break;
  }
  return cmds;
}

// ── COMANDOS DE ESCENA (acciones masivas desde el panel) ─────────────────────
function sceneCommandForDevice(type, scene) {
  if (scene === 'off') {
    switch (type) {
      case 'light':
      case 'light_rgb':
      case 'switch':  return { on: false };
      case 'switch_3ch': return { ch1: false, ch2: false, ch3: false };
      default: return null; // cortinas y sensores no aplican
    }
  }
  return null;
}

// ── RUTA: web app del huésped ─────────────────────────────────────────────────
// Sirve index.html para /room/:token — el JS lee el token de la URL
app.get('/room/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── API: GET /api/room/:token ─────────────────────────────────────────────────
app.get('/api/room/:token', async (req, res) => {
  const result = rooms.getRoomByToken(req.params.token);
  if (!result) {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'TOKEN_INVALID' });
  }
  const { room, entry } = result;

  // Obtiene estado de todos los dispositivos en paralelo
  const deviceKeys    = Object.entries(room.devices);
  const statusResults = await Promise.allSettled(
    deviceKeys.map(([, dev]) => tuya.getDeviceStatus(dev.deviceId))
  );

  const devices = {};
  deviceKeys.forEach(([name, dev], i) => {
    const raw    = statusResults[i].status === 'fulfilled' ? statusResults[i].value : null;
    const online = raw !== null && raw.online;
    devices[name] = {
      label:        dev.label,
      type:         dev.type,
      channels:     dev.channels || null,
      available:    online,
      manualUnlock: dev.manualUnlock === true,
      state:        online ? statusToState(dev.type, raw.status) : null,
    };
  });

  res.json({
    roomId:    entry.roomId,
    roomName:  room.name,
    hotelName: room.hotel || process.env.HOTEL_NAME || 'Nexo IoT',
    guestName: entry.guestName,
    checkin:   entry.checkin,
    checkout:  entry.checkout,
    lang:          entry.lang || 'es',
    accessibility: entry.accessibility || 'none',
    dnd:       entry.dnd || false,
    demoMode:  room.demo === true || tuya.isDemoMode(),
    plan:      room.plan || 'base',
    devices,
    scenes:    entry.scenes || {},
  });
});

// ── API: POST /api/room/:token/scenes ─────────────────────────────────────────
// El huésped guarda el estado actual como escena (nueva o sobrescribiendo una existente).
app.post('/api/room/:token/scenes', (req, res) => {
  if (!rooms.getRoomByToken(req.params.token)) {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'TOKEN_INVALID' });
  }
  const result = rooms.saveScene(req.params.token, req.body || {});
  if (!result) return res.status(400).json({ error: 'Datos de escena no válidos' });
  res.json({ success: true, id: result.id });
});

// ── API: DELETE /api/room/:token/scenes/:id ───────────────────────────────────
// Elimina una escena personalizada o restaura una escena por defecto.
app.delete('/api/room/:token/scenes/:id', (req, res) => {
  if (!rooms.getRoomByToken(req.params.token)) {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'TOKEN_INVALID' });
  }
  const ok = rooms.deleteScene(req.params.token, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Escena no encontrada' });
  res.json({ success: true });
});

// ── API: POST /api/room/:token/prefs ─────────────────────────────────────────
// El huésped cambia su idioma o modo de accesibilidad desde la app.
app.post('/api/room/:token/prefs', (req, res) => {
  if (!rooms.getRoomByToken(req.params.token)) {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'TOKEN_INVALID' });
  }
  rooms.updateTokenPrefs(req.params.token, req.body || {});
  res.json({ success: true });
});

// ── API: POST /api/room/:token/request ────────────────────────────────────────
// El huésped pide toallas/amenities o room service desde la app.
app.post('/api/room/:token/request', (req, res) => {
  const { type, note } = req.body || {};
  const request = rooms.createRequest(req.params.token, type, note);
  if (!request) {
    if (!rooms.getRoomByToken(req.params.token)) {
      return res.status(401).json({ error: 'Token inválido o expirado', code: 'TOKEN_INVALID' });
    }
    return res.status(400).json({ error: 'Tipo de solicitud no válido' });
  }
  res.json({ success: true, request });
});

// ── API: POST /api/room/:token/command ────────────────────────────────────────
app.post('/api/room/:token/command', async (req, res) => {
  const result = rooms.getRoomByToken(req.params.token);
  if (!result) {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'TOKEN_INVALID' });
  }

  const { device, command } = req.body;
  if (!device || !command) {
    return res.status(400).json({ error: 'Faltan campos: device, command' });
  }

  const { room } = result;
  const devConfig = room.devices[device];
  if (!devConfig) {
    return res.status(404).json({ error: `Dispositivo "${device}" no existe en esta habitación` });
  }

  const tuyaCmds = commandToTuya(devConfig.type, command);
  if (tuyaCmds.length === 0) {
    return res.status(400).json({ error: 'Comando no reconocido para este tipo de dispositivo' });
  }

  try {
    await tuya.sendCommand(devConfig.deviceId, tuyaCmds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al ejecutar el comando', detail: err.message });
  }
});

// ── API: GET /api/tv/:roomId ──────────────────────────────────────────────────
// Usado por la pantalla de TV de la habitación: link de acceso del huésped activo.
app.get('/api/tv/:roomId', (req, res) => {
  const allRooms = rooms.getRooms();
  const room = allRooms[req.params.roomId];
  if (!room) {
    return res.status(404).json({ error: 'Habitación no encontrada' });
  }

  const token = rooms.getActiveTokenForRoom(req.params.roomId);

  res.json({
    roomId:    req.params.roomId,
    roomName:  room.name,
    hotelName: room.hotel || process.env.HOTEL_NAME || 'Nexo IoT',
    active:    !!token,
    url:       token ? `${FRONTEND_URL}/?token=${token}` : null,
  });
});

// ── ADMIN: POST /api/admin/token ──────────────────────────────────────────────
app.post('/api/admin/token', requireAuth('owner', 'recepcion'), (req, res) => {
  const { roomId, guestName, checkin, checkout, phone, lang, accessibility } = req.body;
  if (!roomId || !guestName || !checkin || !checkout) {
    return res.status(400).json({ error: 'Requeridos: roomId, guestName, checkin, checkout' });
  }
  const targetRoom = rooms.getRooms()[roomId];
  if (!targetRoom) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, targetRoom.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  try {
    const token = rooms.generateToken(roomId, guestName, checkin, checkout, phone, lang, accessibility);
    res.json({
      token,
      url:       `${HOTEL_URL}/room/${token}`,
      guestUrl:  `${FRONTEND_URL}/?token=${token}`,
      roomId,
      guestName,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── ADMIN: POST /api/admin/token/:token/prefs ─────────────────────────────────
// Recepción cambia el idioma o la accesibilidad de una estadía activa.
app.post('/api/admin/token/:token/prefs', requireAuth('owner', 'recepcion'), (req, res) => {
  const found = rooms.getRoomByToken(req.params.token);
  if (!found) return res.status(404).json({ error: 'Token no encontrado o inactivo' });
  if (!assertHotelAccess(req, found.room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const ok = rooms.updateTokenPrefs(req.params.token, req.body || {});
  if (!ok) return res.status(404).json({ error: 'Token no encontrado o inactivo' });
  res.json({ success: true });
});

// ── ADMIN: DELETE /api/admin/token/:token ─────────────────────────────────────
app.delete('/api/admin/token/:token', requireAuth('owner', 'recepcion'), (req, res) => {
  const found = rooms.getRoomByToken(req.params.token);
  if (!found) return res.status(404).json({ error: 'Token no encontrado' });
  if (!assertHotelAccess(req, found.room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const ok = rooms.expireToken(req.params.token);
  if (!ok) return res.status(404).json({ error: 'Token no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/tokens ──────────────────────────────────────────────
app.get('/api/admin/tokens', requireAuth('superadmin'), (req, res) => {
  res.json(rooms.listActiveTokens());
});

// ── ADMIN: GET /api/admin/rooms ───────────────────────────────────────────────
// Acepta ?hotel=<hotelId> para filtrar las habitaciones de un hotel específico.
// Para owner/recepcion, siempre se fuerza el filtro a su propio hotel (no se confía en el query param).
app.get('/api/admin/rooms', requireAuth('superadmin', 'owner', 'recepcion'), (req, res) => {
  const hotelFiltro = req.user.rol === 'superadmin' ? (req.query.hotel || null) : req.user.hotelId;
  if (req.query.hotel && !assertHotelAccess(req, req.query.hotel)) {
    return res.status(403).json({ error: 'Sin acceso a este hotel' });
  }
  const r = rooms.getRooms();
  const activeTokens = rooms.listActiveTokens();
  res.json(
    Object.keys(r)
      .filter(id => r[id].demo !== true)
      .filter(id => !hotelFiltro || r[id].hotelId === hotelFiltro)
      .map(id => {
        const guest = activeTokens.find(t => t.roomId === id) || null;
        return {
          id,
          name:        r[id].name,
          hotel:       r[id].hotel || null,
          hotelId:     r[id].hotelId || null,
          floor:       r[id].floor,
          plan:        r[id].plan || 'base',
          categoriaId: r[id].categoriaId || null,
          guest,
        };
      })
  );
});

// ── ADMIN: POST /api/admin/rooms/:roomId/scene ────────────────────────────────
// Aplica una escena a todos los dispositivos controlables de una habitación.
// Por ahora solo soporta scene: 'off' (apagar luces y enchufes), usada para
// acciones masivas como "apagar todo" en habitaciones que hacen checkout hoy.
app.post('/api/admin/rooms/:roomId/scene', requireAuth('owner', 'recepcion'), async (req, res) => {
  const { scene } = req.body;
  if (scene !== 'off') {
    return res.status(400).json({ error: 'Escena no reconocida' });
  }

  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });

  const results = await Promise.allSettled(
    Object.values(room.devices).map(dev => {
      const command = sceneCommandForDevice(dev.type, scene);
      if (!command) return Promise.resolve();
      const tuyaCmds = commandToTuya(dev.type, command);
      if (!tuyaCmds.length) return Promise.resolve();
      return tuya.sendCommand(dev.deviceId, tuyaCmds);
    })
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  rooms.addActivity(req.params.roomId, 'scene_off', '');
  res.json({ success: true, failed });
});

// ── ADMIN: POST /api/admin/rooms/:roomId/devices/:deviceKey/manual-unlock ─────
// El hotel habilita o deshabilita que el huésped pueda liberar manualmente el
// motor de una cortina (control físico) desde la app.
app.post('/api/admin/rooms/:roomId/devices/:deviceKey/manual-unlock', requireAuth('owner'), (req, res) => {
  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const { allowed } = req.body || {};
  const ok = rooms.setManualUnlock(req.params.roomId, req.params.deviceKey, allowed);
  if (!ok) return res.status(404).json({ error: 'Habitación o dispositivo no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/rooms/:roomId/activity ──────────────────────────────
// Historial de actividad de una habitación (check-in/out, cambios de preferencias,
// solicitudes de servicio, escenas aplicadas), usado en el modal de detalle del panel.
app.get('/api/admin/rooms/:roomId/activity', requireAuth('owner', 'recepcion'), (req, res) => {
  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(rooms.listActivity(req.params.roomId));
});

// ── ADMIN: GET /api/admin/hotels ──────────────────────────────────────────────
app.get('/api/admin/hotels', requireAuth('superadmin'), (req, res) => {
  const hotels = rooms.getHotels();
  const r = rooms.getRooms();
  const activeTokens = rooms.listActiveTokens();
  const pendingRequests = rooms.listRequests({ status: 'pending' });

  res.json(
    Object.keys(hotels).map(id => {
      const hotelRooms = Object.keys(r).filter(roomId => r[roomId].demo !== true && r[roomId].hotelId === id);
      const occupied = hotelRooms.filter(roomId => activeTokens.some(t => t.roomId === roomId)).length;
      const plans = [...new Set(hotelRooms.map(roomId => r[roomId].plan || 'base'))];
      const planCounts = hotelRooms.reduce((acc, roomId) => {
        const plan = r[roomId].plan || 'base';
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      }, {});
      return {
        id,
        name:     hotels[id].name,
        location: hotels[id].location || null,
        rooms:    hotelRooms.length,
        occupied,
        plans,
        planCounts,
        pendingRequests: pendingRequests.filter(req => req.hotelId === id).length,
      };
    })
  );
});

// ── ADMIN: GET /api/admin/requests ────────────────────────────────────────────
// Acepta ?hotel=<hotelId> y ?status=pending|done para filtrar.
// Para owner/recepcion, siempre se fuerza el filtro a su propio hotel.
app.get('/api/admin/requests', requireAuth('superadmin', 'owner', 'recepcion'), (req, res) => {
  const hotelFiltro = req.user.rol === 'superadmin' ? (req.query.hotel || null) : req.user.hotelId;
  if (req.query.hotel && !assertHotelAccess(req, req.query.hotel)) {
    return res.status(403).json({ error: 'Sin acceso a este hotel' });
  }
  res.json(rooms.listRequests({ hotelId: hotelFiltro, status: req.query.status }));
});

// ── ADMIN: POST /api/admin/requests/:id/resolve ───────────────────────────────
app.post('/api/admin/requests/:id/resolve', requireAuth('owner', 'recepcion'), (req, res) => {
  const request = rooms.listRequests().find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (!assertHotelAccess(req, request.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const ok = rooms.resolveRequest(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/reservas ────────────────────────────────────────────
// ?hotel=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/admin/reservas', requireAuth('owner', 'recepcion'), (req, res) => {
  const { hotel, from, to } = req.query;
  if (!hotel || !from || !to) {
    return res.status(400).json({ error: 'Requeridos: hotel, from, to' });
  }
  if (!assertHotelAccess(req, hotel)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(reservas.getByHotel(hotel, from, to));
});

// ── ADMIN: POST /api/admin/reservas ──────────────────────────────────────────
app.post('/api/admin/reservas', requireAuth('owner', 'recepcion'), (req, res) => {
  const { hotelId, roomId, guestName, checkin, checkout, guestEmail, guestPhone, notes, plan, source } = req.body;
  if (!hotelId || !roomId || !guestName || !checkin || !checkout) {
    return res.status(400).json({ error: 'Requeridos: hotelId, roomId, guestName, checkin, checkout' });
  }
  if (!assertHotelAccess(req, hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  if (checkin >= checkout) {
    return res.status(400).json({ error: 'checkin debe ser anterior a checkout' });
  }
  if (!reservas.checkDisponibilidad(roomId, checkin, checkout)) {
    return res.status(409).json({ error: 'Habitación no disponible en esas fechas', code: 'ROOM_UNAVAILABLE' });
  }
  const r = reservas.createReserva(hotelId, roomId, guestName, checkin, checkout,
    { guestEmail, guestPhone, notes, plan, source });
  invalidarCacheDisponibilidad(hotelId);
  cm.pushDisponibilidad(hotelId, roomId, checkin, checkout).catch(err =>
    console.error('[cm] Push fallido tras crear reserva:', err.message)
  );
  res.status(201).json(r);
});

// ── ADMIN: PATCH /api/admin/reservas/:id ─────────────────────────────────────
app.patch('/api/admin/reservas/:id', requireAuth('owner', 'recepcion'), (req, res) => {
  const existing = reservas.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!assertHotelAccess(req, existing.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });

  const { checkin, checkout, room_id, status } = req.body;

  // Si cambia fechas o habitación, verificar disponibilidad
  const newCheckin  = checkin   || existing.checkin;
  const newCheckout = checkout  || existing.checkout;
  const newRoomId   = room_id   || existing.room_id;

  if (checkin || checkout || room_id) {
    if (!reservas.checkDisponibilidad(newRoomId, newCheckin, newCheckout, req.params.id)) {
      return res.status(409).json({ error: 'Conflicto de disponibilidad', code: 'ROOM_UNAVAILABLE' });
    }
  }

  const updated = reservas.updateReserva(req.params.id, req.body);
  invalidarCacheDisponibilidad(existing.hotel_id);
  res.json(updated);
});

// ── ADMIN: DELETE /api/admin/reservas/:id ─────────────────────────────────────
app.delete('/api/admin/reservas/:id', requireAuth('owner', 'recepcion'), (req, res) => {
  const existing = reservas.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!assertHotelAccess(req, existing.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  reservas.cancelReserva(req.params.id);
  invalidarCacheDisponibilidad(existing.hotel_id);
  cm.pushDisponibilidad(existing.hotel_id, existing.room_id, existing.checkin, existing.checkout)
    .catch(err => console.error('[cm] Push fallido tras cancelar reserva:', err.message));
  res.json({ success: true });
});

// ── ADMIN: POST /api/admin/reservas/:id/pago/webpay ───────────────────────────
// Inicia un pago Webpay para una reserva desde el dashboard de recepción.
app.post('/api/admin/reservas/:id/pago/webpay', requireAuth('owner', 'recepcion'), async (req, res) => {
  const reserva = reservas.getById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!assertHotelAccess(req, reserva.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const { montoCLP } = req.body;
  if (!montoCLP || montoCLP < 1) return res.status(400).json({ error: 'Monto inválido' });

  const returnUrl = `${HOTEL_URL}/api/pagos/webpay-return`;
  try {
    const { token, url, buyOrder, sessionId } = await pagos.iniciarWebpay(montoCLP, returnUrl);
    transacciones.createTransaccion({
      reservaId: reserva.id, hotelId: reserva.hotel_id, tipo: 'webpay',
      montoCLP, tokenWs: token, buyOrder, sessionId, guestName: reserva.guest_name,
    });
    res.json({ url, token });
  } catch (err) {
    res.status(500).json({ error: 'Error iniciando pago Webpay', detail: err.message });
  }
});

// ── PAGOS: GET/POST /api/pagos/webpay-return ──────────────────────────────────
// Transbank redirige aquí después del pago. En producción lo hace vía POST
// (form submit con token_ws en el body); se acepta también GET por compatibilidad.
// No requiere autenticación — es el return URL público de Webpay.
app.all('/api/pagos/webpay-return', express.urlencoded({ extended: true }), async (req, res) => {
  const p = { ...req.query, ...req.body };
  const { token_ws, TBK_TOKEN, TBK_ORDEN_COMPRA } = p;

  if (TBK_TOKEN && !token_ws) {
    const trans = transacciones.getByBuyOrder(TBK_ORDEN_COMPRA);
    if (trans) transacciones.updateEstado(trans.id, 'rechazado', { motivo: 'cancelado_por_usuario' });
    return res.redirect(`/dashboard.html?hotel=${trans?.hotel_id || ''}&pago=cancelado&reserva=${trans?.reserva_id || ''}`);
  }
  if (!token_ws) return res.redirect('/dashboard.html?pago=error');

  try {
    const response = await pagos.confirmarWebpay(token_ws);
    const trans = transacciones.getByTokenWs(token_ws);
    if (!trans) return res.redirect('/dashboard.html?pago=error');

    const aprobado = response.response_code === 0;
    transacciones.updateEstado(trans.id, aprobado ? 'aprobado' : 'rechazado', response);
    res.redirect(`/dashboard.html?hotel=${trans.hotel_id}&pago=${aprobado ? 'aprobado' : 'rechazado'}&reserva=${trans.reserva_id || ''}`);
  } catch (err) {
    console.error('[webpay] Error en return:', err.message);
    res.redirect('/dashboard.html?pago=error');
  }
});

// ── ADMIN: POST /api/admin/reservas/:id/pago/link-mp ─────────────────────────
// Genera un link de Mercado Pago para enviar al huésped por WhatsApp.
app.post('/api/admin/reservas/:id/pago/link-mp', requireAuth('owner', 'recepcion'), async (req, res) => {
  const reserva = reservas.getById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!assertHotelAccess(req, reserva.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const { montoCLP, descripcion } = req.body;
  if (!montoCLP || montoCLP < 1) return res.status(400).json({ error: 'Monto inválido' });

  try {
    const { linkPago, preferenceId } = await pagos.crearLinkMP(
      montoCLP, descripcion || `Alojamiento — ${reserva.guest_name}`, reserva.guest_email, reserva.id
    );
    transacciones.createTransaccion({
      reservaId: reserva.id, hotelId: reserva.hotel_id, tipo: 'mercadopago',
      montoCLP, mpPreferenceId: preferenceId, guestName: reserva.guest_name,
    });
    res.json({ linkPago });
  } catch (err) {
    res.status(500).json({ error: 'Error generando link de pago', detail: err.message });
  }
});

// ── ADMIN: POST /api/admin/reservas/:id/pago/manual ───────────────────────────
// Registrar pago en efectivo o transferencia bancaria (ya recibido).
app.post('/api/admin/reservas/:id/pago/manual', requireAuth('owner', 'recepcion'), (req, res) => {
  const reserva = reservas.getById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!assertHotelAccess(req, reserva.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const { montoCLP, tipo, referencia } = req.body;
  if (!montoCLP || montoCLP < 1) return res.status(400).json({ error: 'Monto inválido' });
  if (!['efectivo', 'transferencia'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser "efectivo" o "transferencia"' });
  }
  const t = transacciones.createTransaccion({
    reservaId: reserva.id, hotelId: reserva.hotel_id, tipo, montoCLP,
    estado: 'aprobado', detalle: { referencia }, guestName: reserva.guest_name,
  });
  res.status(201).json(t);
});

// ── WEBHOOK: POST /api/webhook/mercadopago ────────────────────────────────────
// Mercado Pago notifica el resultado del pago. ACK inmediato, proceso async.
app.post('/api/webhook/mercadopago', (req, res) => {
  res.json({ received: true });
  const { type, data } = req.body || {};
  if (type !== 'payment' || !data?.id) return;

  (async () => {
    try {
      const payment  = await pagos.consultarPagoMP(data.id);
      const reservaId = payment.external_reference;
      if (!reservaId) return;
      const estado = payment.status === 'approved' ? 'aprobado' : payment.status === 'rejected' ? 'rechazado' : 'pendiente';
      const trans = transacciones.getByReserva(reservaId).find(t => t.tipo === 'mercadopago' && t.estado === 'pendiente');
      if (trans) transacciones.marcarPagoMP(trans.id, String(data.id), estado, payment);
    } catch (err) {
      console.error('[mp webhook] Error procesando pago:', err.message);
    }
  })();
});

// ── ADMIN: GET /api/admin/reservas/:id/transacciones ──────────────────────────
app.get('/api/admin/reservas/:id/transacciones', requireAuth('owner', 'recepcion'), (req, res) => {
  const reserva = reservas.getById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!assertHotelAccess(req, reserva.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(transacciones.getByReserva(req.params.id));
});

// ── ADMIN: GET /api/admin/transacciones ───────────────────────────────────────
// ?hotel=<id>&desde=YYYY-MM-DD&hasta=YYYY-MM-DD — reporte hotel-wide, solo owner/superadmin
app.get('/api/admin/transacciones', requireAuth('owner'), (req, res) => {
  const { hotel, desde, hasta } = req.query;
  if (!hotel) return res.status(400).json({ error: 'hotel requerido' });
  if (!assertHotelAccess(req, hotel)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(transacciones.getByHotel(hotel, desde, hasta));
});

// ── BOOKING ENGINE: GET /reservar/:slug ──────────────────────────────────────
app.get('/reservar/:slug', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/booking-engine.html'));
});

// ── BOOKING ENGINE: GET /widget.js ────────────────────────────────────────────
app.get('/widget.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(`(function(){
    var el=document.getElementById('smartrooms-widget');
    if(!el)return;
    var slug=el.dataset.hotel;
    var cfg=window.SMARTROOMS_CONFIG||{};
    var iframe=document.createElement('iframe');
    iframe.src='${HOTEL_URL}/reservar/'+slug;
    iframe.style.cssText='border:none;width:100%;min-height:620px;border-radius:12px';
    iframe.setAttribute('loading','lazy');
    el.appendChild(iframe);
  })();`);
});

// ── PUBLIC: GET /api/public/uf ────────────────────────────────────────────────
app.get('/api/public/uf', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ valor: valorUF, fecha: new Date().toISOString().slice(0, 10) });
});

// ── PUBLIC: GET /api/public/hotels/:slug/disponibilidad ───────────────────────
app.get('/api/public/hotels/:slug/disponibilidad', publicLimiter, async (req, res) => {
  const { slug }            = req.params;
  const { checkin, checkout } = req.query;

  // Validar fechas
  if (!checkin || !checkout)
    return res.status(400).json({ error: 'Se requieren checkin y checkout', code: 'MISSING_DATES' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout))
    return res.status(400).json({ error: 'Formato de fecha inválido. Usar YYYY-MM-DD', code: 'INVALID_FORMAT' });
  const hoy = new Date().toISOString().slice(0, 10);
  if (checkin < hoy)
    return res.status(400).json({ error: 'No se puede consultar disponibilidad para fechas pasadas', code: 'PAST_DATES' });
  if (checkin >= checkout)
    return res.status(400).json({ error: 'El checkin debe ser anterior al checkout', code: 'INVALID_DATES' });
  const noches = (new Date(checkout) - new Date(checkin)) / 86400000;
  if (noches > 365)
    return res.status(400).json({ error: 'El rango máximo de consulta es 365 noches', code: 'RANGE_TOO_LARGE' });

  // Cache
  const cacheKey = `disp:${slug}:${checkin}:${checkout}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(cached);
  }

  // Buscar hotel por slug (el ID del hotel ES el slug en hotels.json)
  const hotelsMap = rooms.getHotels();
  const hotelData = hotelsMap[slug];
  if (!hotelData)
    return res.status(404).json({ error: 'Hotel no encontrado o reservas no disponibles en este canal', code: 'HOTEL_NOT_FOUND' });

  // Habitaciones del hotel (excluir demo; respetar rooms_visibles del booking config)
  const bkConfig   = bookingConfig.getConfig(slug);
  const allRooms   = rooms.getRooms();
  let hotelRooms   = Object.entries(allRooms)
    .filter(([, r]) => r.hotelId === slug && r.demo !== true)
    .map(([id, r]) => ({ id, nombre: r.name, plan: r.plan || 'base', categoriaId: r.categoriaId || null }));

  if (bkConfig.rooms_visibles?.length) {
    hotelRooms = hotelRooms.filter(r => bkConfig.rooms_visibles.includes(r.id));
  }

  // Reservas, bloqueos y tarifas que se solapan con el rango
  const reservasActivas = reservas.getByHotel(slug, checkin, checkout)
    .filter(r => !['cancelled', 'checked_out'].includes(r.status));
  const bloqueosList = bloqueos.getBloqueosByHotelEnRango(slug, checkin, checkout);
  const tarifasMap   = tarifas.getTarifasVigentes(slug, checkin, checkout);

  const roomsResult = hotelRooms.map(room => {
    const estaOcupada   = reservasActivas.some(r => r.room_id === room.id);
    const estaBloqueada = bloqueosList.some(b => b.room_id === room.id);

    if (estaOcupada || estaBloqueada) {
      return {
        id: room.id, nombre: room.nombre, plan: room.plan,
        disponible: false, motivoBloqueo: estaOcupada ? 'ocupada' : 'bloqueada',
      };
    }

    const tarifa    = tarifasMap.get(room.id)
      || (room.categoriaId ? tarifasMap.get(`cat:${room.categoriaId}`) : null)
      || tarifasMap.get('__gen__')
      || null;
    const minNoches = tarifa?.min_noches || 1;
    if (noches < minNoches) {
      return { id: room.id, nombre: room.nombre, plan: room.plan, disponible: false, motivoBloqueo: `minimo_${minNoches}_noches` };
    }

    const precioUF = tarifa?.precio_uf || null;
    return {
      id:    room.id,
      nombre: room.nombre,
      plan:  room.plan,
      disponible: true,
      precioPorNoche: precioUF ? { uf: precioUF, clp_referencial: Math.round(precioUF * valorUF) } : null,
      precioTotal:    precioUF ? { uf: +(precioUF * noches).toFixed(2), clp_referencial: Math.round(precioUF * noches * valorUF) } : null,
      minNoches,
    };
  });

  const responseData = {
    hotel:    { nombre: hotelData.name, slug, location: hotelData.location || null },
    checkin, checkout, noches,
    uf:       { valor: valorUF, fecha: new Date().toISOString().slice(0, 10) },
    rooms:    roomsResult,
  };

  setCached(cacheKey, responseData);
  res.set('X-Cache', 'MISS');
  res.set('Cache-Control', 'public, max-age=60');
  res.json(responseData);
});

// ── PUBLIC: GET /api/public/hotels/:slug/config ───────────────────────────────
app.get('/api/public/hotels/:slug/config', (req, res) => {
  const hotelData = rooms.getHotels()[req.params.slug];
  if (!hotelData) return res.status(404).json({ error: 'Hotel no encontrado', code: 'HOTEL_NOT_FOUND' });
  const cfg = bookingConfig.getConfig(req.params.slug);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    nombre:          hotelData.name,
    location:        hotelData.location || null,
    titulo:          cfg.titulo || `Reserva directa — ${hotelData.name}`,
    colorPrimario:   cfg.color_primario,
    colorSecundario: cfg.color_secundario,
    logoUrl:         cfg.logo_url,
    politicaCancel:  cfg.politica_cancel,
    idiomas:         cfg.idiomas,
    activo:          cfg.activo,
  });
});

// ── PUBLIC: POST /api/public/hotels/:slug/reservas ────────────────────────────
app.post('/api/public/hotels/:slug/reservas', publicLimiter, async (req, res) => {
  const { slug } = req.params;
  const hotelData = rooms.getHotels()[slug];
  if (!hotelData) return res.status(404).json({ error: 'Hotel no encontrado', code: 'HOTEL_NOT_FOUND' });
  if (!bookingConfig.isActivo(slug)) {
    return res.status(403).json({ error: 'Reservas online no disponibles para este hotel', code: 'BOOKING_INACTIVE' });
  }

  const { roomId, guestName, guestEmail, guestPhone, checkin, checkout } = req.body;
  if (!roomId || !guestName || !guestEmail || !checkin || !checkout) {
    return res.status(400).json({ error: 'Faltan campos requeridos: roomId, guestName, guestEmail, checkin, checkout' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (checkin >= checkout) {
    return res.status(400).json({ error: 'checkin debe ser anterior a checkout' });
  }
  const hoy = new Date().toISOString().slice(0, 10);
  if (checkin < hoy) {
    return res.status(400).json({ error: 'No se puede reservar en fechas pasadas' });
  }

  if (!reservas.checkDisponibilidad(roomId, checkin, checkout)) {
    return res.status(409).json({ error: 'Habitación no disponible en esas fechas', code: 'UNAVAILABLE' });
  }

  const nueva = reservas.createReserva(slug, roomId, guestName, checkin, checkout, {
    guestEmail, guestPhone: guestPhone || null, source: 'direct',
  });

  invalidarCacheDisponibilidad(slug);
  cm.pushDisponibilidad(slug, roomId, checkin, checkout)
    .catch(err => console.error('[cm] Push fallido tras reserva directa:', err.message));
  // COMPLETAR: enviar email de confirmación al huésped (Resend o SendGrid)

  res.status(201).json({
    id:       nueva.id,
    estado:   nueva.status,
    checkin:  nueva.checkin,
    checkout: nueva.checkout,
    mensaje:  'Reserva confirmada.',
  });
});

// ── ADMIN: GET /api/admin/tarifas ─────────────────────────────────────────────
app.get('/api/admin/tarifas', requireAuth('owner'), (req, res) => {
  const { hotel } = req.query;
  if (!hotel) return res.status(400).json({ error: 'hotel requerido' });
  if (!assertHotelAccess(req, hotel)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(tarifas.getByHotel(hotel));
});

// ── ADMIN: POST /api/admin/tarifas ────────────────────────────────────────────
// roomId y categoriaId son mutuamente excluyentes; si no se envía ninguno, la tarifa es general.
app.post('/api/admin/tarifas', requireAuth('owner'), (req, res) => {
  const { hotelId, roomId, categoriaId, nombre, precioUF, desde, hasta, minNoches } = req.body;
  if (!hotelId || !nombre || !precioUF || !desde || !hasta) {
    return res.status(400).json({ error: 'Requeridos: hotelId, nombre, precioUF, desde, hasta' });
  }
  if (!assertHotelAccess(req, hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  if (desde >= hasta) return res.status(400).json({ error: 'desde debe ser anterior a hasta' });
  if (precioUF <= 0) return res.status(400).json({ error: 'precioUF debe ser mayor a 0' });
  const t = tarifas.createTarifa(hotelId, roomId || null, categoriaId || null, nombre, precioUF, desde, hasta, minNoches || 1);
  res.status(201).json(t);
});

// ── ADMIN: PATCH /api/admin/tarifas/:id ───────────────────────────────────────
app.patch('/api/admin/tarifas/:id', requireAuth('owner'), (req, res) => {
  const tarifa = tarifas.getById(req.params.id);
  if (!tarifa) return res.status(404).json({ error: 'Tarifa no encontrada' });
  if (!assertHotelAccess(req, tarifa.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(tarifas.updateTarifa(req.params.id, req.body));
});

// ── ADMIN: DELETE /api/admin/tarifas/:id ──────────────────────────────────────
app.delete('/api/admin/tarifas/:id', requireAuth('owner'), (req, res) => {
  const tarifa = tarifas.getById(req.params.id);
  if (!tarifa) return res.status(404).json({ error: 'Tarifa no encontrada' });
  if (!assertHotelAccess(req, tarifa.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  if (!tarifas.deleteTarifa(req.params.id)) return res.status(404).json({ error: 'Tarifa no encontrada' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/categorias ──────────────────────────────────────────
// ?hotel=<id> — owner/recepcion pueden ver (recepcion las necesita para mostrar
// la categoría asignada en Habitaciones), pero solo owner puede crear/editar/borrar.
app.get('/api/admin/categorias', requireAuth('owner', 'recepcion'), (req, res) => {
  const { hotel } = req.query;
  if (!hotel) return res.status(400).json({ error: 'hotel requerido' });
  if (!assertHotelAccess(req, hotel)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(categorias.getByHotel(hotel));
});

// ── ADMIN: POST /api/admin/categorias ─────────────────────────────────────────
app.post('/api/admin/categorias', requireAuth('owner'), (req, res) => {
  const { hotelId, nombre, camas } = req.body;
  if (!hotelId || !nombre || !camas) {
    return res.status(400).json({ error: 'Requeridos: hotelId, nombre, camas' });
  }
  if (!assertHotelAccess(req, hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  if (camas <= 0) return res.status(400).json({ error: 'camas debe ser mayor a 0' });
  const c = categorias.createCategoria(hotelId, nombre, camas);
  res.status(201).json(c);
});

// ── ADMIN: PATCH /api/admin/categorias/:id ────────────────────────────────────
app.patch('/api/admin/categorias/:id', requireAuth('owner'), (req, res) => {
  const cat = categorias.getById(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
  if (!assertHotelAccess(req, cat.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(categorias.updateCategoria(req.params.id, req.body));
});

// ── ADMIN: DELETE /api/admin/categorias/:id ───────────────────────────────────
app.delete('/api/admin/categorias/:id', requireAuth('owner'), (req, res) => {
  const cat = categorias.getById(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
  if (!assertHotelAccess(req, cat.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  if (!categorias.deleteCategoria(req.params.id)) return res.status(404).json({ error: 'Categoría no encontrada' });
  res.json({ success: true });
});

// ── ADMIN: PATCH /api/admin/rooms/:roomId/categoria ───────────────────────────
// Body: { categoriaId } — categoriaId null/vacío quita la categoría de la habitación.
app.patch('/api/admin/rooms/:roomId/categoria', requireAuth('owner'), (req, res) => {
  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });

  const { categoriaId } = req.body || {};
  if (categoriaId) {
    const cat = categorias.getById(categoriaId);
    if (!cat || cat.hotel_id !== room.hotelId) {
      return res.status(400).json({ error: 'Categoría inválida para este hotel' });
    }
  }
  rooms.setRoomCategoria(req.params.roomId, categoriaId || null);
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/booking-config/:hotelId ─────────────────────────────
app.get('/api/admin/booking-config/:hotelId', requireAuth('owner'), (req, res) => {
  if (!assertHotelAccess(req, req.params.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(bookingConfig.getConfig(req.params.hotelId));
});

// ── ADMIN: PUT /api/admin/booking-config/:hotelId ─────────────────────────────
app.put('/api/admin/booking-config/:hotelId', requireAuth('owner'), (req, res) => {
  if (!assertHotelAccess(req, req.params.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const cfg = bookingConfig.upsertConfig(req.params.hotelId, req.body);
  res.json(cfg);
});

// ── WEBHOOK: POST /api/webhook/reserva/:canalId ───────────────────────────────
// SiteMinder llama aquí cuando llega una reserva desde Booking.com, Airbnb, etc.
// Se responde 200 inmediatamente (SiteMinder exige ACK < 3 s) y se procesa async.
app.post('/api/webhook/reserva/:canalId', express.json({ type: '*/*' }), (req, res) => {
  const signature = req.headers['x-siteminder-signature'] || req.headers['x-hub-signature-256'] || '';
  if (!cm.verificarFirma(signature, req.body)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }
  res.json({ received: true });
  cm.procesarReservaOTA(req.body, req.params.canalId)
    .catch(err => console.error('[webhook] Error procesando reserva OTA:', err.message));
});

// ── ADMIN: GET /api/admin/canales ─────────────────────────────────────────────
// ?hotel=<hotelId> — lista canales del hotel
app.get('/api/admin/canales', requireAuth('owner'), (req, res) => {
  const { hotel } = req.query;
  if (!hotel) return res.status(400).json({ error: 'hotel requerido' });
  if (!assertHotelAccess(req, hotel)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const lista = canales.getByHotel(hotel).map(c => ({
    ...c,
    syncStatus: canales.getSyncStatus(c.id, 1)[0] || null,
    mappings:   canales.getMappings(c.id).length,
  }));
  res.json(lista);
});

// ── ADMIN: POST /api/admin/canales ────────────────────────────────────────────
// Body: { hotelId, nombre, config: { siteminder_property_id } }
app.post('/api/admin/canales', requireAuth('owner'), (req, res) => {
  const { hotelId, nombre, config } = req.body;
  if (!hotelId || !nombre) return res.status(400).json({ error: 'Requeridos: hotelId, nombre' });
  if (!assertHotelAccess(req, hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const canal = canales.createCanal(hotelId, nombre, config || {});
  res.status(201).json(canal);
});

// ── ADMIN: PATCH /api/admin/canales/:id ───────────────────────────────────────
// Body: { activo: true|false } o { config: {...} }
app.patch('/api/admin/canales/:id', requireAuth('owner'), (req, res) => {
  const canal = canales.getById(req.params.id);
  if (!canal) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(canales.updateCanal(req.params.id, req.body));
});

// ── ADMIN: DELETE /api/admin/canales/:id ──────────────────────────────────────
app.delete('/api/admin/canales/:id', requireAuth('owner'), (req, res) => {
  const canal = canales.getById(req.params.id);
  if (!canal) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const ok = canales.deleteCanal(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Canal no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/canales/:id/sync-status ─────────────────────────────
app.get('/api/admin/canales/:id/sync-status', requireAuth('owner'), (req, res) => {
  const canal = canales.getById(req.params.id);
  if (!canal) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(canales.getSyncStatus(req.params.id, 20));
});

// ── ADMIN: POST /api/admin/canales/:id/sync-now ───────────────────────────────
app.post('/api/admin/canales/:id/sync-now', requireAuth('owner'), async (req, res) => {
  const canal = canales.getById(req.params.id);
  if (!canal) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  try {
    const result = await cm.resyncHotel(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── ADMIN: GET /api/admin/canales/:id/mappings ────────────────────────────────
app.get('/api/admin/canales/:id/mappings', requireAuth('owner'), (req, res) => {
  const canal = canales.getById(req.params.id);
  if (!canal) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(canales.getMappings(req.params.id));
});

// ── ADMIN: POST /api/admin/canales/:id/mappings ───────────────────────────────
// Body: { roomId, otaRoomId, otaRateId? }
app.post('/api/admin/canales/:id/mappings', requireAuth('owner'), (req, res) => {
  const canal = canales.getById(req.params.id);
  if (!canal) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const { roomId, otaRoomId, otaRateId } = req.body;
  if (!roomId || !otaRoomId) return res.status(400).json({ error: 'Requeridos: roomId, otaRoomId' });
  const mapping = canales.addMapping(req.params.id, roomId, otaRoomId, otaRateId);
  res.status(201).json(mapping);
});

// ── ADMIN: DELETE /api/admin/canales/mappings/:mappingId ──────────────────────
app.delete('/api/admin/canales/mappings/:mappingId', requireAuth('owner'), (req, res) => {
  const mapping = canales.getMappingById(req.params.mappingId);
  if (!mapping) return res.status(404).json({ error: 'Mapping no encontrado' });
  const canal = canales.getById(mapping.canal_id);
  if (!canal || !assertHotelAccess(req, canal.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const ok = canales.deleteMapping(req.params.mappingId);
  if (!ok) return res.status(404).json({ error: 'Mapping no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: POST /api/admin/rooms/:roomId/bloqueo ──────────────────────────────
app.post('/api/admin/rooms/:roomId/bloqueo', requireAuth('owner'), (req, res) => {
  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });

  const { desde, hasta, motivo, notas } = req.body;
  if (!desde || !hasta) return res.status(400).json({ error: 'Requeridos: desde, hasta' });
  if (desde >= hasta) return res.status(400).json({ error: 'desde debe ser anterior a hasta' });

  const bloqueo = bloqueos.createBloqueo(room.hotelId, req.params.roomId, desde, hasta, motivo, notas);
  invalidarCacheDisponibilidad(room.hotelId);
  res.status(201).json(bloqueo);
});

// ── ADMIN: DELETE /api/admin/bloqueos/:id ─────────────────────────────────────
app.delete('/api/admin/bloqueos/:id', requireAuth('owner'), (req, res) => {
  const bloqueo = bloqueos.getById(req.params.id);
  if (!bloqueo) return res.status(404).json({ error: 'Bloqueo no encontrado' });
  if (!assertHotelAccess(req, bloqueo.hotel_id)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  const ok = bloqueos.deleteBloqueo(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Bloqueo no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/rooms/:roomId/bloqueos ──────────────────────────────
app.get('/api/admin/rooms/:roomId/bloqueos', requireAuth('owner', 'recepcion'), (req, res) => {
  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (!assertHotelAccess(req, room.hotelId)) return res.status(403).json({ error: 'Sin acceso a este hotel' });
  res.json(bloqueos.getBloqueosByRoom(req.params.roomId));
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:       'ok',
    mode:         tuya.isDemoMode() ? 'demo' : 'live',
    demo_env_raw: process.env.DEMO_MODE ?? '(no definido)',
    uptime:       Math.round(process.uptime()),
    version:      '1.0.0',
  });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const mode = tuya.isDemoMode() ? '🔵 DEMO (offline, sin Tuya)' : '🟢 LIVE (conectado a Tuya)';
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  🏨 Nexo IoT Room Server             ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`  Modo:    ${mode}`);
  console.log(`  Web app: http://localhost:${PORT}/room/DEMO1234`);
  console.log(`  API:     http://localhost:${PORT}/api/`);
  console.log(`  Health:  http://localhost:${PORT}/health\n`);
});
