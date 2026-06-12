'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Panel del Hotel
// Login con clave de administrador → ver habitaciones, controlar dispositivos
// y generar/finalizar accesos QR de huéspedes.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL      = 'https://nexoiot-production.up.railway.app/api';
const FRONTEND_URL = 'https://3dcommercecl.github.io/nexoiot';
const KEY_STORAGE  = 'nexo_admin_key';
const HOTEL_ID     = new URLSearchParams(location.search).get('hotel');

const $ = id => document.getElementById(id);

// ── NIVELES DE PLAN ───────────────────────────────────────────────────────────
const PLAN_TIERS  = { base: 0, premium: 1, max_comfort: 2 };
const PLAN_LABELS = { base: 'Base', premium: 'Premium', max_comfort: 'Max Comfort' };
const planLevel   = plan => PLAN_TIERS[plan] ?? 0;

const PLAN_FEATURES_INFO = {
  voice: {
    icon: '🔊', title: 'Control por Voz', minPlan: 'premium', badge: 'PREMIUM',
    desc: 'Control con Amazon Echo. Disponible en el plan Premium.',
  },
  bathroom: {
    icon: '🚿', title: 'Baño Inteligente', minPlan: 'max_comfort', addonFrom: 'base', badge: 'MAX COMFORT',
    desc: 'Sensor de presencia + luz inteligente de baño. Incluido en Max Comfort.',
  },
  bidet: {
    icon: '🚽', title: 'Baño Japonés', minPlan: 'max_comfort', badge: 'MAX COMFORT',
    desc: 'Bidé inteligente con asiento calefaccionado. Incluido en Max Comfort.',
  },
  rug: {
    icon: '🔥', title: 'Alfombra Calefaccionable', minPlan: 'max_comfort', badge: 'MAX COMFORT',
    desc: 'Alfombra con calefacción para pie de cama o baño. Incluida en Max Comfort.',
  },
  climate: {
    icon: '❄️', title: 'Clima (AC + Ventana)', minPlan: 'premium', badge: 'PREMIUM',
    desc: 'Control de aire acondicionado, sensor de ventana y automatizaciones. Incluido en el plan Premium.',
  },
};

// ── ÍCONOS PERSONALIZADOS ─────────────────────────────────────────────────────
const ICON_BED = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20v3"/><path d="M2 20v-3"/><path d="M22 20v-3"/><path d="M4 10V6a1 1 0 0 1 1-1h6v5"/></svg>';
const ICON_LAMP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8l4 7H4z"/><line x1="12" y1="11" x2="12" y2="19"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
const ICON_CEILING_LAMP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="7"/><path d="M6 16l2-9h8l2 9z"/><line x1="6" y1="16" x2="18" y2="16"/></svg>';

const DEV_ICON_OVERRIDES = {
  led_cama:     ICON_BED,
  luz_velador1: ICON_LAMP,
  luz_velador2: ICON_LAMP,
  luz_techo:    ICON_CEILING_LAMP,
};

const state = {
  view: 'overview',
  filter: 'all',
  sidebarCollapsed: false,
  currentRoom: null,   // { id, token, devices, plan }
  placeholder: {},     // estado local de funciones del plan (no conectadas a dispositivos reales)
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
  const qs = HOTEL_ID ? `?hotel=${encodeURIComponent(HOTEL_ID)}` : '';
  rooms = await apiFetch(`/admin/rooms${qs}`);
  // Ordenar por piso y número de habitación (101..120, 201..220, ...)
  rooms.sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    const numA = parseInt((a.name.match(/\d+/) || [0])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || [0])[0], 10);
    return numA - numB;
  });
  $('hotel-name').textContent = rooms[0]?.hotel || 'Panel del Hotel';
  const back = $('back-to-nexo');
  if (back) back.classList.toggle('hidden', !HOTEL_ID);
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
  const planBadge = `<span class="badge badge-plan">${PLAN_LABELS[room.plan] || 'Base'}</span>`;
  if (room.guest) {
    const co = checkoutInfo(room.guest.checkout);
    return `
    <div class="room-card" id="rc-${room.id}">
      <div class="rc-top">
        <span class="rc-num">${room.name}</span>
      </div>
      <div class="rc-badges"><span class="badge badge-floor">Piso ${room.floor}</span>${planBadge}</div>
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
    </div>
    <div class="rc-badges"><span class="badge badge-available">Disponible</span>${planBadge}</div>
    <div class="rc-empty">Sin huésped — Piso ${room.floor}</div>
    <button class="btn btn-sm btn-outline-teal" style="margin-top:auto" onclick="openNewStayModal('${room.id}')">+ Asignar estadía</button>
  </div>`;
}

const expandedFloors = new Set();

window.toggleFloor = function(floor) {
  if (expandedFloors.has(floor)) expandedFloors.delete(floor);
  else expandedFloors.add(floor);
  renderRooms('rooms', state.filter);
};

function renderRooms(target = 'overview', filter = 'all') {
  let list = rooms;
  if (filter === 'occupied')  list = occupiedRooms();
  if (filter === 'available') list = availableRooms();

  if (target === 'rooms') {
    const floors = [...new Set(list.map(r => r.floor))].sort((a, b) => a - b);
    $(`room-grid-${target}`).innerHTML = floors.map(floor => {
      const floorRooms = list.filter(r => r.floor === floor);
      const expanded = expandedFloors.has(floor);
      return `<div class="floor-group">
        <div class="floor-header" onclick="toggleFloor(${floor})">
          <span class="floor-chevron ${expanded ? 'open' : ''}">▸</span>
          <span class="floor-title">Piso ${floor}</span>
          <span class="floor-count">${floorRooms.length} habitaciones</span>
        </div>
        <div class="room-grid floor-rooms ${expanded ? '' : 'collapsed'}">
          ${floorRooms.map(buildRoomCard).join('')}
        </div>
      </div>`;
    }).join('');
    return;
  }

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
    state.currentRoom = { id: room.id, token: room.guest.token, devices: data.devices, plan: room.plan || 'base' };
    state.placeholder = {
      tv:       { on: false, vol: 30, source: 'cable' },
      voice:    { on: true },
      bathroom: { presence: false, lightOn: false, intensity: 60, colorTemp: 50, auto: true },
      bidet:    { on: false, heatedSeat: false, mode: null },
      rug:      { on: false, level: 'media' },
      climate:  { acOn: false, temp: 22, windowOpen: false, autoOff: true },
    };
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
  const { devices, plan } = state.currentRoom;
  const cards = Object.entries(devices).map(([key, dev]) => buildDeviceCard(key, dev));
  cards.push(buildTVCard());
  cards.push(buildFeatureCard('voice',    PLAN_FEATURES_INFO.voice,    buildVoiceCard,    plan));
  if (planLevel(plan) >= PLAN_TIERS.premium) {
    cards.push(buildACCard());
    cards.push(buildWindowCard());
    cards.push(buildAutomationCard());
  } else {
    cards.push(buildLockedCard('climate', PLAN_FEATURES_INFO.climate, plan));
  }
  cards.push(buildFeatureCard('bathroom', PLAN_FEATURES_INFO.bathroom, buildBathroomCard, plan));
  cards.push(buildFeatureCard('bidet',    PLAN_FEATURES_INFO.bidet,    buildBidetCard,    plan));
  cards.push(buildFeatureCard('rug',      PLAN_FEATURES_INFO.rug,      buildRugCard,      plan));
  $('dev-grid').innerHTML = cards.join('');
}

// ── FUNCIONES DEL PLAN (placeholders no conectados a dispositivos reales) ────
function buildFeatureCard(key, info, builder, plan) {
  if (planLevel(plan) >= planLevel(info.minPlan)) return builder();
  return buildLockedCard(key, info, plan);
}

function buildLockedCard(key, info, plan) {
  const isAddon = info.addonFrom && planLevel(plan) >= planLevel(info.addonFrom);
  return `<div class="dev-card feature-card locked">
    <div class="feature-lock-icon">${info.icon}</div>
    <div class="feature-lock-title">${info.title}</div>
    <div class="feature-lock-desc">${info.desc}</div>
    ${isAddon
      ? `<span class="feature-addon-badge">Disponible como add-on</span>`
      : `<span class="feature-plan-badge">${info.badge}</span>`}
  </div>`;
}

function buildTVCard() {
  const s = state.placeholder.tv;
  const sources = [
    { id: 'cable',   label: 'TV Cable' },
    { id: 'netflix', label: 'Streaming' },
    { id: 'hdmi',    label: 'HDMI' },
  ];
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">📺</span> TV</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('tv')"></div>
    </div>
    <div class="${s.on ? '' : 'dev-dimmed'}">
      <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? 'Encendida' : 'Apagada'}</div>
      <div class="slider-wrap">
        <input type="range" min="0" max="100" value="${s.vol}" ${s.on ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setFeatureVal('tv','vol',this.value)">
        <span class="slider-val">${s.vol}%</span>
      </div>
      <div class="source-row">
        ${sources.map(src => `<button class="source-btn ${s.source === src.id ? 'active' : ''}" onclick="setFeatureVal('tv','source','${src.id}')">${src.label}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

function buildVoiceCard() {
  const s = state.placeholder.voice;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🔊</span> Control por Voz</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('voice')"></div>
    </div>
    <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? 'Asistente activo (Echo)' : 'Modo privado — solo app'}</div>
    <div class="feature-row">
      <span class="feature-row-label"><span class="led-dot ${s.on ? 'on' : ''}"></span>LED indicador</span>
      <span class="preview-tag">${s.on ? 'Encendido' : 'Apagado'}</span>
    </div>
  </div>`;
}

function buildBathroomCard() {
  const s = state.placeholder.bathroom;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🚿</span> Baño Inteligente</div>
      <div class="toggle-sw ${s.lightOn ? 'on' : ''}" onclick="toggleFeature('bathroom')"></div>
    </div>
    <div class="feature-row" style="cursor:pointer" onclick="togglePresence()">
      <span class="feature-row-label"><span class="led-dot ${s.presence ? 'on' : ''}"></span>Sensor de presencia</span>
      <span class="preview-tag">${s.presence ? 'Detectada' : 'Sin presencia'}</span>
    </div>
    <div class="feature-row">
      <span class="feature-row-label">Encendido automático con presencia</span>
      <div class="toggle-sw ${s.auto ? 'on' : ''}" onclick="toggleBathroomAuto()"></div>
    </div>
    <div class="${s.lightOn ? '' : 'dev-dimmed'}">
      <div class="dev-status ${s.lightOn ? 'on-label' : ''}" style="margin-top:6px">${s.lightOn ? 'Luz encendida' : 'Luz apagada'}</div>
      <div class="slider-wrap">
        <input type="range" min="5" max="100" value="${s.intensity}" ${s.lightOn ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setFeatureVal('bathroom','intensity',this.value)">
        <span class="slider-val">${s.intensity}%</span>
      </div>
      <div class="ct-row">
        <button class="ct-btn ${s.colorTemp < 33 ? 'active' : ''}" onclick="setFeatureVal('bathroom','colorTemp',5)">Cálido</button>
        <button class="ct-btn ${s.colorTemp >= 33 && s.colorTemp < 66 ? 'active' : ''}" onclick="setFeatureVal('bathroom','colorTemp',50)">Neutro</button>
        <button class="ct-btn ${s.colorTemp >= 66 ? 'active' : ''}" onclick="setFeatureVal('bathroom','colorTemp',95)">Frío</button>
      </div>
    </div>
  </div>`;
}

function buildBidetCard() {
  const s = state.placeholder.bidet;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🚽</span> Baño Japonés</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('bidet')"></div>
    </div>
    <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? 'Encendido' : 'Apagado'}</div>
    <div class="${s.on ? '' : 'dev-dimmed'}">
      <div class="feature-row">
        <span class="feature-row-label">Asiento calefaccionado</span>
        <div class="toggle-sw ${s.heatedSeat ? 'on' : ''}" onclick="toggleHeatedSeat()"></div>
      </div>
      <div class="source-row">
        <button class="source-btn ${s.mode === 'wash' ? 'active' : ''}" onclick="setBidetMode('wash')">💧 Lavado</button>
        <button class="source-btn ${s.mode === 'dry'  ? 'active' : ''}" onclick="setBidetMode('dry')">🌬 Secado</button>
      </div>
    </div>
  </div>`;
}

function buildRugCard() {
  const s = state.placeholder.rug;
  const levels = [{ id: 'baja', label: 'Baja' }, { id: 'media', label: 'Media' }, { id: 'alta', label: 'Alta' }];
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🔥</span> Alfombra Calefaccionable</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('rug')"></div>
    </div>
    <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? 'Encendida' : 'Apagada'}</div>
    <div class="level-row ${s.on ? '' : 'dev-dimmed'}">
      ${levels.map(l => `<button class="level-btn ${s.level === l.id ? 'active' : ''}" onclick="setRugLevel('${l.id}')">${l.label}</button>`).join('')}
    </div>
  </div>`;
}

// ── CLIMA (AC + ventana + automatización, Premium+) ──────────────────────────
function buildACCard() {
  const s = state.placeholder.climate;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">❄️</span> Aire Acondicionado</div>
      <div class="toggle-sw ${s.acOn ? 'on' : ''}" onclick="toggleClimateAC()"></div>
    </div>
    <div class="ac-temp-display"><div class="ac-temp-val ${s.acOn ? 'on' : ''}">${s.temp}°C</div></div>
    <div class="ac-temp-btns">
      <button class="ac-btn" ${s.acOn ? '' : 'disabled'} onclick="setClimateTemp(-1)">−</button>
      <span class="ac-range">16 – 30°C</span>
      <button class="ac-btn" ${s.acOn ? '' : 'disabled'} onclick="setClimateTemp(1)">+</button>
    </div>
  </div>`;
}

function buildWindowCard() {
  const s = state.placeholder.climate;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🪟</span> Sensor de Ventana</div>
    </div>
    <div class="dev-status ${s.windowOpen ? '' : 'on-label'}">${s.windowOpen ? 'Ventana abierta' : 'Ventana cerrada'}</div>
    <button class="curtain-btn" style="width:100%;margin-top:8px" onclick="toggleWindow()">Simular ${s.windowOpen ? 'cierre' : 'apertura'}</button>
  </div>`;
}

function buildAutomationCard() {
  const s = state.placeholder.climate;
  return `<div class="dev-card" style="grid-column:1/-1">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">⚙️</span> Apagar AC al abrir la ventana</div>
      <div class="toggle-sw ${s.autoOff ? 'on' : ''}" onclick="toggleAutoOff()"></div>
    </div>
    <div class="dev-status">Si está activo, el AC se apaga automáticamente y se notifica a recepción cuando se detecta una ventana abierta.</div>
  </div>`;
}

window.toggleClimateAC = function() {
  state.placeholder.climate.acOn = !state.placeholder.climate.acOn;
  renderDevGrid();
  previewToast();
};

window.setClimateTemp = function(delta) {
  const s = state.placeholder.climate;
  s.temp = Math.min(30, Math.max(16, s.temp + delta));
  renderDevGrid();
  previewToast();
};

window.toggleWindow = function() {
  state.placeholder.climate.windowOpen = !state.placeholder.climate.windowOpen;
  renderDevGrid();
  previewToast();
};

window.toggleAutoOff = function() {
  state.placeholder.climate.autoOff = !state.placeholder.climate.autoOff;
  renderDevGrid();
  previewToast();
};

function previewToast() { showToast('Vista previa — función no conectada a un dispositivo real', ''); }

window.toggleFeature = function(key) {
  const s = state.placeholder[key];
  if (key === 'bathroom') s.lightOn = !s.lightOn; else s.on = !s.on;
  renderDevGrid();
  previewToast();
};

window.togglePresence = function() {
  state.placeholder.bathroom.presence = !state.placeholder.bathroom.presence;
  renderDevGrid();
  previewToast();
};

window.toggleBathroomAuto = function() {
  state.placeholder.bathroom.auto = !state.placeholder.bathroom.auto;
  renderDevGrid();
  previewToast();
};

window.toggleHeatedSeat = function() {
  state.placeholder.bidet.heatedSeat = !state.placeholder.bidet.heatedSeat;
  renderDevGrid();
  previewToast();
};

window.setBidetMode = function(mode) {
  const s = state.placeholder.bidet;
  s.mode = s.mode === mode ? null : mode;
  renderDevGrid();
  previewToast();
};

window.setRugLevel = function(level) {
  state.placeholder.rug.level = level;
  renderDevGrid();
  previewToast();
};

window.setFeatureVal = function(key, prop, val) {
  state.placeholder[key][prop] = (prop === 'vol' || prop === 'intensity' || prop === 'colorTemp') ? parseInt(val, 10) : val;
  if (prop === 'source' || prop === 'colorTemp') renderDevGrid();
  previewToast();
};

function buildManualRow(key, manual) {
  return `<div class="manual-row">
    <span>Modo manual</span>
    <div class="toggle-sw toggle-sw-sm ${manual ? 'on' : ''}" onclick="toggleManual('${key}')"></div>
  </div>
  ${manual ? '<div class="manual-note">Control manual activado — el huésped usa el interruptor físico de la habitación.</div>' : ''}`;
}

function buildUnlockRow(key, unlocked) {
  return `<div class="manual-row">
    <span>Desbloquear motor (manual)</span>
    <div class="toggle-sw toggle-sw-sm ${unlocked ? 'on' : ''}" onclick="toggleUnlock('${key}')"></div>
  </div>
  ${unlocked ? '<div class="manual-note">Motor desbloqueado — la cortina se mueve a mano y no responde a la app.</div>' : ''}`;
}

function buildDeviceCard(key, dev) {
  const ico = DEV_ICON_OVERRIDES[key] || DEV_ICONS[dev.type] || '🔧';
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
  const manual = !!dev.state.manual;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
      <div class="toggle-sw ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" onclick="toggleLight('${key}', ${!on})"></div>
    </div>
    <div class="${on && !manual ? '' : 'dev-dimmed'}">
      <div class="dev-status ${on && !manual ? 'on-label' : ''}">${manual ? 'Modo manual' : (on ? 'Encendida' : 'Apagada')}</div>
      <div class="slider-wrap">
        <input type="range" min="0" max="100" value="${dev.state.intensity}" ${on && !manual ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setIntensity('${key}', this.value)">
        <span class="slider-val">${dev.state.intensity}%</span>
      </div>
    </div>
    ${buildManualRow(key, manual)}
  </div>`;
}

function buildCurtainCard(key, dev, ico) {
  const pct = dev.state.position;
  const unlocked = !!dev.state.unlocked;
  const label = unlocked ? 'Manual' : (pct === 0 ? 'Cerrada' : pct === 100 ? 'Abierta' : `${pct}% abierta`);
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
    </div>
    <div class="curtain-btns">
      <button class="curtain-btn" onclick="setCurtain('${key}','open')" ${unlocked ? 'disabled' : ''}>Abrir</button>
      <button class="curtain-btn" onclick="setCurtain('${key}','stop')" ${unlocked ? 'disabled' : ''}>Parar</button>
      <button class="curtain-btn" onclick="setCurtain('${key}','close')" ${unlocked ? 'disabled' : ''}>Cerrar</button>
    </div>
    <div class="curtain-track"><div class="curtain-fill" style="width:${pct}%"></div></div>
    <div class="curtain-label">${label}</div>
    ${buildUnlockRow(key, unlocked)}
  </div>`;
}

function buildMultiSwitchCard(key, dev, ico) {
  const labels = dev.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
  const chKeys = ['ch1', 'ch2', 'ch3'].slice(0, labels.length);
  const manual = !!dev.state.manual;
  const rows = chKeys.map((ch, i) => {
    const on = dev.state[ch];
    return `<div style="display:flex;align-items:center;justify-content:space-between;${i ? 'margin-top:8px' : ''}">
      <span class="dev-status ${on && !manual ? 'on-label' : ''}" style="margin:0">${labels[i]}</span>
      <div class="toggle-sw ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" onclick="toggleMultiSwitch('${key}','${ch}', ${!on})"></div>
    </div>`;
  }).join('');
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
    </div>
    ${rows}
    ${buildManualRow(key, manual)}
  </div>`;
}

function buildSwitchCard(key, dev, ico) {
  const on = dev.state.on;
  const manual = !!dev.state.manual;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dev.label}</div>
      <div class="toggle-sw ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" onclick="toggleSwitch('${key}', ${!on})"></div>
    </div>
    <div class="dev-status ${on && !manual ? 'on-label' : ''}">${manual ? 'Modo manual' : (on ? 'Encendido' : 'Apagado')}</div>
    ${buildManualRow(key, manual)}
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

window.toggleManual = async function(key) {
  const dev = state.currentRoom.devices[key];
  dev.state.manual = !dev.state.manual;
  if (dev.state.manual && (dev.type === 'light' || dev.type === 'light_rgb')) {
    // En modo manual la luz queda fija encendida en cálido: el interruptor
    // físico la enciende/apaga como una luz normal.
    dev.state.on = true;
    dev.state.colorTemp = 5;
    renderDevGrid();
    await sendCommand(key, { on: true, mode: 'white', colorTemp: 5 });
    return;
  }
  renderDevGrid();
};

window.toggleUnlock = function(key) {
  const dev = state.currentRoom.devices[key];
  dev.state.unlocked = !dev.state.unlocked;
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
