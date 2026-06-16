'use strict';
// backend/channel-manager.js — Sincronización bidireccional con OTAs via SiteMinder pmsXchange
//
// Sin SITEMINDER_API_KEY el módulo funciona en modo simulación: registra en sync_log
// lo que enviaría, pero no hace llamadas reales. Al configurar la API key, el sistema
// empieza a sincronizar automáticamente sin cambios de código.

const crypto   = require('crypto');
const db       = require('./db');
const reservas = require('./reservas');

const SM_URL    = process.env.SITEMINDER_API_URL;
const SM_KEY    = process.env.SITEMINDER_API_KEY;
const WH_SECRET = process.env.SITEMINDER_WEBHOOK_SECRET;

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

// ── LOG DE SINCRONIZACIÓN ─────────────────────────────────────────────────────
function logSync({ hotelId, canalId = null, tipo, status, payload = null, error = null }) {
  db.prepare(`
    INSERT INTO sync_log (id, hotel_id, canal_id, tipo, status, payload, error, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    genId(), hotelId, canalId || null, tipo, status,
    payload ? JSON.stringify(payload) : null,
    error   || null,
    now()
  );
}

// ── ALERTA: 3 fallos consecutivos ────────────────────────────────────────────
function checkConsecutiveFails(canalId) {
  if (!canalId) return;
  const recientes = db.prepare(
    'SELECT status FROM sync_log WHERE canal_id = ? ORDER BY created_at DESC LIMIT 3'
  ).all(canalId);
  if (recientes.length === 3 && recientes.every(r => r.status === 'error')) {
    console.error(`[cm] ALERTA: 3 fallos consecutivos en canal ${canalId}`);
    // COMPLETAR: enviar alerta email/WhatsApp al equipo técnico
  }
}

// ── SAFE PUSH: wrapper que registra ok/error sin romper el caller ─────────────
async function safePush(fn, meta) {
  try {
    await fn();
    logSync({ ...meta, status: 'ok' });
  } catch (err) {
    logSync({ ...meta, status: 'error', error: err.message });
    checkConsecutiveFails(meta.canalId);
  }
}

// ── SITEMINDER API HELPER ─────────────────────────────────────────────────────
async function smFetch(endpoint, method = 'GET', body = null) {
  if (!SM_KEY) throw new Error('SITEMINDER_API_KEY no configurada — modo simulación');
  const res = await fetch(`${SM_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SM_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `SiteMinder error ${res.status}`);
  return data;
}

// ── PUSH: Disponibilidad → OTAs ──────────────────────────────────────────────
// Llamar fire-and-forget (sin await) desde server.js al crear/cancelar reservas
// y al crear/eliminar bloqueos de habitación.
async function pushDisponibilidad(hotelId, roomId, desde, hasta) {
  const canalesActivos = db.prepare(`
    SELECT c.*, m.ota_room_id, m.ota_rate_id
    FROM canales c
    JOIN canal_room_mapping m ON m.canal_id = c.id
    WHERE c.hotel_id = ? AND c.activo = 1 AND m.room_id = ?
  `).all(hotelId, roomId);

  if (!canalesActivos.length) return;

  // Calcular disponibilidad: si hay reserva activa en el rango → no disponible
  const reservasActivas = reservas.getByHotel(hotelId, desde, hasta)
    .filter(r => r.room_id === roomId && !['cancelled', 'checked_out'].includes(r.status));
  const disponible = reservasActivas.length === 0;

  for (const canal of canalesActivos) {
    await safePush(
      async () => {
        // COMPLETAR: ajustar endpoint y payload según documentación SiteMinder pmsXchange
        const payload = {
          propertyId:    canal.config?.siteminder_property_id || hotelId,
          roomTypeId:    canal.ota_room_id,
          ratePlanId:    canal.ota_rate_id || undefined,
          dateRange:     { start: desde, end: hasta },
          availability:  disponible ? 1 : 0,
        };
        await smFetch(`/properties/${payload.propertyId}/availability`, 'PUT', payload);
      },
      { hotelId, canalId: canal.id, tipo: 'push_disponibilidad', payload: { roomId, desde, hasta, disponible } }
    );
  }
}

// ── PUSH: Tarifa → OTAs ──────────────────────────────────────────────────────
// Llamar después de modificar tarifas (prompt 03).
async function pushTarifa(hotelId, roomId, precioClp, desde, hasta) {
  const canalesActivos = db.prepare(`
    SELECT c.*, m.ota_room_id, m.ota_rate_id
    FROM canales c
    JOIN canal_room_mapping m ON m.canal_id = c.id
    WHERE c.hotel_id = ? AND c.activo = 1 AND m.room_id = ?
  `).all(hotelId, roomId);

  for (const canal of canalesActivos) {
    await safePush(
      async () => {
        // COMPLETAR: ajustar endpoint y payload según documentación SiteMinder pmsXchange
        const payload = {
          propertyId: canal.config?.siteminder_property_id || hotelId,
          roomTypeId: canal.ota_room_id,
          ratePlanId: canal.ota_rate_id || undefined,
          dateRange:  { start: desde, end: hasta },
          rate:       { amount: precioClp, currency: 'CLP' },
        };
        await smFetch(`/properties/${payload.propertyId}/rates`, 'PUT', payload);
      },
      { hotelId, canalId: canal.id, tipo: 'push_tarifa', payload: { roomId, precioClp, desde, hasta } }
    );
  }
}

// ── PULL: Procesar reserva entrante de OTA ────────────────────────────────────
// Llamado desde el webhook POST /api/webhook/reserva/:canalId.
async function procesarReservaOTA(payload, canalId) {
  const canal = db.prepare('SELECT * FROM canales WHERE id = ?').get(canalId);
  if (!canal) {
    console.error('[cm] Canal no encontrado:', canalId);
    return;
  }

  // Buscar habitación local por OTA room ID
  // COMPLETAR: ajustar campo según payload real de SiteMinder
  const otaRoomId = payload.roomTypeId || payload.room_type_id || payload.roomId;
  const mapping = db.prepare(
    'SELECT * FROM canal_room_mapping WHERE canal_id = ? AND ota_room_id = ?'
  ).get(canalId, otaRoomId);

  if (!mapping) {
    logSync({
      hotelId: canal.hotel_id, canalId,
      tipo: 'pull_reserva', status: 'error',
      error:   `Habitación OTA no mapeada: ${otaRoomId}`,
      payload,
    });
    console.error('[cm] Habitación OTA sin mapear:', otaRoomId, '— configurar en Canales');
    return;
  }

  // COMPLETAR: ajustar nombres de campos según payload real de SiteMinder pmsXchange
  const checkin   = payload.arrivalDate   || payload.checkin   || payload.check_in;
  const checkout  = payload.departureDate || payload.checkout  || payload.check_out;
  const guestName = payload.guestName
    || [payload.firstName, payload.lastName].filter(Boolean).join(' ')
    || 'Huésped OTA';

  if (!checkin || !checkout) {
    logSync({ hotelId: canal.hotel_id, canalId, tipo: 'pull_reserva', status: 'error', error: 'Fechas faltantes', payload });
    return;
  }

  // Verificar disponibilidad local (puede haber conflicto si el push tuvo delay)
  if (!reservas.checkDisponibilidad(mapping.room_id, checkin, checkout)) {
    logSync({
      hotelId: canal.hotel_id, canalId,
      tipo: 'pull_reserva', status: 'error',
      error: `Conflicto: hab ${mapping.room_id} no disponible ${checkin}→${checkout}`,
      payload,
    });
    console.error('[cm] CONFLICTO OTA: habitación ocupada al recibir reserva externa');
    // COMPLETAR: enviar alerta urgente a recepción (WhatsApp/email)
    return;
  }

  const nueva = reservas.createReserva(
    canal.hotel_id, mapping.room_id, guestName, checkin, checkout,
    {
      guestEmail: payload.email      || payload.guestEmail || null,
      guestPhone: payload.phone      || payload.guestPhone || null,
      source:     canal.nombre,
      notes:      `OTA via ${canal.nombre} — Ref: ${payload.reservationId || payload.id || 'N/A'}`,
    }
  );

  logSync({ hotelId: canal.hotel_id, canalId, tipo: 'pull_reserva', status: 'ok', payload: { reservaId: nueva.id } });
  console.log(`[cm] Reserva OTA creada: ${nueva.id} (${canal.nombre})`);
}

// ── RESYNC COMPLETO: todas las habitaciones de un hotel ───────────────────────
// Llamado desde POST /api/admin/canales/:id/sync-now.
async function resyncHotel(canalId) {
  const canal = db.prepare('SELECT * FROM canales WHERE id = ?').get(canalId);
  if (!canal) throw new Error('Canal no encontrado');

  const mappings = db.prepare('SELECT * FROM canal_room_mapping WHERE canal_id = ?').all(canalId);
  if (!mappings.length) throw new Error('Sin habitaciones mapeadas para este canal');

  const hoy     = new Date().toISOString().slice(0, 10);
  const en90    = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  for (const m of mappings) {
    await pushDisponibilidad(canal.hotel_id, m.room_id, hoy, en90);
  }
  return { mapeadas: mappings.length, desde: hoy, hasta: en90 };
}

// ── WEBHOOK: Verificar firma de SiteMinder ────────────────────────────────────
function verificarFirma(signature, body) {
  if (!WH_SECRET) return true; // modo desarrollo sin secret
  const raw      = typeof body === 'string' ? body : JSON.stringify(body);
  const expected = crypto.createHmac('sha256', WH_SECRET).update(raw).digest('hex');
  return signature === expected || signature === `sha256=${expected}`;
}

module.exports = { pushDisponibilidad, pushTarifa, procesarReservaOTA, resyncHotel, verificarFirma, logSync };
