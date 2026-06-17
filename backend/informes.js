'use strict';
// backend/informes.js — Informes de rendimiento: ADR, ALOS, ocupación, ingresos, comparación de período

const db = require('./db');

function metricas(hotelId, from, to, totalRooms) {
  const dias = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000));

  const reservasRango = db.prepare(
    'SELECT * FROM reservas WHERE hotel_id = ? AND checkin >= ? AND checkin < ?'
  ).all(hotelId, from, to);

  const activas     = reservasRango.filter(r => r.status !== 'cancelled');
  const canceladas  = reservasRango.filter(r => r.status === 'cancelled');

  let nochesOcupadas = 0;
  for (const r of activas) {
    const ci = new Date(Math.max(new Date(r.checkin + 'T00:00:00Z'), new Date(from + 'T00:00:00Z')));
    const co = new Date(Math.min(new Date(r.checkout + 'T00:00:00Z'), new Date(to + 'T00:00:00Z')));
    nochesOcupadas += Math.max(0, Math.round((co - ci) / 86400000));
  }

  const ingresos = db.prepare(`
    SELECT COALESCE(SUM(monto_clp), 0) as total FROM transacciones
    WHERE hotel_id = ? AND estado = 'aprobado'
      AND reserva_id IN (SELECT id FROM reservas WHERE hotel_id = ? AND checkin >= ? AND checkin < ?)
  `).get(hotelId, hotelId, from, to).total;

  const roomNightsDisponibles = totalRooms * dias;
  const adr        = nochesOcupadas > 0 ? Math.round(ingresos / nochesOcupadas) : 0;
  const alos        = activas.length > 0 ? +(nochesOcupadas / activas.length).toFixed(1) : 0;
  const ocupacion   = roomNightsDisponibles > 0 ? +((nochesOcupadas / roomNightsDisponibles) * 100).toFixed(1) : 0;

  return {
    periodo: { from, to, dias },
    totalReservas: activas.length,
    canceladas: canceladas.length,
    nochesOcupadas,
    ingresosCLP: ingresos,
    adrCLP: adr,
    alosNoches: alos,
    ocupacionPct: ocupacion,
  };
}

// Calcula el rango inmediatamente anterior, de la misma duración, para comparar.
function periodoAnterior(from, to) {
  const dias = Math.round((new Date(to) - new Date(from)) / 86400000);
  const prevTo   = from;
  const prevFrom = new Date(new Date(from + 'T00:00:00Z').getTime() - dias * 86400000).toISOString().slice(0, 10);
  return { prevFrom, prevTo };
}

module.exports = { metricas, periodoAnterior };
