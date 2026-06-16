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

const app       = express();
const PORT        = process.env.PORT      || 3000;
const ADMIN_KEY   = process.env.ADMIN_API_KEY || 'change_me';
const HOTEL_URL   = process.env.HOTEL_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://3dcommercecl.github.io/nexoiot').replace(/\/$/, '');

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://3dcommercecl.github.io',                   // frontend (GitHub Pages)
  'https://nexoiot-production.up.railway.app',        // mismo Railway (health checks, etc.)
  /^http:\/\/localhost(:\d+)?$/,                       // desarrollo local (cualquier puerto)
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (curl, Postman, Railway health checks)
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(allowed ? null : new Error(`CORS bloqueado: ${origin}`), allowed);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key'],
  credentials: false,
}));
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

// Logging (el token se oculta en los logs)
app.use((req, _res, next) => {
  const safe = req.path.replace(/\/([A-Za-z0-9_-]{6,16})/g, '/[TOKEN]');
  process.stdout.write(`[${new Date().toISOString()}] ${req.method} ${safe}\n`);
  next();
});

// Middleware de admin (X-Admin-Key en headers)
function adminAuth(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado. Agrega X-Admin-Key correcto.' });
  }
  next();
}

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
app.post('/api/admin/token', adminAuth, (req, res) => {
  const { roomId, guestName, checkin, checkout, phone, lang, accessibility } = req.body;
  if (!roomId || !guestName || !checkin || !checkout) {
    return res.status(400).json({ error: 'Requeridos: roomId, guestName, checkin, checkout' });
  }
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
app.post('/api/admin/token/:token/prefs', adminAuth, (req, res) => {
  const ok = rooms.updateTokenPrefs(req.params.token, req.body || {});
  if (!ok) return res.status(404).json({ error: 'Token no encontrado o inactivo' });
  res.json({ success: true });
});

// ── ADMIN: DELETE /api/admin/token/:token ─────────────────────────────────────
app.delete('/api/admin/token/:token', adminAuth, (req, res) => {
  const ok = rooms.expireToken(req.params.token);
  if (!ok) return res.status(404).json({ error: 'Token no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/tokens ──────────────────────────────────────────────
app.get('/api/admin/tokens', adminAuth, (req, res) => {
  res.json(rooms.listActiveTokens());
});

// ── ADMIN: GET /api/admin/rooms ───────────────────────────────────────────────
// Acepta ?hotel=<hotelId> para filtrar las habitaciones de un hotel específico.
app.get('/api/admin/rooms', adminAuth, (req, res) => {
  const r = rooms.getRooms();
  const activeTokens = rooms.listActiveTokens();
  res.json(
    Object.keys(r)
      .filter(id => r[id].demo !== true)
      .filter(id => !req.query.hotel || r[id].hotelId === req.query.hotel)
      .map(id => {
        const guest = activeTokens.find(t => t.roomId === id) || null;
        return {
          id,
          name:    r[id].name,
          hotel:   r[id].hotel || null,
          hotelId: r[id].hotelId || null,
          floor:   r[id].floor,
          plan:    r[id].plan || 'base',
          guest,
        };
      })
  );
});

// ── ADMIN: POST /api/admin/rooms/:roomId/scene ────────────────────────────────
// Aplica una escena a todos los dispositivos controlables de una habitación.
// Por ahora solo soporta scene: 'off' (apagar luces y enchufes), usada para
// acciones masivas como "apagar todo" en habitaciones que hacen checkout hoy.
app.post('/api/admin/rooms/:roomId/scene', adminAuth, async (req, res) => {
  const { scene } = req.body;
  if (scene !== 'off') {
    return res.status(400).json({ error: 'Escena no reconocida' });
  }

  const room = rooms.getRooms()[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

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
app.post('/api/admin/rooms/:roomId/devices/:deviceKey/manual-unlock', adminAuth, (req, res) => {
  const { allowed } = req.body || {};
  const ok = rooms.setManualUnlock(req.params.roomId, req.params.deviceKey, allowed);
  if (!ok) return res.status(404).json({ error: 'Habitación o dispositivo no encontrado' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/rooms/:roomId/activity ──────────────────────────────
// Historial de actividad de una habitación (check-in/out, cambios de preferencias,
// solicitudes de servicio, escenas aplicadas), usado en el modal de detalle del panel.
app.get('/api/admin/rooms/:roomId/activity', adminAuth, (req, res) => {
  if (!rooms.getRooms()[req.params.roomId]) {
    return res.status(404).json({ error: 'Habitación no encontrada' });
  }
  res.json(rooms.listActivity(req.params.roomId));
});

// ── ADMIN: GET /api/admin/hotels ──────────────────────────────────────────────
app.get('/api/admin/hotels', adminAuth, (req, res) => {
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
app.get('/api/admin/requests', adminAuth, (req, res) => {
  res.json(rooms.listRequests({ hotelId: req.query.hotel, status: req.query.status }));
});

// ── ADMIN: POST /api/admin/requests/:id/resolve ───────────────────────────────
app.post('/api/admin/requests/:id/resolve', adminAuth, (req, res) => {
  const ok = rooms.resolveRequest(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json({ success: true });
});

// ── ADMIN: GET /api/admin/reservas ────────────────────────────────────────────
// ?hotel=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/admin/reservas', adminAuth, (req, res) => {
  const { hotel, from, to } = req.query;
  if (!hotel || !from || !to) {
    return res.status(400).json({ error: 'Requeridos: hotel, from, to' });
  }
  res.json(reservas.getByHotel(hotel, from, to));
});

// ── ADMIN: POST /api/admin/reservas ──────────────────────────────────────────
app.post('/api/admin/reservas', adminAuth, (req, res) => {
  const { hotelId, roomId, guestName, checkin, checkout, guestEmail, guestPhone, notes, plan, source } = req.body;
  if (!hotelId || !roomId || !guestName || !checkin || !checkout) {
    return res.status(400).json({ error: 'Requeridos: hotelId, roomId, guestName, checkin, checkout' });
  }
  if (checkin >= checkout) {
    return res.status(400).json({ error: 'checkin debe ser anterior a checkout' });
  }
  if (!reservas.checkDisponibilidad(roomId, checkin, checkout)) {
    return res.status(409).json({ error: 'Habitación no disponible en esas fechas', code: 'ROOM_UNAVAILABLE' });
  }
  const r = reservas.createReserva(hotelId, roomId, guestName, checkin, checkout,
    { guestEmail, guestPhone, notes, plan, source });
  res.status(201).json(r);
});

// ── ADMIN: PATCH /api/admin/reservas/:id ─────────────────────────────────────
app.patch('/api/admin/reservas/:id', adminAuth, (req, res) => {
  const existing = reservas.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Reserva no encontrada' });

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
  res.json(updated);
});

// ── ADMIN: DELETE /api/admin/reservas/:id ─────────────────────────────────────
app.delete('/api/admin/reservas/:id', adminAuth, (req, res) => {
  const ok = reservas.cancelReserva(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Reserva no encontrada' });
  res.json({ success: true });
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
