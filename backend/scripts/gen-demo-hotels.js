'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// gen-demo-hotels.js — Genera 8 hoteles de prueba con 100 habitaciones c/u
// (5 pisos x 20 habitaciones), con mezcla de planes base/premium/max_comfort
// y dispositivos demo_* (siempre simulados por tuya.js, sin tocar Tuya real).
//
// Uso: node backend/scripts/gen-demo-hotels.js
// Agrega los datos a rooms.json / hotels.json / tokens.json sin tocar lo
// existente (Hotel Demo Plaza, Nexo IoT — Demo, FEEDBACK01, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ROOMS_FILE  = path.join(__dirname, '../data/rooms.json');
const HOTELS_FILE = path.join(__dirname, '../data/hotels.json');
const TOKENS_FILE = path.join(__dirname, '../data/tokens.json');

const HOTELS = [
  { id: 'pacifico-suites', name: 'Hotel Pacífico Suites', location: 'Viña del Mar, Chile' },
  { id: 'andes-lodge',     name: 'Hotel Andes Lodge',     location: 'Pucón, Chile' },
  { id: 'costa-norte',     name: 'Hotel Costa Norte',     location: 'Antofagasta, Chile' },
  { id: 'patagonia-inn',   name: 'Hotel Patagonia Inn',   location: 'Puerto Varas, Chile' },
  { id: 'cumbres-valle',   name: 'Hotel Cumbres del Valle', location: 'Santa Cruz, Chile' },
  { id: 'mirador-centro',  name: 'Hotel Mirador Centro',  location: 'Concepción, Chile' },
  { id: 'desierto-real',   name: 'Hotel Desierto Real',   location: 'San Pedro de Atacama, Chile' },
  { id: 'bahia-azul',      name: 'Hotel Bahía Azul',      location: 'Valdivia, Chile' },
];

const GUEST_NAMES = [
  'Camila Rojas', 'Matías Fuentes', 'Valentina Soto', 'Joaquín Pérez', 'Florencia Muñoz',
  'Tomás Araya', 'Antonia Castro', 'Sebastián Reyes', 'Martina Vidal', 'Benjamín Torres',
  'Isidora Contreras', 'Gabriel Morales', 'Fernanda Espinoza', 'Lucas Gómez', 'Constanza Silva',
  'Diego Cárdenas', 'Javiera Navarro', 'Felipe Bravo', 'Daniela Pizarro', 'Ignacio Vergara',
];

// ── PLAN POR HABITACIÓN ───────────────────────────────────────────────────────
// Distribución determinista: 50% base, 30% premium, 20% max_comfort
function planFor(roomNum) {
  const m = roomNum % 10;
  if (m < 5) return 'base';
  if (m < 8) return 'premium';
  return 'max_comfort';
}

// ── DISPOSITIVOS POR PLAN ─────────────────────────────────────────────────────
// Todos los planes incluyen lo "base": puerta, luz techo, 1 velador, cortina, enchufe.
// Premium/Max Comfort suman 2do velador, LED bajo cama y un canal extra de enchufe.
function devicesFor(plan, prefix) {
  const id = key => `demo_${prefix}_${key}`;
  const devices = {
    puerta: { deviceId: id('puerta'), type: 'door_sensor', label: 'Sensor de Puerta' },
    luz_techo: { deviceId: id('luz_techo'), type: 'light_rgb', label: 'Luz Techo' },
    luz_velador1: { deviceId: id('luz_velador1'), type: 'light_rgb', label: 'Luz Velador 1' },
    cortina: { deviceId: id('cortina'), type: 'curtain', label: 'Cortina' },
    enchufe: { deviceId: id('enchufe'), type: 'switch_3ch', label: 'Enchufe USB', channels: ['Entrada 1'] },
  };
  if (plan !== 'base') {
    devices.luz_velador2 = { deviceId: id('luz_velador2'), type: 'light_rgb', label: 'Luz Velador 2' };
    devices.led_cama     = { deviceId: id('led_cama'),     type: 'light_rgb', label: 'LED Bajo Cama' };
    devices.enchufe.channels = ['Entrada 1', 'Entrada 2'];
  }
  return devices;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const rooms  = readJSON(ROOMS_FILE);
const hotels = readJSON(HOTELS_FILE);
const tokens = readJSON(TOKENS_FILE);

const now = new Date();

HOTELS.forEach((hotel, hIdx) => {
  hotels[hotel.id] = { name: hotel.name, location: hotel.location };

  for (let floor = 1; floor <= 5; floor++) {
    for (let n = 1; n <= 20; n++) {
      const roomNum = floor * 100 + n; // 101..120, 201..220, ... 501..520
      const roomId  = `${hotel.id}-${roomNum}`;
      const plan    = planFor(roomNum);
      const prefix  = `${hotel.id}_${roomNum}`;

      rooms[roomId] = {
        name: `Habitación ${roomNum}`,
        hotel: hotel.name,
        hotelId: hotel.id,
        floor,
        plan,
        devices: devicesFor(plan, prefix),
      };

      // ── OCUPACIÓN DEMO (≈60% ocupadas, con check-outs hoy/mañana/futuros) ──
      const seed = hIdx * 1000 + roomNum;
      if (seed % 10 < 6) {
        const checkoutOffsetDays = seed % 5; // 0=hoy, 1=mañana, 2-4=futuro
        const checkinOffsetDays  = 2 + (seed % 3);
        const checkout = new Date(now);
        checkout.setDate(checkout.getDate() + checkoutOffsetDays);
        checkout.setHours(12, 0, 0, 0);
        const checkin = new Date(now);
        checkin.setDate(checkin.getDate() - checkinOffsetDays);
        checkin.setHours(14, 0, 0, 0);

        const tokenCode = `H${hIdx + 1}R${roomNum}`;
        tokens[tokenCode] = {
          roomId,
          guestName: GUEST_NAMES[seed % GUEST_NAMES.length],
          phone: `+5699${String(1000000 + seed).slice(-7)}`,
          checkin: checkin.toISOString(),
          checkout: checkout.toISOString(),
          active: true,
          createdAt: checkin.toISOString(),
        };
      }
    }
  }
});

writeJSON(ROOMS_FILE, rooms);
writeJSON(HOTELS_FILE, hotels);
writeJSON(TOKENS_FILE, tokens);

console.log(`Listo: ${HOTELS.length} hoteles x 100 habitaciones agregados.`);
