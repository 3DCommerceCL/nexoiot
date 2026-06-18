'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// gen-demo2-hotels.js — Genera 2 hoteles demo con 40 habitaciones c/u
// (4 pisos x 10 habitaciones), para pruebas/muestras. La habitación 101 del
// primer hotel queda como "piloto" con los dispositivos Tuya reales ya
// registrados (los mismos de Hotel Demo Plaza / habitación "101").
//
// Uso: node backend/scripts/gen-demo2-hotels.js
// Agrega los datos a rooms.json / hotels.json sin tocar lo existente.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ROOMS_FILE  = path.join(__dirname, '../data/rooms.json');
const HOTELS_FILE = path.join(__dirname, '../data/hotels.json');

const HOTELS = [
  { id: 'demo-norte', name: 'Hotel Demo Norte', location: 'La Serena, Chile' },
  { id: 'demo-sur',   name: 'Hotel Demo Sur',   location: 'Puerto Montt, Chile' },
];

// Dispositivos Tuya reales registrados — copiados de rooms.json["101"] (Hotel Demo Plaza),
// la única habitación piloto con hardware físico conectado hoy.
const PILOT_DEVICES = {
  puerta:       { deviceId: 'eb24a9f06a4c32ba51p42s', type: 'door_sensor', label: 'Sensor de Puerta' },
  led_cama:     { deviceId: 'ebc06c6118bf9128ec9i9s', type: 'light_rgb',   label: 'LED Bajo Cama' },
  luz_techo:    { deviceId: 'eba435f5b263f3d00eerya', type: 'light_rgb',   label: 'Luz Techo' },
  luz_velador1: { deviceId: 'eba6a890c60baf97desmep', type: 'light_rgb',   label: 'Luz Velador 1' },
  luz_velador2: { deviceId: 'eb8b2178103676296ca2hk', type: 'light_rgb',   label: 'Luz Velador 2' },
  cortina:      { deviceId: 'ebaf8a7cc5374f6b26n4v6', type: 'curtain',     label: 'Cortina' },
  enchufe:      { deviceId: 'ebeffe2c971f4f2b88ciac', type: 'switch_3ch',  label: 'Enchufe USB', channels: ['Entrada 1', 'Entrada 2'] },
};

const PLANES = ['base', 'premium', 'max_comfort'];
function planAleatorio() {
  return PLANES[Math.floor(Math.random() * PLANES.length)];
}

function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8'); }

const rooms  = readJSON(ROOMS_FILE);
const hotels = readJSON(HOTELS_FILE);

HOTELS.forEach((hotel, hIdx) => {
  hotels[hotel.id] = { name: hotel.name, location: hotel.location };

  for (let floor = 1; floor <= 4; floor++) {
    for (let n = 1; n <= 10; n++) {
      const roomNum = floor * 100 + n; // 101..110, 201..210, 301..310, 401..410
      const roomId  = `${hotel.id}-${roomNum}`;
      const isPilot = hIdx === 0 && roomNum === 101;

      rooms[roomId] = {
        name: `Habitación ${roomNum}`,
        hotel: hotel.name,
        hotelId: hotel.id,
        floor,
        plan: isPilot ? 'premium' : planAleatorio(),
        categoriaId: null,
        // Sin piloto = sin dispositivos reales instalados todavía (como sería en la
        // práctica: el plan/categoría existe en el PMS, pero el hardware IoT solo se
        // activa en las habitaciones donde de verdad se instaló). La app del huésped
        // muestra la vista de soporte/PMS básico cuando devices está vacío.
        devices: isPilot ? PILOT_DEVICES : {},
      };
    }
  }
});

writeJSON(ROOMS_FILE, rooms);
writeJSON(HOTELS_FILE, hotels);

console.log(`Listo: ${HOTELS.length} hoteles x 40 habitaciones agregados. Piloto Tuya: demo-norte-101.`);
