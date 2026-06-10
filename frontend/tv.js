'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Pantalla de TV de la habitación
// Flujo: GET /api/tv/:roomId → muestra QR del huésped activo (o pantalla vacía)
// Se refresca solo cada minuto, por si cambia el huésped/token.
// ─────────────────────────────────────────────────────────────────────────────

const API = ((window.NEXO_API_URL || '').replace(/\/$/, '') || '') + '/api';

function getRoomId() {
  const p = new URLSearchParams(window.location.search);
  return p.get('room') || '101';
}

async function refresh() {
  const roomId = getRoomId();
  const screenEl = document.getElementById('tv-screen');
  const emptyEl  = document.getElementById('tv-empty');

  try {
    const res  = await fetch(`${API}/tv/${roomId}`);
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();

    if (data.active && data.url) {
      document.getElementById('tv-hotel').textContent = data.hotelName.toUpperCase();
      document.getElementById('tv-room').textContent  = data.roomName;
      document.getElementById('tv-qr-img').src =
        `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(data.url)}`;

      screenEl.classList.remove('hidden');
      emptyEl.classList.add('hidden');
    } else {
      document.getElementById('tv-empty-hotel').textContent = data.hotelName;

      screenEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('[TV]', err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  refresh();
  setInterval(refresh, 60_000); // re-chequea cada minuto
});
