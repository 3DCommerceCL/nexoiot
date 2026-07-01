'use strict';
// backend/programados.js — Comandos de dispositivo programados con rango
// horario (desde/hasta, apagado automático al final) y repetición (una vez en
// una fecha, o ciertos días de la semana, indefinidamente hasta cancelar). La
// ejecución real corre desde el job en server.js (setInterval, mismo patrón
// que la actualización de UF y el envío de encuestas).

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

const MAX_PASOS  = 20; // mismo límite que saveScene() para escenas del huésped
const HORA_RE    = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_RE   = /^\d{4}-\d{2}-\d{2}$/;

// Fecha de hoy en America/Santiago (no la del servidor, que en Railway corre en
// UTC) — mismo criterio que horaChile() en server.js, para que "no programar en
// el pasado" use el mismo "hoy" que el job que ejecuta los comandos.
function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

function validarPasos(pasos, campo) {
  if (!Array.isArray(pasos) || !pasos.length) throw new Error(`${campo} debe ser un array no vacío`);
  if (pasos.length > MAX_PASOS) throw new Error(`Máximo ${MAX_PASOS} pasos en ${campo}`);
}

// Devuelve true si la nueva programación se superpone en horario Y fecha con alguna activa
// del mismo dispositivo (descripcion) en la misma habitación.
function detectarConflicto(roomId, descripcion, horaInicio, horaFin, repetir, fecha, diasSemana) {
  const existentes = db.prepare(
    "SELECT * FROM comandos_programados WHERE room_id=? AND descripcion=? AND estado='activo'"
  ).all(roomId, descripcion);

  for (const ex of existentes) {
    // Chequeo de solapamiento horario
    const nFin = horaFin  || null;
    const eFin = ex.hora_fin || null;
    let overlap;
    if (!nFin && !eFin) {
      overlap = horaInicio === ex.hora_inicio;
    } else if (!nFin) {
      overlap = horaInicio >= ex.hora_inicio && horaInicio < eFin;
    } else if (!eFin) {
      overlap = ex.hora_inicio >= horaInicio && ex.hora_inicio < nFin;
    } else {
      overlap = horaInicio < eFin && ex.hora_inicio < nFin;
    }
    if (!overlap) continue;

    // Chequeo de solapamiento de fecha
    let dateOverlap = false;
    if (repetir === 'once' && ex.repetir === 'once') {
      dateOverlap = (fecha === ex.fecha);
    } else if (repetir === 'once' && ex.repetir === 'weekly') {
      const dia = new Date(fecha + 'T12:00:00').getDay();
      dateOverlap = JSON.parse(ex.dias_semana || '[]').includes(dia);
    } else if (repetir === 'weekly' && ex.repetir === 'once') {
      const dia = new Date(ex.fecha + 'T12:00:00').getDay();
      dateOverlap = (diasSemana || []).includes(dia);
    } else {
      const exDias = JSON.parse(ex.dias_semana || '[]');
      dateOverlap = (diasSemana || []).some(d => exDias.includes(d));
    }

    if (dateOverlap) return true;
  }
  return false;
}

function crear({ hotelId, roomId, descripcion, pasosInicio, pasosFin, horaInicio, horaFin, repetir, fecha, diasSemana, origen, creadoPor }) {
  if (!descripcion || !descripcion.trim()) throw new Error('descripcion requerida');
  validarPasos(pasosInicio, 'pasosInicio');
  if (!HORA_RE.test(horaInicio || '')) throw new Error('horaInicio inválida (formato HH:MM)');

  if (pasosFin || horaFin) {
    validarPasos(pasosFin, 'pasosFin');
    if (!HORA_RE.test(horaFin || '')) throw new Error('horaFin inválida (formato HH:MM)');
    if (horaFin === horaInicio) throw new Error('horaFin debe ser distinta de horaInicio');
  }

  if (repetir === 'once') {
    if (!FECHA_RE.test(fecha || '')) throw new Error('fecha inválida (formato YYYY-MM-DD)');
    if (fecha < hoyChile()) throw new Error('La fecha no puede ser en el pasado');
  } else if (repetir === 'weekly') {
    if (!Array.isArray(diasSemana) || !diasSemana.length || diasSemana.some(d => d < 0 || d > 6)) {
      throw new Error('diasSemana debe ser un array no vacío con valores 0-6');
    }
  } else {
    throw new Error("repetir debe ser 'once' o 'weekly'");
  }

  if (detectarConflicto(roomId, descripcion.trim(), horaInicio, horaFin || null, repetir, fecha, diasSemana || [])) {
    throw new Error('Ya existe una programación para este dispositivo que se superpone en horario y fecha. Cancela la anterior primero.');
  }

  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO comandos_programados
      (id, hotel_id, room_id, descripcion, pasos_inicio, pasos_fin, hora_inicio, hora_fin,
       repetir, fecha, dias_semana, origen, creado_por, estado, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'activo',?,?)
  `).run(
    id, hotelId, roomId, descripcion.trim(), JSON.stringify(pasosInicio), pasosFin ? JSON.stringify(pasosFin) : null,
    horaInicio, horaFin || null, repetir, repetir === 'once' ? fecha : null,
    repetir === 'weekly' ? JSON.stringify(diasSemana) : null, origen, creadoPor || null, ts, ts
  );

  return getById(id);
}

function getById(id) {
  return db.prepare('SELECT * FROM comandos_programados WHERE id = ?').get(id);
}

function listarActivosPorRoom(roomId) {
  return db.prepare(`
    SELECT * FROM comandos_programados WHERE room_id = ? AND estado = 'activo' ORDER BY hora_inicio ASC
  `).all(roomId);
}

function listarActivos() {
  return db.prepare("SELECT * FROM comandos_programados WHERE estado = 'activo'").all();
}

function cancelar(id) {
  const c = getById(id);
  if (!c || c.estado !== 'activo') return false;
  db.prepare("UPDATE comandos_programados SET estado = 'cancelado', updated_at = ? WHERE id = ?").run(now(), id);
  return true;
}

function marcarInicioEjecutado(id, fechaHoy) {
  db.prepare('UPDATE comandos_programados SET ultima_inicio = ?, updated_at = ? WHERE id = ?').run(fechaHoy, now(), id);
}

function marcarFinEjecutado(id, fechaHoy) {
  db.prepare('UPDATE comandos_programados SET ultima_fin = ?, updated_at = ? WHERE id = ?').run(fechaHoy, now(), id);
}

function marcarCompletado(id) {
  db.prepare("UPDATE comandos_programados SET estado = 'completado', updated_at = ? WHERE id = ?").run(now(), id);
}

function marcarFallido(id, motivo) {
  db.prepare("UPDATE comandos_programados SET estado = 'fallido', error = ?, updated_at = ? WHERE id = ?").run(motivo, now(), id);
}

module.exports = {
  crear, getById, listarActivosPorRoom, listarActivos, cancelar,
  marcarInicioEjecutado, marcarFinEjecutado, marcarCompletado, marcarFallido,
};
