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

const app       = express();
const PORT      = process.env.PORT      || 3000;
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'change_me';
const HOTEL_URL = process.env.HOTEL_URL || `http://localhost:${PORT}`;

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://niglet.netlify.app',                       // frontend en producción
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
        colorTemp: Math.round((get('colour_temp_v2')  ?? 500) / 10),  // 0-1000 → 0-100
      };
    case 'light_rgb': {
      const cd = get('colour_data_v2') || { h: 0, s: 1000, v: 1000 };
      return {
        on:        get('switch_led')      ?? false,
        intensity: Math.round((get('bright_value_v2') ?? 500) / 10),
        mode:      get('work_mode')       ?? 'white',
        colorTemp: Math.round((get('colour_temp_v2')  ?? 500) / 10),
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
      if ('colorTemp' in command) cmds.push({ code: 'colour_temp_v2',  value: Math.min(1000, Math.max(0,  Math.round(command.colorTemp  * 10))) });
      break;
    case 'light_rgb':
      if ('on'        in command) cmds.push({ code: 'switch_led',      value: command.on });
      if ('intensity' in command) cmds.push({ code: 'bright_value_v2', value: Math.min(1000, Math.max(10, Math.round(command.intensity * 10))) });
      if ('colorTemp' in command) {
        cmds.push({ code: 'work_mode',      value: 'white' });
        cmds.push({ code: 'colour_temp_v2', value: Math.round(command.colorTemp * 10) });
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
    const raw = statusResults[i].status === 'fulfilled' ? statusResults[i].value : null;
    devices[name] = {
      label:     dev.label,
      type:      dev.type,
      channels:  dev.channels || null,
      available: raw !== null,
      state:     statusToState(dev.type, raw),
    };
  });

  res.json({
    roomId:    entry.roomId,
    roomName:  room.name,
    hotelName: room.hotel || process.env.HOTEL_NAME || 'Nexo IoT',
    guestName: entry.guestName,
    checkout:  entry.checkout,
    demoMode:  tuya.isDemoMode(),
    devices,
  });
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

// ── ADMIN: POST /api/admin/token ──────────────────────────────────────────────
app.post('/api/admin/token', adminAuth, (req, res) => {
  const { roomId, guestName, checkin, checkout, phone } = req.body;
  if (!roomId || !guestName || !checkin || !checkout) {
    return res.status(400).json({ error: 'Requeridos: roomId, guestName, checkin, checkout' });
  }
  try {
    const token = rooms.generateToken(roomId, guestName, checkin, checkout, phone);
    res.json({
      token,
      url:       `${HOTEL_URL}/room/${token}`,
      roomId,
      guestName,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
app.get('/api/admin/rooms', adminAuth, (req, res) => {
  const r = rooms.getRooms();
  res.json(Object.keys(r).map(id => ({ id, name: r[id].name, floor: r[id].floor })));
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    mode:    tuya.isDemoMode() ? 'demo' : 'live',
    uptime:  Math.round(process.uptime()),
    version: '1.0.0',
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
