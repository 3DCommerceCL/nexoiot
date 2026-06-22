'use strict';
// backend/encuesta-respuestas.js — Encuesta propia del hotel (preguntas configurables en
// encuesta-config.js) con respuestas guardadas en el perfil del huésped (guestKey, ver
// huespedes.js). Distinto de backend/encuestas.js, que solo manda un link externo de reseñas.

const crypto         = require('crypto');
const db             = require('./db');
const email          = require('./email');
const encuestaConfig = require('./encuesta-config');

const APP_URL = process.env.APP_URL || 'https://nexoiot-production.up.railway.app';

const genId = () => crypto.randomBytes(8).toString('hex');

function plantilla(hotelNombre, guestName, link) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#009D71">${hotelNombre}</h2>
      <p>Hola ${guestName},</p>
      <p>Nos encantaría conocer tu opinión sobre tu estadía — toma menos de un minuto.</p>
      <p><a href="${link}" style="display:inline-block;background:#009D71;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Responder encuesta</a></p>
    </div>
  `;
}

async function enviar(hotelId, { guestKey, guestName, guestEmail, reservaId, hotelNombre }) {
  if (!guestEmail) throw new Error('El huésped no tiene email registrado');
  const { preguntas } = encuestaConfig.getConfig(hotelId);
  if (!preguntas.length) throw new Error('El hotel no tiene preguntas de encuesta configuradas');

  const id = genId();
  db.prepare(`
    INSERT INTO encuesta_respuestas (id, hotel_id, guest_key, guest_name, reserva_id, respuestas, enviada_at, respondida_at)
    VALUES (?,?,?,?,?,NULL,?,NULL)
  `).run(id, hotelId, guestKey, guestName || null, reservaId || null, new Date().toISOString());

  const link = `${APP_URL}/encuesta.html?token=${id}`;
  await email.sendEmail({
    to: guestEmail,
    subject: `¿Cómo fue tu estadía? — ${hotelNombre || hotelId}`,
    html: plantilla(hotelNombre || hotelId, guestName || '', link),
  });
  return db.prepare('SELECT * FROM encuesta_respuestas WHERE id = ?').get(id);
}

function getByToken(token) {
  return db.prepare('SELECT * FROM encuesta_respuestas WHERE id = ?').get(token);
}

function responder(token, respuestas) {
  const row = getByToken(token);
  if (!row) return null;
  if (row.respondida_at) return row;
  db.prepare('UPDATE encuesta_respuestas SET respuestas = ?, respondida_at = ? WHERE id = ?')
    .run(JSON.stringify(respuestas || {}), new Date().toISOString(), token);
  return getByToken(token);
}

function listarRespondidas(hotelId, guestKey) {
  return db.prepare(`
    SELECT * FROM encuesta_respuestas
    WHERE hotel_id = ? AND guest_key = ? AND respondida_at IS NOT NULL
    ORDER BY respondida_at DESC
  `).all(hotelId, guestKey);
}

module.exports = { enviar, getByToken, responder, listarRespondidas };
