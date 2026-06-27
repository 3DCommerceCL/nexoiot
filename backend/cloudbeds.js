'use strict';
// backend/cloudbeds.js — Integración con Cloudbeds via webhooks (opción A)
//
// Flujo:
//   1. Owner guarda API key + property ID en el panel → se registra webhook en Cloudbeds.
//   2. Cloudbeds hace POST a /api/webhook/cloudbeds/:hotelId en cada evento de reserva.
//   3. Se verifica firma HMAC, se mapea el payload y se upserta la reserva en el sistema.
//
// Referencia API: https://hotels.cloudbeds.com/api/v1.1/
// Los nombres de campo marcados /* CB_FIELD */ deben verificarse contra la spec real
// una vez se tenga acceso al sandbox de Cloudbeds — el mapeo usa fallbacks para cubrir
// variaciones de versión.

const crypto   = require('crypto');
const https    = require('https');
const db       = require('./db');

const CB_API   = 'api.cloudbeds.com';
const CB_BASE  = '/api/v1.1';
const now      = () => new Date().toISOString();

// ── CONFIG POR HOTEL ──────────────────────────────────────────────────────────

function getConfig(hotelId) {
  return db.prepare('SELECT * FROM cloudbeds_config WHERE hotel_id = ?').get(hotelId) || null;
}

function saveConfig(hotelId, { apiKey, propertyId, webhookSecret = null, webhookId = null, enabled = 1 }) {
  const existing = getConfig(hotelId);
  if (existing) {
    db.prepare(`
      UPDATE cloudbeds_config
      SET api_key=?, property_id=?, webhook_secret=?, webhook_id=?, enabled=?, updated_at=?
      WHERE hotel_id=?
    `).run(apiKey, propertyId, webhookSecret, webhookId, enabled ? 1 : 0, now(), hotelId);
  } else {
    db.prepare(`
      INSERT INTO cloudbeds_config (hotel_id, api_key, property_id, webhook_secret, webhook_id, enabled, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(hotelId, apiKey, propertyId, webhookSecret, webhookId, enabled ? 1 : 0, now(), now());
  }
  return getConfig(hotelId);
}

function setLastSync(hotelId) {
  db.prepare("UPDATE cloudbeds_config SET last_sync_at=?, updated_at=? WHERE hotel_id=?")
    .run(now(), now(), hotelId);
}

function deleteConfig(hotelId) {
  db.prepare('DELETE FROM cloudbeds_config WHERE hotel_id = ?').run(hotelId);
}

// ── LLAMADA HTTPS A CLOUDBEDS API ─────────────────────────────────────────────

function cbRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: CB_API,
      path: `${CB_BASE}${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`Cloudbeds ${res.statusCode}: ${parsed.message || data}`));
          else resolve(parsed);
        } catch { reject(new Error(`Cloudbeds respuesta no JSON: ${data}`)); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── REGISTRO DE WEBHOOK EN CLOUDBEDS ─────────────────────────────────────────
// Cloudbeds permite registrar hasta 10 webhooks por propiedad.
// Endpoint: POST /api/v1.1/webhooks (campo webhookID en la respuesta).
// Acciones soportadas: reservation/created, reservation/modified, reservation/cancelled
// NOTA: los nombres exactos de acción (created vs new) deben verificarse contra la spec.

async function registrarWebhook(apiKey, propertyId, callbackUrl) {
  return cbRequest('POST', '/webhooks', {
    propertyID: propertyId,                            /* CB_FIELD */
    url: callbackUrl,
    actions: [
      'reservation/created',   /* CB_FIELD — puede ser 'reservation/new' */
      'reservation/modified',
      'reservation/cancelled',
    ],
  }, apiKey);
}

async function eliminarWebhook(apiKey, webhookId) {
  if (!webhookId) return;
  try {
    await cbRequest('DELETE', `/webhooks/${webhookId}`, null, apiKey);
  } catch (err) {
    console.warn('[cloudbeds] No se pudo eliminar webhook:', err.message);
  }
}

// ── VERIFICACIÓN DE FIRMA HMAC ────────────────────────────────────────────────
// Cloudbeds firma el cuerpo del webhook con HMAC-SHA256.
// El header puede llamarse 'x-cloudbeds-signature' o 'x-hub-signature-256'.
// NOTA: verificar el nombre exacto del header en la documentación real.

function verificarFirma(rawBody, headers, secret) {
  if (!secret) return true; // sin secret configurado: acepta todo (modo dev)
  const sig = headers['x-cloudbeds-signature']   ||
              headers['x-hub-signature-256']       ||
              headers['x-cloudbeds-webhook-secret'] || '';
  const clean = sig.replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(clean, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ── MAPEO DE PAYLOAD CLOUDBEDS → NUESTRO FORMATO ─────────────────────────────
// Cloudbeds envía el objeto 'reservation' dentro del evento.
// Los nombres de campo son estimaciones basadas en la doc pública — pueden variar.
// Usar fallbacks para cubrir v1 vs v1.1 y posibles cambios de nombre.

function mapearReserva(cbRes) {
  // Extraer nombre: Cloudbeds puede enviarlo como guestName, guest.name, o firstName+lastName
  const nombre = cbRes.guestName                                              /* CB_FIELD */
    || (cbRes.guest?.firstName ? `${cbRes.guest.firstName} ${cbRes.guest.lastName || ''}`.trim() : null)
    || cbRes.guest?.name
    || 'Sin nombre';

  const checkin  = cbRes.startDate   || cbRes.arrivalDate   || cbRes.checkIn   || ''; /* CB_FIELD */
  const checkout = cbRes.endDate     || cbRes.departureDate || cbRes.checkOut  || ''; /* CB_FIELD */
  const roomName = cbRes.roomName    || cbRes.room?.name    || cbRes.roomTypeName || ''; /* CB_FIELD */
  const cbId     = cbRes.reservationID || cbRes.id          || '';            /* CB_FIELD */

  return {
    cbId,
    nombre,
    email:    cbRes.email        || cbRes.guest?.email    || '',
    telefono: cbRes.phone        || cbRes.guest?.phone    || cbRes.guestPhone || '',
    checkin:  checkin.slice(0, 10),   // asegura formato YYYY-MM-DD
    checkout: checkout.slice(0, 10),
    roomName,
    notas:    cbRes.notes        || cbRes.specialRequests || '',
    montoCLP: parseInt(cbRes.totalAmount || cbRes.grandTotal || 0, 10),
    status:   mapearStatus(cbRes.status || cbRes.reservationStatus || ''),
  };
}

function mapearStatus(cbStatus) {
  const mapa = {
    confirmed:     'confirmed',
    not_confirmed: 'pending',
    pending:       'pending',
    cancelled:     'cancelled',
    canceled:      'cancelled',
    checked_in:    'checked_in',
    checkedin:     'checked_in',
    checked_out:   'checked_out',
    checkedout:    'checked_out',
  };
  return mapa[(cbStatus || '').toLowerCase().replace(/[\s-]/g, '_')] || 'confirmed';
}

module.exports = {
  getConfig, saveConfig, deleteConfig, setLastSync,
  registrarWebhook, eliminarWebhook,
  verificarFirma, mapearReserva,
};
