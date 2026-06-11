'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Panel del Hotel
// Login con clave de administrador → ver habitaciones, controlar dispositivos
// y generar/finalizar accesos QR de huéspedes.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL      = 'https://nexoiot-production.up.railway.app/api';
const FRONTEND_URL = 'https://3dcommercecl.github.io/nexoiot';
const KEY_STORAGE  = 'nexo_admin_key';

const $ = id => document.getElementById(id);

const state = {
  view: 'overview',
  filter: 'all',
  sidebarCollapsed: false,
  currentRoom: null,   // { id, token, devices }
};

let rooms = []; // [{ id, name, hotel, floor, guest: {...} | null }]

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getAdminKey() { return sessionStorage.getItem(KEY_STORAGE) || ''; }

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

function toLocalInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function checkoutInfo(iso) {
  const checkout = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((checkout.setHours(0,0,0,0) - new Date(now).setHours(0,0,0,0)) / 86400000);
  const time = new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  if (diffDays <= 0) return { label: `Hoy ${time}`, urgency: 'today' };
  if (diffDays === 1) return { label: `Mañana ${time}`, urgency: 'tomorrow' };
  return { label: `En ${diffDays} días`, urgency: 'later' };
}

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

window.closeModal = function(id) {
  $(id).classList.add('hidden');
  if (id === 'modal-room') state.currentRoom = null;
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function login() {
  const key   = $('login-key').value.trim();
  const error = $('login-error');
  error.textContent = '';
  if (!key) { error.textContent = 'Ingresa la clave de acceso.'; return; }

  sessionStorage.setItem(KEY_STORAGE, key);
  try {
    await loadRooms();
    $('login-screen').classList.add('hidden');
    $('sidebar').classList.remove('hidden');
    $('main').classList.remove('hidden');
  } catch (err) {
    sessionStorage.removeItem(KEY_STORAGE);
    error.textContent = 'Clave incorrecta o sin conexión.';
  }
}

function logout() {
  sessionStorage.removeItem(KEY_STORAGE);
  $('sidebar').classList.add('hidden');
  $('main').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
  $('login-key').value = '';
}

// ── DATA ──────────────────────────────────────────────────────────────────────
async function loadRooms() {
  rooms = await apiFetch('/admin/rooms');
  $('hotel-name').textContent = rooms[0]?.hotel || 'Panel del Hotel';
  renderKPIs();
  renderRooms('overview');
  if (state.view === 'rooms') renderRooms('rooms', state.filter);
}

const occupiedRooms  = () => rooms.filter(r => r.guest);
const availableRooms = () => rooms.filter(r => !r.guest);
const todayCheckouts = () => occupiedRooms().filter(r => checkoutInfo(r.guest.checkout).urgency === 'today');

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs() {
  const occ   = occupiedRooms().length;
  const total = rooms.length;
  const pct   = total ? Math.round(occ / total * 100) : 0;
  const today = todayCheckouts();

  $('kpi-row').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Habitaciones ocupadas</div>
      <div class="kpi-value">${occ} <span style="font-size:16px;color:var(--text2);font-weight:500">/ ${total}</span></div>
      <div class="kpi-prog-track"><div class="kpi-prog-fill" style="width:${pct}%"></div></div>
      <div class="kpi-sub">${pct}% de ocupación</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Disponibles</div>
      <div class="kpi-value">${availableRooms().length}</div>
      <div class="kpi-sub">Listas para check-in</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Check-outs hoy</div>
      <div class="kpi-value">${today.length}</div>
      <div class="kpi-sub">${today.map(r => `Hab ${r.name}`).join(' · ') || 'Sin check-outs hoy'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total habitaciones</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-sub">Registradas en el sistema</div>
    </div>
  `;
}

// ── ROOM GRID ─────────────────────────────────────────────────────────────────
function buildRoomCard(room) {
  if (room.guest) {
    const co = checkoutInfo(room.guest.checkout);
    return `
    <div class="room-card" id="rc-${room.id}">
      <div class="rc-top">
        <span class="rc-num">${room.name}</span>
        <span class="badge badge-floor">Piso ${room.floor}</span>
      </div>
      <div class="rc-guest">${room.guest.guestName}</div>
      <div class="rc-checkout ${co.urgency}">${co.urgency === 'today' ? '⚠️' : '🗓'} ${co.label}</div>
      <div class="rc-footer">
        <div class="qr-status active"><span class="qr-dot"></span>QR activo</div>
        <button class="btn btn-sm btn-ghost" onclick="openRoomModal('${room.id}')">Ver →</button>
      </div>
    </div>`;
  }
  return `
  <div class="room-card" id="rc-${room.id}" style="border-style:dashed">
    <div class="rc-top">
      <span class="rc-num">${room.name}</span>
      <span class="badge badge-available">Disponible</span>
    </div>
    <div class="rc-empty">Sin huésped — Piso ${room.floor}</div>
    <button class="btn btn-sm btn-outline-teal" style="margin-top:auto" onclick="openNewStayModal('${room.id}')">+ Asignar estadía</button>
  </div>`;
}

function renderRooms(target = 'overview', filter = 'all') {
  let list = rooms;
  if (filter === 'occupied')  list = occupiedRooms();
  if (filter === 'available') list = availableRooms();
  $(`room-grid-${target}`).innerHTML = list.map(buildRoomCard).join('');
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const VIEW_TITLES = { overview: 'Vista general', rooms: 'Habitaciones', settings: 'Configuración' };

function navigate(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $('page-title').textContent = VIEW_TITLES[view] || view;
  if (view === 'rooms') renderRooms('rooms', state.filter);
}

// ── ROOM MODAL ────────────────────────────────────────────────────────────────
window.openRoomModal = async function(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room || !room.guest) return;

  $('mr-title').textContent    = `Habitación ${room.name}`;
  $('mr-subtitle').textContent = `${room.guest.guestName} · Check-out: ${checkoutInfo(room.guest.checkout).label}`;
  $('dev-grid').innerHTML = '<div class="kpi-sub">Cargando dispositivos…</div>';
  $('modal-room').classList.remove('hidden');

  try {
    const data = await apiFetch(`/room/${room.guest.token}`, { headers: {} });
    state.currentRoom = { id: room.id, token: room.guest.token, devices: data.devices };
    renderDevGrid();
    renderQRSection(room);
  } catch (err) {
    $('dev-grid').innerHTML = `<div class="kpi-sub">Error al cargar dispositivos: ${err.message}</div>`;
  }
};

const DEV_ICONS = {
  light: '💡', light_rgb: '💡', curtain: '🪟', switch_3ch: '🔌', switch: '🔌', door_sensor: '🚪',
};

function renderDevGrid() {
  const { devices } = state.currentRoom;
  $('dev-grid').innerHTML = Object.entries(devices).map(([key, dev]) => buildDeviceCard(key, dev)).join('');
}

function buildDeviceCard(key, dev) {
  const ico = DEV_ICONS[dev.type] || '🔧';
  if (!dev.available) {
    return `<div class="dev-card">
      <div class="dev-card-head"><div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div></div>
      <div class="dev-status">Sin conexión</div>
    </div>`;
  }
  switch (dev.type) {
    case 'light':
    case 'light_rgb':
      return buildLightCard(key, dev, ico);
    case 'curtain':
      return buildCurtainCard(key, dev, ico);
    case 'switch_3ch':
      return buildMultiSwitchCard(key, dev, ico);
    case 'switch':
      return buildSwitchCard(key, dev, ico);
    case 'door_sensor':
      return buildDoorCard(dev, ico);
    default:
      return '';
  }
}

function buildLightCard(key, dev, ico) {
  const on = dev.state.on;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
      <div class="toggle-sw ${on ? 'on' : ''}" onclick="toggleLight('${key}', ${!on})"></div>
    </div>
    <div class="${on ? '' : 'dev-dimmed'}">
      <div class="dev-status ${on ? 'on-label' : ''}">${on ? 'Encendida' : 'Apagada'}</div>
      <div class="slider-wrap">
        <input type="range" min="0" max="100" value="${dev.state.intensity}" ${on ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setIntensity('${key}', this.value)">
        <span class="slider-val">${dev.state.intensity}%</span>
      </div>
    </div>
  </div>`;
}

function buildCurtainCard(key, dev, ico) {
  const pct = dev.state.position;
  const label = pct === 0 ? 'Cerrada' : pct === 100 ? 'Abierta' : `${pct}% abierta`;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
    </div>
    <div class="curtain-btns">
      <button class="curtain-btn" onclick="setCurtain('${key}','open')">Abrir</button>
      <button class="curtain-btn" onclick="setCurtain('${key}','stop')">Parar</button>
      <button class="curtain-btn" onclick="setCurtain('${key}','close')">Cerrar</button>
    </div>
    <div class="curtain-track"><div class="curtain-fill" style="width:${pct}%"></div></div>
    <div class="curtain-label">${label}</div>
  </div>`;
}

function buildMultiSwitchCard(key, dev, ico) {
  const labels = dev.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
  const chKeys = ['ch1', 'ch2', 'ch3'].slice(0, labels.length);
  const rows = chKeys.map((ch, i) => {
    const on = dev.state[ch];
    return `<div style="display:flex;align-items:center;justify-content:space-between;${i ? 'margin-top:8px' : ''}">
      <span class="dev-status ${on ? 'on-label' : ''}" style="margin:0">${labels[i]}</span>
      <div class="toggle-sw ${on ? 'on' : ''}" onclick="toggleMultiSwitch('${key}','${ch}', ${!on})"></div>
    </div>`;
  }).join('');
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
    </div>
    ${rows}
  </div>`;
}

function buildSwitchCard(key, dev, ico) {
  const on = dev.state.on;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
      <div class="toggle-sw ${on ? 'on' : ''}" onclick="toggleSwitch('${key}', ${!on})"></div>
    </div>
    <div class="dev-status ${on ? 'on-label' : ''}">${on ? 'Encendido' : 'Apagado'}</div>
  </div>`;
}

function buildDoorCard(dev, ico) {
  const open = dev.state.open;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
    </div>
    <div class="door-badge ${open ? 'open' : 'closed'}">${open ? 'Abierta' : 'Cerrada'}</div>
  </div>`;
}

// ── DEVICE COMMANDS ───────────────────────────────────────────────────────────
async function sendCommand(device, command) {
  const { token } = state.currentRoom;
  await fetch(`${API_URL}/room/${token}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command }),
  });
}

window.toggleLight = async function(key, on) {
  state.currentRoom.devices[key].state.on = on;
  renderDevGrid();
  await sendCommand(key, { on });
};

window.setIntensity = async function(key, val) {
  state.currentRoom.devices[key].state.intensity = parseInt(val, 10);
  await sendCommand(key, { intensity: parseInt(val, 10) });
};

window.toggleMultiSwitch = async function(key, ch, on) {
  state.currentRoom.devices[key].state[ch] = on;
  renderDevGrid();
  await sendCommand(key, { [ch === 'ch1' ? 'ch1' : ch === 'ch2' ? 'ch2' : 'ch3']: on });
};

window.toggleSwitch = async function(key, on) {
  state.currentRoom.devices[key].state.on = on;
  renderDevGrid();
  await sendCommand(key, { on });
};

window.setCurtain = async function(key, control) {
  await sendCommand(key, { control });
  if (control === 'open')  state.currentRoom.devices[key].state.position = 100;
  if (control === 'close') state.currentRoom.devices[key].state.position = 0;
  renderDevGrid();
};

// ── QR SECTION ────────────────────────────────────────────────────────────────
function renderQRSection(room) {
  const url = `${FRONTEND_URL}/?token=${room.guest.token}`;
  $('mr-qr-section').classList.remove('hidden');
  $('qr-section').innerHTML = `
    <div class="qr-canvas"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" alt="QR"></div>
    <div class="qr-info">
      <div class="qr-info-label">Link de acceso del huésped</div>
      <div class="qr-url">${url}</div>
      <div class="qr-actions">
        <button class="btn btn-primary btn-sm" id="qr-wa-btn">📱 Enviar por WhatsApp</button>
        <button class="btn btn-outline btn-sm" id="qr-copy-btn">Copiar enlace</button>
        <button class="btn btn-danger-outline btn-sm" id="qr-end-btn">⏏ Finalizar estadía</button>
      </div>
    </div>
  `;

  $('qr-copy-btn').onclick = () => {
    navigator.clipboard.writeText(url).then(() => showToast('Enlace copiado', 'success'));
  };

  const waBtn = $('qr-wa-btn');
  const digits = (room.guest.phone || '').replace(/[^\d]/g, '');
  if (digits) {
    const msg = `¡Hola ${room.guest.guestName}! Te damos la bienvenida a ${room.hotel || 'tu hotel'}. Aquí tienes el acceso al control inteligente de tu habitación: ${url}`;
    waBtn.onclick = () => window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    waBtn.disabled = true;
    waBtn.title = 'El huésped no tiene teléfono registrado';
  }

  $('qr-end-btn').onclick = () => endStay(room.id, room.guest.token);
}

async function endStay(roomId, token) {
  if (!confirm('¿Finalizar la estadía y desactivar el acceso de este huésped?')) return;
  try {
    await apiFetch(`/admin/token/${token}`, { method: 'DELETE' });
    closeModal('modal-room');
    await loadRooms();
    showToast('Estadía finalizada', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── NEW STAY MODAL ────────────────────────────────────────────────────────────
window.openNewStayModal = function(preselectId = null) {
  renderNewStayForm(preselectId);
  $('modal-new-stay').classList.remove('hidden');
};

function renderNewStayForm(preselectId) {
  const avail = availableRooms();
  if (avail.length === 0) {
    $('new-stay-form-wrap').innerHTML = `<div class="placeholder-view" style="height:160px"><div class="ph-ico">🏨</div><p>No hay habitaciones disponibles</p></div>`;
    return;
  }
  const opts = avail.map(r => `<option value="${r.id}" ${r.id === preselectId ? 'selected' : ''}>${r.name}</option>`).join('');
  const now      = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

  $('new-stay-form-wrap').innerHTML = `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">Habitación disponible</label>
        <select class="form-input" id="ns-room">${opts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre del huésped</label>
        <input class="form-input" id="ns-guest" type="text" placeholder="Nombre completo">
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono WhatsApp</label>
        <input class="form-input" id="ns-phone" type="tel" placeholder="+56 9 1234 5678">
      </div>
      <div class="form-group">
        <label class="form-label">Check-in</label>
        <input class="form-input" id="ns-checkin" type="datetime-local" value="${toLocalInputValue(now)}">
      </div>
      <div class="form-group">
        <label class="form-label">Check-out</label>
        <input class="form-input" id="ns-checkout" type="datetime-local" value="${toLocalInputValue(tomorrow)}">
      </div>
    </div>
    <div class="form-error" id="ns-error"></div>
    <button class="btn btn-primary" style="width:100%;padding:12px;font-size:14px" id="ns-submit">
      Crear estadía y generar QR
    </button>
    <p class="form-note" style="margin-top:10px;text-align:center">
      El QR queda disponible para enviar por WhatsApp una vez creada la estadía.
    </p>
  `;

  $('ns-submit').addEventListener('click', submitNewStay);
}

async function submitNewStay() {
  const error    = $('ns-error');
  error.textContent = '';

  const roomId   = $('ns-room').value;
  const guest    = $('ns-guest').value.trim();
  const phone    = $('ns-phone').value.trim();
  const checkin  = $('ns-checkin').value;
  const checkout = $('ns-checkout').value;

  if (!guest || !checkin || !checkout) {
    error.textContent = 'Completa nombre, check-in y check-out.';
    return;
  }
  if (new Date(checkout) <= new Date(checkin)) {
    error.textContent = 'El check-out debe ser posterior al check-in.';
    return;
  }

  const btn = $('ns-submit');
  btn.innerHTML = '<span class="spinner"></span> Creando estadía...';
  btn.disabled = true;

  try {
    const result = await apiFetch('/admin/token', {
      method: 'POST',
      body: JSON.stringify({ roomId, guestName: guest, phone, checkin, checkout }),
    });
    closeModal('modal-new-stay');
    await loadRooms();
    showToast(`Estadía creada — QR listo para ${guest}`, 'success');

    const room = rooms.find(r => r.id === roomId);
    if (room && room.guest) openRoomModal(roomId);
  } catch (err) {
    error.textContent = err.message;
    btn.textContent = 'Crear estadía y generar QR';
    btn.disabled = false;
  }
}

// ── CLOCK ─────────────────────────────────────────────────────────────────────
function startClock() {
  const DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MONTH = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const update = () => {
    const n = new Date();
    const t = n.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('clock').textContent = `${DAYS[n.getDay()]} ${n.getDate()} ${MONTH[n.getMonth()]} · ${t}`;
  };
  update();
  setInterval(update, 1000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('login-btn').addEventListener('click', login);
  $('login-key').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('logout-btn').addEventListener('click', logout);
  $('btn-new-stay').addEventListener('click', () => openNewStayModal());

  $('sb-toggle').addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    $('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
  });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.view));
  });

  document.querySelectorAll('#filter-bar .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll('#filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRooms('rooms', state.filter);
    });
  });

  ['modal-room', 'modal-new-stay'].forEach(id => {
    $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => closeModal(m.id));
  });

  startClock();

  if (getAdminKey()) {
    loadRooms()
      .then(() => {
        $('login-screen').classList.add('hidden');
        $('sidebar').classList.remove('hidden');
        $('main').classList.remove('hidden');
      })
      .catch(() => sessionStorage.removeItem(KEY_STORAGE));
  }
});
