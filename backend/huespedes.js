'use strict';
// backend/huespedes.js — CRM básico: buscador transversal de huéspedes + historial de
// estadías + sugerencia de packs por reglas simples (no IA, decisión deliberada).

const db = require('./db');

// Identificador estable de huésped (email > teléfono > nombre, en ese orden de prioridad,
// porque el nombre solo puede repetirse entre personas). Normaliza trim+lowercase porque
// reservas.js guarda el email/teléfono tal cual los tipea recepción, sin normalizar — esta
// es la única fuente de verdad para agrupar reservas y para asociar notas/encuestas.
function guestKey(row) {
  return (row.guest_email || row.guest_phone || row.guest_name || '').trim().toLowerCase();
}

// Agrupa filas de reservas por huésped.
function agrupar(rows) {
  const grupos = new Map();
  for (const r of rows) {
    const key = guestKey(r);
    if (!grupos.has(key)) {
      grupos.set(key, {
        guestKey: key, nombre: r.guest_name, email: r.guest_email, telefono: r.guest_phone,
        totalEstadias: 0, ultimaEstadia: null, reservas: [],
      });
    }
    const g = grupos.get(key);
    g.totalEstadias++;
    if (!g.ultimaEstadia || r.checkin > g.ultimaEstadia) g.ultimaEstadia = r.checkin;
    g.reservas.push(r);
  }
  return [...grupos.values()].map(g => ({ ...g, packSugerido: sugerirPack(g) }));
}

// Busca por nombre/email/teléfono.
function buscar(hotelId, query) {
  const like = `%${query.trim()}%`;
  const rows = db.prepare(`
    SELECT * FROM reservas
    WHERE hotel_id = ? AND (guest_name LIKE ? OR guest_email LIKE ? OR guest_phone LIKE ?)
    ORDER BY checkin DESC
  `).all(hotelId, like, like, like);
  return agrupar(rows);
}

// Lista todos los huéspedes del hotel (sin filtro de texto), para la vista CRM al
// entrar sin haber buscado nada — ordenados por más frecuentes/recientes primero.
function listarTop(hotelId, limit = 30) {
  const rows = db.prepare(`SELECT * FROM reservas WHERE hotel_id = ? ORDER BY checkin DESC`).all(hotelId);
  return agrupar(rows)
    .sort((a, b) => b.totalEstadias - a.totalEstadias || b.ultimaEstadia.localeCompare(a.ultimaEstadia))
    .slice(0, limit);
}

const SEIS_MESES_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function sugerirPack({ totalEstadias, ultimaEstadia }) {
  if (totalEstadias >= 5) {
    return { id: 'vip', label: 'Pack VIP', desc: 'Late checkout + upgrade de habitación gratis' };
  }
  if (totalEstadias >= 3) {
    return { id: 'fidelidad', label: 'Pack Fidelidad', desc: '10% de descuento en su próxima estadía' };
  }
  if (totalEstadias === 1 && ultimaEstadia && (Date.now() - new Date(ultimaEstadia).getTime()) > SEIS_MESES_MS) {
    return { id: 'reactivacion', label: 'Pack Reactivación', desc: 'Oferta de bienvenida de regreso' };
  }
  return null;
}

// Huéspedes de ejemplo para hoteles que todavía no tienen estadías reales —
// pensados para mostrar los 3 packs posibles + el caso sin pack sugerido. Con
// id/room_id/status para que el modal de detalle también se vea completo.
const DATOS_DEMO = agrupar([
  { id: 'demo1', room_id: '101', status: 'checked_out', guest_name: 'Andrea Soto',   guest_email: 'andrea.soto@example.com',   guest_phone: '+56911111111', checkin: '2026-05-01', checkout: '2026-05-03' },
  { id: 'demo2', room_id: '102', status: 'checked_out', guest_name: 'Andrea Soto',   guest_email: 'andrea.soto@example.com',   guest_phone: '+56911111111', checkin: '2026-02-10', checkout: '2026-02-12' },
  { id: 'demo3', room_id: '101', status: 'checked_out', guest_name: 'Andrea Soto',   guest_email: 'andrea.soto@example.com',   guest_phone: '+56911111111', checkin: '2025-11-04', checkout: '2025-11-06' },
  { id: 'demo4', room_id: '103', status: 'checked_out', guest_name: 'Andrea Soto',   guest_email: 'andrea.soto@example.com',   guest_phone: '+56911111111', checkin: '2025-08-15', checkout: '2025-08-17' },
  { id: 'demo5', room_id: '101', status: 'checked_out', guest_name: 'Andrea Soto',   guest_email: 'andrea.soto@example.com',   guest_phone: '+56911111111', checkin: '2025-05-20', checkout: '2025-05-22' },
  { id: 'demo6', room_id: '104', status: 'checked_out', guest_name: 'Roberto Núñez', guest_email: 'roberto.nunez@example.com', guest_phone: '+56922222222', checkin: '2026-04-12', checkout: '2026-04-14' },
  { id: 'demo7', room_id: '102', status: 'checked_out', guest_name: 'Roberto Núñez', guest_email: 'roberto.nunez@example.com', guest_phone: '+56922222222', checkin: '2026-01-08', checkout: '2026-01-10' },
  { id: 'demo8', room_id: '104', status: 'checked_out', guest_name: 'Roberto Núñez', guest_email: 'roberto.nunez@example.com', guest_phone: '+56922222222', checkin: '2025-09-22', checkout: '2025-09-24' },
  { id: 'demo9', room_id: '103', status: 'checked_out', guest_name: 'Camila Reyes',  guest_email: 'camila.reyes@example.com',  guest_phone: '+56933333333', checkin: '2024-11-01', checkout: '2024-11-03' },
  { id: 'demo10', room_id: '101', status: 'confirmed',  guest_name: 'Felipe Castro', guest_email: 'felipe.castro@example.com', guest_phone: '+56944444444', checkin: '2026-06-01', checkout: '2026-06-04' },
]);

module.exports = { buscar, listarTop, sugerirPack, guestKey, DATOS_DEMO };
