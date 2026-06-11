'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Panel del Hotel
// Login con clave de administrador → ver habitaciones → generar/finalizar accesos
// ─────────────────────────────────────────────────────────────────────────────

const API_URL      = 'https://nexoiot-production.up.railway.app/api';
const FRONTEND_URL = 'https://3dcommercecl.github.io/nexoiot';
const KEY_STORAGE  = 'nexo_admin_key';

let currentRooms = [];
let checkinRoomId = null;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getAdminKey() {
  return sessionStorage.getItem(KEY_STORAGE) || '';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toLocalInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': getAdminKey(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error HTTP ${res.status}`);
  }
  return res.json();
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function login() {
  const key   = document.getElementById('login-key').value.trim();
  const error = document.getElementById('login-error');
  error.textContent = '';

  if (!key) { error.textContent = 'Ingresa la clave de acceso.'; return; }

  sessionStorage.setItem(KEY_STORAGE, key);
  try {
    await loadRooms();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  } catch (err) {
    sessionStorage.removeItem(KEY_STORAGE);
    error.textContent = 'Clave incorrecta o sin conexión.';
  }
}

function logout() {
  sessionStorage.removeItem(KEY_STORAGE);
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-key').value = '';
}

// ── ROOMS ─────────────────────────────────────────────────────────────────────
async function loadRooms() {
  currentRooms = await apiFetch('/admin/rooms');
  renderRooms();

  const hotelName = currentRooms[0]?.hotel || 'Panel del Hotel';
  document.getElementById('dash-hotel').textContent = hotelName;
}

function renderRooms() {
  const grid = document.getElementById('rooms-grid');
  grid.innerHTML = '';

  currentRooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'room-card';

    const busy = !!room.guest;

    const top = document.createElement('div');
    top.className = 'room-card-top';
    top.innerHTML = `
      <div>
        <div class="room-card-name"></div>
        <div class="room-card-meta"></div>
      </div>
      <div class="room-status ${busy ? 'busy' : 'free'}">${busy ? 'Ocupada' : 'Disponible'}</div>
    `;
    top.querySelector('.room-card-name').textContent = room.name;
    top.querySelector('.room-card-meta').textContent = room.floor != null ? `Piso ${room.floor}` : '';
    card.appendChild(top);

    if (busy) {
      const info = document.createElement('div');
      info.className = 'guest-info';
      info.innerHTML = `
        <div><span class="label">Huésped: </span><span class="g-name"></span></div>
        <div><span class="label">Check-out: </span><span class="g-checkout"></span></div>
      `;
      info.querySelector('.g-name').textContent     = room.guest.guestName;
      info.querySelector('.g-checkout').textContent = fmtDate(room.guest.checkout);
      card.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'room-actions';

      const qrBtn = document.createElement('button');
      qrBtn.className = 'btn-secondary';
      qrBtn.textContent = 'Ver QR';
      qrBtn.addEventListener('click', () => showQr(room.guest.token, room.guest.guestName, room.guest.phone));

      const endBtn = document.createElement('button');
      endBtn.className = 'btn-ghost';
      endBtn.textContent = 'Finalizar';
      endBtn.addEventListener('click', () => endStay(room.guest.token));

      actions.append(qrBtn, endBtn);
      card.appendChild(actions);
    } else {
      const actions = document.createElement('div');
      actions.className = 'room-actions';

      const ciBtn = document.createElement('button');
      ciBtn.className = 'btn-primary';
      ciBtn.textContent = 'Nuevo Check-in';
      ciBtn.addEventListener('click', () => openCheckin(room.id, room.name));

      actions.appendChild(ciBtn);
      card.appendChild(actions);
    }

    grid.appendChild(card);
  });
}

// ── CHECK-IN ──────────────────────────────────────────────────────────────────
function openCheckin(roomId, roomName) {
  checkinRoomId = roomId;
  document.getElementById('checkin-title').textContent = `Nuevo Check-in — ${roomName}`;
  document.getElementById('ci-guest').value = '';
  document.getElementById('ci-phone').value = '';
  document.getElementById('ci-error').textContent = '';

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  document.getElementById('ci-checkin').value  = toLocalInputValue(now);
  document.getElementById('ci-checkout').value = toLocalInputValue(tomorrow);

  openModal('checkin-modal');
}

async function submitCheckin() {
  const error = document.getElementById('ci-error');
  error.textContent = '';

  const guestName = document.getElementById('ci-guest').value.trim();
  const phone     = document.getElementById('ci-phone').value.trim();
  const checkin   = document.getElementById('ci-checkin').value;
  const checkout  = document.getElementById('ci-checkout').value;

  if (!guestName || !checkin || !checkout) {
    error.textContent = 'Completa nombre, check-in y check-out.';
    return;
  }

  try {
    const result = await apiFetch('/admin/token', {
      method: 'POST',
      body: JSON.stringify({ roomId: checkinRoomId, guestName, phone, checkin, checkout }),
    });
    closeModal('checkin-modal');
    await loadRooms();
    showQr(result.token, guestName, phone, result.guestUrl);
  } catch (err) {
    error.textContent = err.message;
  }
}

// ── FINALIZAR ESTADÍA ─────────────────────────────────────────────────────────
async function endStay(token) {
  if (!confirm('¿Finalizar la estadía y desactivar el acceso de este huésped?')) return;
  try {
    await apiFetch(`/admin/token/${token}`, { method: 'DELETE' });
    await loadRooms();
  } catch (err) {
    alert(err.message);
  }
}

// ── QR ────────────────────────────────────────────────────────────────────────
function showQr(token, guestName, phone, guestUrl) {
  const url = guestUrl || `${FRONTEND_URL}/?token=${token}`;
  document.getElementById('qr-img').src =
    `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
  document.getElementById('qr-link').textContent = url;

  const copyBtn = document.getElementById('qr-copy');
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(url).then(() => {
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => { copyBtn.textContent = 'Copiar enlace'; }, 1500);
    });
  };

  const waBtn = document.getElementById('qr-whatsapp');
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits) {
    const msg = `¡Hola ${guestName}! Te damos la bienvenida. Aquí tienes el acceso al control inteligente de tu habitación: ${url}`;
    waBtn.href = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    waBtn.classList.remove('hidden');
  } else {
    waBtn.classList.add('hidden');
  }

  openModal('qr-modal');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('login-key').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('refresh-btn').addEventListener('click', loadRooms);
  document.getElementById('ci-submit').addEventListener('click', submitCheckin);

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => { if (e.target === bd) bd.classList.add('hidden'); });
  });

  if (getAdminKey()) {
    loadRooms()
      .then(() => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
      })
      .catch(() => sessionStorage.removeItem(KEY_STORAGE));
  }
});
