'use strict';
// backend/trial.js — Solicitudes de prueba gratuita de PMS (registro self-serve)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function createSolicitud({
  hotelNombre, rut, razonSocial, giro, giroVerificado,
  email, nombreContacto, telefono, status, motivoRechazo = null,
}) {
  const id = genId();
  db.prepare(`
    INSERT INTO trial_solicitudes
      (id, hotel_nombre, rut, razon_social, giro, giro_verificado, email, nombre_contacto, telefono, status, motivo_rechazo, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, hotelNombre, rut, razonSocial || null, giro || null, giroVerificado ? 1 : 0,
    email.trim().toLowerCase(), nombreContacto, telefono || null, status, motivoRechazo, now()
  );
  return getById(id);
}

function getById(id) {
  return db.prepare('SELECT * FROM trial_solicitudes WHERE id = ?').get(id) || null;
}

function listSolicitudes(status) {
  return status
    ? db.prepare('SELECT * FROM trial_solicitudes WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM trial_solicitudes ORDER BY created_at DESC').all();
}

function resolver(id, { status, motivoRechazo = null, hotelId = null, usuarioId = null }) {
  db.prepare(`
    UPDATE trial_solicitudes
    SET status = ?, motivo_rechazo = ?, hotel_id = ?, usuario_id = ?, resuelto_at = ?
    WHERE id = ?
  `).run(status, motivoRechazo, hotelId, usuarioId, now(), id);
  return getById(id);
}

module.exports = { createSolicitud, getById, listSolicitudes, resolver };
