'use strict';
// backend/huespedes.js — CRM básico: buscador transversal de huéspedes + historial de estadías

const db = require('./db');

// Busca reservas por nombre/email/teléfono y las agrupa por huésped (email > teléfono > nombre,
// en ese orden de prioridad como identificador, porque el nombre solo puede repetirse entre personas).
function buscar(hotelId, query) {
  const like = `%${query.trim()}%`;
  const rows = db.prepare(`
    SELECT * FROM reservas
    WHERE hotel_id = ? AND (guest_name LIKE ? OR guest_email LIKE ? OR guest_phone LIKE ?)
    ORDER BY checkin DESC
  `).all(hotelId, like, like, like);

  const grupos = new Map();
  for (const r of rows) {
    const key = r.guest_email || r.guest_phone || r.guest_name;
    if (!grupos.has(key)) {
      grupos.set(key, {
        nombre: r.guest_name, email: r.guest_email, telefono: r.guest_phone,
        totalEstadias: 0, ultimaEstadia: null, reservas: [],
      });
    }
    const g = grupos.get(key);
    g.totalEstadias++;
    if (!g.ultimaEstadia || r.checkin > g.ultimaEstadia) g.ultimaEstadia = r.checkin;
    g.reservas.push(r);
  }
  return [...grupos.values()];
}

module.exports = { buscar };
