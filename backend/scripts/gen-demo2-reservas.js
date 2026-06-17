'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// gen-demo2-reservas.js — Genera reservas aleatorias para los hoteles demo-norte
// y demo-sur (creados por gen-demo2-hotels.js), entre el 18 de junio y el 18 de
// julio de 2026, para tener datos de muestra en el calendario/lista de reservas.
//
// Uso: node backend/scripts/gen-demo2-reservas.js
// Idempotente por ejecución: cada corrida agrega reservas nuevas (no borra las
// previas) — pensado para correr una sola vez por entorno (local o producción).
// ─────────────────────────────────────────────────────────────────────────────

const reservas = require('../reservas');
const rooms    = require('../rooms');

const HOTEL_IDS  = ['demo-norte', 'demo-sur'];
const RANGE_FROM = '2026-06-18';
const RANGE_TO   = '2026-07-18'; // exclusivo

const GUEST_NAMES = [
  'Camila Rojas', 'Matías Fuentes', 'Valentina Soto', 'Joaquín Pérez', 'Florencia Muñoz',
  'Tomás Araya', 'Antonia Castro', 'Sebastián Reyes', 'Martina Vidal', 'Benjamín Torres',
  'Isidora Contreras', 'Gabriel Morales', 'Fernanda Espinoza', 'Lucas Gómez', 'Constanza Silva',
  'Diego Cárdenas', 'Javiera Navarro', 'Felipe Bravo', 'Daniela Pizarro', 'Ignacio Vergara',
  'John Carter', 'Emma Wilson', 'Liam Smith', 'Sophia Brown', 'Lucas Müller',
];

const SOURCES = ['direct', 'direct', 'booking', 'booking', 'airbnb', 'expedia', 'despegar'];
const STATUSES = ['confirmed', 'confirmed', 'confirmed', 'pending', 'cancelled'];

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function totalDays(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000);
}

const totalRangeDays = totalDays(RANGE_FROM, RANGE_TO); // 30

let creadas = 0;

for (const hotelId of HOTEL_IDS) {
  const allRooms = Object.entries(rooms.getRooms()).filter(([, r]) => r.hotelId === hotelId);

  for (const [roomId] of allRooms) {
    // 1 a 3 estadías por habitación, sin solaparse, dentro del rango.
    const nStays = 1 + rand(3);
    let cursor = 0; // día relativo de inicio de búsqueda dentro del rango

    for (let i = 0; i < nStays && cursor < totalRangeDays - 1; i++) {
      const gap      = rand(3);            // días libres antes de la próxima estadía
      const checkinOffset = cursor + gap;
      if (checkinOffset >= totalRangeDays - 1) break;

      const nights   = 1 + rand(5);         // 1 a 5 noches
      const checkoutOffset = Math.min(checkinOffset + nights, totalRangeDays);

      const checkin  = addDays(RANGE_FROM, checkinOffset);
      const checkout = addDays(RANGE_FROM, checkoutOffset);

      reservas.createReserva(hotelId, roomId, pick(GUEST_NAMES), checkin, checkout, {
        source: pick(SOURCES),
        status: pick(STATUSES),
      });
      creadas++;

      cursor = checkoutOffset;
    }
  }
}

console.log(`Listo: ${creadas} reservas creadas para ${HOTEL_IDS.join(', ')} entre ${RANGE_FROM} y ${RANGE_TO}.`);
