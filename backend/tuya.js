'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// tuya.js — Integración con Tuya OpenAPI v1.0
// Documentación: https://developer.tuya.com/en/docs/cloud
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CLIENT_ID     = process.env.TUYA_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET || '';
const BASE_URL      = process.env.TUYA_BASE_URL      || 'https://openapi.tuyaus.com';
// DEMO_MODE=false  (o 0, no, off) activa el modo live con Tuya real
const _dm       = (process.env.DEMO_MODE ?? 'true').toLowerCase().trim();
const DEMO_MODE = !['false', '0', 'no', 'off'].includes(_dm);

// ── CACHÉ DE TOKEN ────────────────────────────────────────────────────────────
let _cache = { token: null, expiresAt: 0 };

// ── ESTADO MOCK (demo offline) ────────────────────────────────────────────────
// Se actualiza en memoria cuando se envían comandos en modo demo
const _mock = {
  'eba6a890c60baf97desmep': [ // Luz velador 1 (RGB)
    { code: 'switch_led',      value: false },
    { code: 'bright_value_v2', value: 500  },
    { code: 'work_mode',       value: 'white' },
    { code: 'temp_value_v2',   value: 500  },
    { code: 'colour_data_v2',  value: { h: 0, s: 1000, v: 1000 } },
  ],
  'eba435f5b263f3d00eerya': [ // Luz techo (RGB)
    { code: 'switch_led',      value: false },
    { code: 'bright_value_v2', value: 500  },
    { code: 'work_mode',       value: 'white' },
    { code: 'temp_value_v2',   value: 500  },
    { code: 'colour_data_v2',  value: { h: 0, s: 1000, v: 1000 } },
  ],
  'eb8b2178103676296ca2hk': [ // LED ambiente RGB
    { code: 'switch_led',      value: false },
    { code: 'bright_value_v2', value: 500  },
    { code: 'work_mode',       value: 'white' },
    { code: 'temp_value_v2',   value: 500  },
    { code: 'colour_data_v2',  value: { h: 0, s: 1000, v: 1000 } },
  ],
  'ebaf8a7cc5374f6b26n4v6': [ // Cortina
    { code: 'control',         value: 'stop' },
    { code: 'percent_control', value: 0 },
  ],
  'ebeffe2c971f4f2b88ciac': [ // Enchufe USB (2 canales)
    { code: 'switch_1',        value: false },
    { code: 'switch_2',        value: false },
  ],
  'ebc06c6118bf9128ec9i9s': [ // LED Bajo Cama (RGB)
    { code: 'switch_led',      value: false },
    { code: 'work_mode',       value: 'white' },
    { code: 'colour_data_v2',  value: { h: 0, s: 1000, v: 1000 } },
  ],
  'eb24a9f06a4c32ba51p42s': [ // Sensor puerta
    { code: 'doorcontact_state', value: false },
  ],
};

// ── FIRMA TUYA (HMAC-SHA256) ──────────────────────────────────────────────────
function calcSign(clientId, secret, accessToken, timestamp, nonce, method, pathWithQuery, bodyStr) {
  const bodyHash    = crypto.createHash('sha256').update(bodyStr || '').digest('hex');
  const stringToSign = [method.toUpperCase(), bodyHash, '', pathWithQuery].join('\n');
  const message     = clientId + accessToken + timestamp + nonce + stringToSign;
  return crypto.createHmac('sha256', secret).update(message).digest('hex').toUpperCase();
}

// ── REQUEST BASE ──────────────────────────────────────────────────────────────
async function request(method, pathWithQuery, body = null, accessToken = '') {
  const timestamp = Date.now().toString();
  const nonce     = crypto.randomBytes(16).toString('hex');
  const bodyStr   = body ? JSON.stringify(body) : '';
  const sign      = calcSign(CLIENT_ID, CLIENT_SECRET, accessToken, timestamp, nonce, method, pathWithQuery, bodyStr);

  const headers = {
    'client_id':   CLIENT_ID,
    'sign':        sign,
    'sign_method': 'HMAC-SHA256',
    't':           timestamp,
    'nonce':       nonce,
    'Content-Type':'application/json',
  };
  if (accessToken) headers['access_token'] = accessToken;

  const opts = { method: method.toUpperCase(), headers };
  if (bodyStr) opts.body = bodyStr;

  const res  = await fetch(`${BASE_URL}${pathWithQuery}`, opts);
  const data = await res.json();

  if (!data.success) {
    throw new Error(`Tuya error [${data.code}]: ${data.msg}`);
  }
  return data.result;
}

// ── TOKEN DE ACCESO ───────────────────────────────────────────────────────────
async function getAccessToken() {
  if (DEMO_MODE) return 'demo_offline_token';
  if (_cache.token && Date.now() < _cache.expiresAt) return _cache.token;

  const result = await request('GET', '/v1.0/token?grant_type=1', null, '');
  _cache.token     = result.access_token;
  _cache.expiresAt = Date.now() + (result.expire_time - 300) * 1000; // renueva 5 min antes
  console.log('[Tuya] Token obtenido, válido por', result.expire_time, 'seg');
  return _cache.token;
}

// ── GET ESTADO DEL DISPOSITIVO ────────────────────────────────────────────────
async function getDeviceStatus(deviceId) {
  if (DEMO_MODE) {
    return { online: true, status: _mock[deviceId] ? [..._mock[deviceId]] : [] };
  }
  try {
    const token  = await getAccessToken();
    const result = await request('GET', `/v1.0/devices/${deviceId}`, null, token);
    return { online: !!result.online, status: result.status || [] };
  } catch (err) {
    console.error(`[Tuya] getDeviceStatus(${deviceId}):`, err.message);
    return null; // null = error de comunicación con Tuya
  }
}

// ── ENVIAR COMANDO ────────────────────────────────────────────────────────────
// commands: Array<{ code: string, value: any }>
async function sendCommand(deviceId, commands) {
  if (DEMO_MODE) {
    if (!_mock[deviceId]) _mock[deviceId] = [];
    commands.forEach(({ code, value }) => {
      const existing = _mock[deviceId].find(s => s.code === code);
      if (existing) existing.value = value;
      else _mock[deviceId].push({ code, value });
    });
    return true;
  }
  try {
    const token = await getAccessToken();
    await request('POST', `/v1.0/devices/${deviceId}/commands`, { commands }, token);
    return true;
  } catch (err) {
    console.error(`[Tuya] sendCommand(${deviceId}):`, err.message);
    throw err;
  }
}

module.exports = { getDeviceStatus, sendCommand, isDemoMode: () => DEMO_MODE };
