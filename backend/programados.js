'use strict';
// backend/programados.js — Comandos de dispositivo programados para un momento
// futuro (ej. encender la estufa antes de que llegue el huésped). La ejecución
// real corre desde el job en server.js (setInterval, mismo patrón que la
// actualización de UF y el envío de encuestas).

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

const MAX_DIAS_ADELANTE = 30;

function crear({ hotelId, roomId, deviceKey, comando, ejecutarEn, origen, creadoPor }) {
  const fecha = new Date(ejecutarEn);
  if (isNaN(fecha.getTime())) throw new Error('Fecha/hora inválida');
  if (fecha.getTime() <= Date.now()) throw new Error('La fecha/hora debe ser futura');
  if (fecha.getTime() > Date.now() + MAX_DIAS_ADELANTE * 86400000) {
    throw new Error(`No se puede programar con más de ${MAX_DIAS_ADELANTE} días de anticipación`);
  }

  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO comandos_programados
      (id, hotel_id, room_id, device_key, comando, ejecutar_en, origen, creado_por, estado, created_at)
    VALUES (?,?,?,?,?,?,?,?,'pendiente',?)
  `).run(id, hotelId, roomId, deviceKey, JSON.stringify(comando), fecha.toISOString(), origen, creadoPor || null, ts);

  return db.prepare('SELECT * FROM comandos_programados WHERE id = ?').get(id);
}

function listarPorRoom(roomId) {
  return db.prepare(`
    SELECT * FROM comandos_programados
    WHERE room_id = ? AND estado = 'pendiente'
    ORDER BY ejecutar_en ASC
  `).all(roomId);
}

function getById(id) {
  return db.prepare('SELECT * FROM comandos_programados WHERE id = ?').get(id);
}

function cancelar(id) {
  const c = getById(id);
  if (!c || c.estado !== 'pendiente') return false;
  db.prepare("UPDATE comandos_programados SET estado = 'cancelado' WHERE id = ?").run(id);
  return true;
}

function obtenerPendientesVencidos(ahoraISO) {
  return db.prepare(`
    SELECT * FROM comandos_programados
    WHERE estado = 'pendiente' AND ejecutar_en <= ?
  `).all(ahoraISO);
}

function marcarEjecutado(id) {
  db.prepare("UPDATE comandos_programados SET estado = 'ejecutado', ejecutado_at = ? WHERE id = ?").run(now(), id);
}

function marcarFallido(id, motivo) {
  db.prepare("UPDATE comandos_programados SET estado = 'fallido', error = ?, ejecutado_at = ? WHERE id = ?").run(motivo, now(), id);
}

module.exports = { crear, listarPorRoom, getById, cancelar, obtenerPendientesVencidos, marcarEjecutado, marcarFallido };
