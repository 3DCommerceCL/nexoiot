'use strict';
// backend/encuestas.js — Encuesta de satisfacción post-estadía: barrido diario que envía
// un email con el link de reseñas (Google/TripAdvisor) configurado por hotel, una sola vez
// por reserva, el día después del checkout.

const db           = require('./db');
const reservas     = require('./reservas');
const bookingConfig = require('./booking-config');
const email        = require('./email');

const now = () => new Date().toISOString();

function yaEnviada(reservaId) {
  return !!db.prepare('SELECT 1 FROM encuestas_enviadas WHERE reserva_id = ?').get(reservaId);
}

function marcarEnviada(reservaId, hotelId) {
  db.prepare('INSERT INTO encuestas_enviadas (reserva_id, hotel_id, enviado_at) VALUES (?,?,?)')
    .run(reservaId, hotelId, now());
}

function plantilla(hotelNombre, guestName, linkResenas) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#009D71">${hotelNombre}</h2>
      <p>Hola ${guestName},</p>
      <p>Esperamos que hayas disfrutado tu estadía. ¿Nos ayudas con una reseña?</p>
      <p><a href="${linkResenas}" style="display:inline-block;background:#009D71;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Dejar una reseña</a></p>
    </div>
  `;
}

// Reservas con checkout = ayer, no canceladas, con email del huésped, del hotel con
// link de reseñas configurado, y que todavía no recibieron la encuesta.
async function enviarPendientes() {
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const candidatas = db.prepare(`
    SELECT * FROM reservas WHERE checkout = ? AND status NOT IN ('cancelled') AND guest_email IS NOT NULL
  `).all(ayer);

  let enviadas = 0;
  for (const r of candidatas) {
    if (yaEnviada(r.id)) continue;
    const cfg = bookingConfig.getConfig(r.hotel_id);
    if (!cfg.link_resenas) continue;
    try {
      await email.sendEmail({
        to: r.guest_email,
        subject: `¿Cómo fue tu estadía? — ${cfg.titulo || r.hotel_id}`,
        html: plantilla(cfg.titulo || r.hotel_id, r.guest_name, cfg.link_resenas),
      });
      marcarEnviada(r.id, r.hotel_id);
      enviadas++;
    } catch (err) {
      console.error('[encuestas] Error enviando a', r.guest_email, ':', err.message);
    }
  }
  if (enviadas) console.log(`[encuestas] ${enviadas} encuesta(s) de satisfacción enviadas`);
  return enviadas;
}

module.exports = { enviarPendientes };
