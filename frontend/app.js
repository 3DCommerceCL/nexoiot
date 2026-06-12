'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Guest Room App · Frontend
// Flujo: URL /room/:token → GET /api/room/:token → render controls → POST /api/room/:token/command
// ─────────────────────────────────────────────────────────────────────────────

// URL base del backend.
// En local (file:// o localhost:3000): usa '/api' (mismo origen).
// En Netlify sin proxy: pon la URL completa en window.NEXO_API_URL dentro de index.html.
// En Netlify con proxy en netlify.toml: deja window.NEXO_API_URL = '' y Netlify redirige.
const API = ((window.NEXO_API_URL || '').replace(/\/$/, '') || '') + '/api';

// ── DATOS MOCK para modo estático (sin servidor) ──────────────────────────────
// Se usa cuando el archivo se abre directo desde el disco (file://)
const STATIC_DEMO = {
  roomId:    '101',
  roomName:  'Habitación 101',
  hotelName: 'Hotel Demo Plaza',
  guestName: 'Demo Huésped',
  checkin:   new Date(Date.now() - 1 * 86400000).toISOString(), // ayer
  checkout:  new Date(Date.now() + 2 * 86400000).toISOString(), // en 2 días
  demoMode:  true,
  plan:      'max_comfort',
  devices: {
    led_cama: {
      label: 'LED Bajo Cama', type: 'light_rgb', available: false,
      state: null
    },
    luz_techo: {
      label: 'Luz Techo', type: 'light_rgb', available: true,
      state: { on: true, intensity: 80, mode: 'white', colorTemp: 70, hue: 0, saturation: 1000 }
    },
    luz_velador1: {
      label: 'Luz Velador 1', type: 'light_rgb', available: true,
      state: { on: false, intensity: 70, mode: 'white', colorTemp: 30, hue: 0, saturation: 1000 }
    },
    luz_velador2: {
      label: 'Luz Velador 2', type: 'light_rgb', available: true,
      state: { on: false, intensity: 50, mode: 'white', colorTemp: 50, hue: 270, saturation: 1000 }
    },
    cortina: {
      label: 'Cortina', type: 'curtain', available: true,
      state: { control: 'stop', position: 45 }
    },
    enchufe: {
      label: 'Enchufe USB', type: 'switch_3ch', available: true,
      channels: ['Entrada 1', 'Entrada 2'],
      state: { ch1: false, ch2: false }
    },
  },
};

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
const app = {
  token:   null,
  config:  {},   // { key: { type, label, channels, available } }
  devices: {},   // { key: estado normalizado del dispositivo }
  plan:    'base', // 'base' | 'premium' | 'max_comfort'
  _timers: {},   // debounce timers para sliders
  _wheelOpen: {}, // { key: bool } — selector de color RGB abierto/cerrado
  _placeholder: {}, // estado local de funciones del plan (no conectadas a dispositivos reales)
};

// ── NIVELES DE PLAN ───────────────────────────────────────────────────────────
const PLAN_TIERS = { base: 0, premium: 1, max_comfort: 2 };
const planLevel = plan => PLAN_TIERS[plan] ?? 0;

// ── ESCENAS RÁPIDAS ───────────────────────────────────────────────────────────
const SCENES = {
  night: [
    { dev: 'luz_velador1', cmd: { on: false } },
    { dev: 'luz_velador2', cmd: { on: false } },
    { dev: 'luz_techo',    cmd: { on: false } },
    { dev: 'led_cama',     cmd: { on: true  } },
    { dev: 'cortina',      cmd: { control: 'close' }, optimistic: { position: 0 } },
  ],
  morning: [
    { dev: 'cortina',      cmd: { control: 'open' }, optimistic: { position: 100 } },
    { dev: 'luz_velador1', cmd: { on: true, intensity: 60, colorTemp: 70 } },
    { dev: 'luz_velador2', cmd: { on: true, intensity: 60, colorTemp: 70 } },
    { dev: 'luz_techo',    cmd: { on: true, intensity: 70, colorTemp: 80 } },
  ],
  relax: [
    { dev: 'luz_velador2', cmd: { on: true, hue: 270, saturation: 800 }, optimistic: { on: true, hue: 270, mode: 'colour' } },
    { dev: 'led_cama',     cmd: { on: true } },
    { dev: 'luz_velador1', cmd: { on: true, intensity: 15, colorTemp: 5 } },
    { dev: 'luz_techo',    cmd: { on: false } },
    { dev: 'cortina',      cmd: { position: 50 } },
  ],
  off: [
    { dev: 'luz_velador1', cmd: { on: false } },
    { dev: 'luz_velador2', cmd: { on: false } },
    { dev: 'luz_techo',    cmd: { on: false } },
    { dev: 'led_cama',     cmd: { on: false } },
    { dev: 'enchufe',      cmd: { ch1: false, ch2: false } },
  ],
};

// ── EXTRAER TOKEN DE LA URL ────────────────────────────────────────────────────
function getToken() {
  const m = window.location.pathname.match(/\/room\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  const p = new URLSearchParams(window.location.search);
  if (p.get('token')) return p.get('token');
  const h = window.location.hash.replace('#', '');
  return h.length >= 6 ? h : null;
}

// ── API CALLS ─────────────────────────────────────────────────────────────────
async function apiGet(token) {
  const res = await fetch(`${API}/room/${token}`);
  if (res.status === 401) throw new Error('TOKEN_INVALID');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

async function apiCommand(device, command) {
  // En modo estático (file://) no hay servidor — simular éxito
  if (window.location.protocol === 'file:') return { success: true };

  const res = await fetch(`${API}/room/${app.token}/command`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ device, command }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(body.error || `HTTP_${res.status}`);
  }
  return res.json();
}

// ── COMANDO CON OPTIMISTIC UI ─────────────────────────────────────────────────
async function doCmd(deviceKey, command) {
  const prev = { ...app.devices[deviceKey] };
  Object.assign(app.devices[deviceKey], command);
  updateCard(deviceKey);

  try {
    await apiCommand(deviceKey, command);
  } catch (err) {
    app.devices[deviceKey] = prev;
    updateCard(deviceKey);
    showToast('No se pudo ejecutar. Verifica la conexión.', 'error');
    console.error('[CMD]', deviceKey, command, err.message);
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── MODO ESTÁTICO: archivo abierto directamente desde el disco ──────────────
  // Para un preview rápido sin servidor. En producción siempre corre con Node.
  if (window.location.protocol === 'file:') {
    renderApp(STATIC_DEMO);
    return;
  }

  // ── MODO NORMAL: con servidor Express ──────────────────────────────────────
  app.token = getToken();

  if (!app.token) {
    showError('invalid');
    return;
  }

  try {
    const data = await apiGet(app.token);
    renderApp(data);
  } catch (err) {
    showError(err.message === 'TOKEN_INVALID' ? 'invalid' : 'server');
  }
});

function renderApp(data) {
  // Construir estado
  for (const [key, dev] of Object.entries(data.devices)) {
    app.config[key]  = { type: dev.type, label: dev.label, channels: dev.channels, available: dev.available };
    app.devices[key] = dev.state ? { ...dev.state } : {};
  }

  app.plan = data.plan || 'base';

  // Header
  document.getElementById('hotel-name').textContent  = data.hotelName;
  document.getElementById('room-name').textContent   = data.roomName;
  document.getElementById('guest-name').textContent  = `Hola, ${data.guestName.split(' ')[0]} 👋`;

  // Sidebar
  document.getElementById('sidebar-hotel').textContent = data.hotelName;
  document.getElementById('sidebar-room').textContent  = data.roomName;

  const co     = new Date(data.checkout);
  const coDate = co.toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
  const coTime = co.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('checkout-info').textContent = `📅 Check-out: ${coDate} a las ${coTime}`;

  startClock(co);

  // Vista Ajustes
  document.getElementById('set-hotel').textContent  = data.hotelName;
  document.getElementById('set-room').textContent   = data.roomName;
  document.getElementById('set-guest').textContent  = data.guestName;
  document.getElementById('set-checkout').textContent = `${coDate}, ${coTime}`;
  document.getElementById('set-mode').textContent   = data.demoMode ? 'Demostración' : 'En vivo';
  if (data.checkin) {
    const ci     = new Date(data.checkin);
    const ciDate = ci.toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
    const ciTime = ci.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
    document.getElementById('set-checkin').textContent = `${ciDate}, ${ciTime}`;
  }

  // Sensor de puerta en header
  const doorDev = data.devices.puerta;
  if (doorDev?.state?.open) {
    const ds = document.getElementById('door-status');
    ds.style.display = 'flex';
    ds.textContent   = '🚪 Puerta abierta';
  }

  // Banner demo
  if (data.demoMode) document.getElementById('demo-banner').style.display = 'block';

  // Grid de dispositivos
  renderGrid();

  // Funciones del plan (placeholders) y vista de clima
  renderPlanGrid();
  renderClimateView();

  // Ocultar el badge "Premium" del menú si el plan ya lo incluye
  if (planLevel(app.plan) >= PLAN_TIERS.premium) {
    document.querySelector('.nav-item[data-view="climate"] .premium-badge')?.classList.add('hidden');
  }

  // Mostrar app
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  // Listeners de escenas
  document.querySelectorAll('.scene-card').forEach(btn => {
    btn.addEventListener('click', () => applyScene(btn.dataset.scene));
  });

  // Delegación de eventos para los controles del grid
  const grid = document.getElementById('device-grid');
  grid.addEventListener('click',  handleGridClick);
  grid.addEventListener('input',  handleGridInput);
  grid.addEventListener('change', handleGridInput);

  // Delegación de eventos para las funciones del plan (placeholders)
  const planGrid = document.getElementById('plan-grid');
  planGrid.addEventListener('click',  handlePlanGridClick);
  planGrid.addEventListener('input',  handlePlanGridInput);
  planGrid.addEventListener('change', handlePlanGridInput);

  // Delegación de eventos para la vista de Clima (Premium)
  const climateContent = document.getElementById('climate-content');
  climateContent.addEventListener('click',  handlePlanGridClick);
  climateContent.addEventListener('input',  handlePlanGridInput);
  climateContent.addEventListener('change', handlePlanGridInput);

  // Navegación (sidebar y vistas)
  initNav();
}

// ── NAVEGACIÓN: SIDEBAR Y VISTAS ──────────────────────────────────────────────
function initNav() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const burger   = document.getElementById('hamburger-btn');

  function openSidebar()  { sidebar.classList.add('open');    backdrop.classList.add('open'); }
  function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }

  burger.addEventListener('click', openSidebar);
  backdrop.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      document.getElementById(`view-${view}`)?.classList.remove('hidden');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      closeSidebar();
    });
  });

  // Botón de soporte: llamar a recepción
  document.getElementById('call-reception-btn')?.addEventListener('click', () => {
    alert('Para contactar a recepción, marca el interno 0 desde el teléfono de tu habitación o acércate a recepción.');
  });
}

// ── ÍCONOS PERSONALIZADOS ─────────────────────────────────────────────────────
const ICON_BED = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20v3"/><path d="M2 20v-3"/><path d="M22 20v-3"/><path d="M4 10V6a1 1 0 0 1 1-1h6v5"/></svg>';
const ICON_LAMP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8l4 7H4z"/><line x1="12" y1="11" x2="12" y2="19"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
const ICON_CEILING_LAMP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="7"/><path d="M6 16l2-9h8l2 9z"/><line x1="6" y1="16" x2="18" y2="16"/></svg>';

const DEVICE_ICON_OVERRIDES = {
  led_cama:     ICON_BED,
  luz_velador1: ICON_LAMP,
  luz_velador2: ICON_LAMP,
  luz_techo:    ICON_CEILING_LAMP,
};
const deviceIcon = (key, fallback) => DEVICE_ICON_OVERRIDES[key] || fallback;

// ── RENDER GRID ────────────────────────────────────────────────────────────────
const CARD_ORDER = ['luz_velador1','luz_velador2','led_cama','luz_techo','cortina','enchufe'];

function renderGrid() {
  const grid = document.getElementById('device-grid');
  const keys = [
    ...CARD_ORDER.filter(k => app.config[k]),
    ...Object.keys(app.config).filter(k => !CARD_ORDER.includes(k) && k !== 'puerta'),
  ];
  grid.innerHTML = keys.map(buildCard).join('');
}

function updateCard(key) {
  const el = document.getElementById(`card-${key}`);
  if (el) el.outerHTML = buildCard(key);
}

function buildCard(key) {
  const cfg = app.config[key];
  if (!cfg) return '';
  if (!cfg.available) return buildOfflineCard(key, cfg);
  switch (cfg.type) {
    case 'light':     return buildLightCard(key);
    case 'light_rgb': return buildLEDCard(key);
    case 'curtain':   return buildCurtainCard(key);
    case 'switch':    return buildSwitchCard(key);
    case 'switch_3ch':return buildSwitch3CHCard(key);
    case 'ac':        return buildACCard(key);
    default:          return '';
  }
}

function buildOfflineCard(key, cfg) {
  return `<div class="device-card offline" id="card-${key}">
    <div class="card-head"><div class="card-ico-name"><span class="card-ico">⚠️</span><span class="card-label">${cfg.label}</span></div></div>
    <div class="offline-label">Dispositivo no disponible</div>
  </div>`;
}

// ── LIGHT CARD ────────────────────────────────────────────────────────────────
function buildLightCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const int = s.intensity ?? 50;
  const ct  = s.colorTemp ?? 50;

  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name">
        <span class="card-ico">${deviceIcon(key, '💡')}</span>
        <span class="card-label">${cfg.label}</span>
      </div>
      <div class="toggle ${on ? 'on' : ''}" data-key="${key}" data-action="toggle-light"></div>
    </div>
    <div class="card-status ${on ? 'on' : ''}">${on ? 'Encendida' : 'Apagada'}</div>
    ${on ? `
      <div class="slider-lbl">Intensidad</div>
      <div class="slider-row">
        <input type="range" min="5" max="100" value="${int}"
          data-key="${key}" data-action="intensity">
        <span class="slider-val">${int}%</span>
      </div>
      <div class="ct-row">
        <button class="ct-btn ${ct < 33 ? 'active' : ''}" data-key="${key}" data-ct="5">Cálido</button>
        <button class="ct-btn ${ct >= 33 && ct < 66 ? 'active' : ''}" data-key="${key}" data-ct="50">Neutro</button>
        <button class="ct-btn ${ct >= 66 ? 'active' : ''}" data-key="${key}" data-ct="95">Frío</button>
      </div>` : ''}
  </div>`;
}

// ── LED RGB CARD ──────────────────────────────────────────────────────────────
const WHEEL_RADIUS = 56; // px, debe coincidir con el tamaño definido en CSS

function buildLEDCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const int = s.intensity ?? 50;
  const ct  = s.colorTemp ?? 50;
  const mode = s.mode ?? 'white';
  const hue  = s.hue ?? 0;
  const sat  = s.saturation ?? 1000;
  const wheelOpen = !!app._wheelOpen[key];

  const isColour    = mode === 'colour';
  const colorPreview = `hsl(${hue}, 100%, 50%)`;

  // Posición del cursor sobre la rueda de color (hue=0 arriba, sentido horario)
  const r     = (sat / 1000) * WHEEL_RADIUS;
  const angle = (hue * Math.PI) / 180;
  const cx    = Math.sin(angle) * r;
  const cy    = -Math.cos(angle) * r;

  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name">
        <span class="card-ico">${deviceIcon(key, '💡')}</span>
        <span class="card-label">${cfg.label}</span>
      </div>
      <div class="toggle ${on ? 'on' : ''}" data-key="${key}" data-action="toggle-light"></div>
    </div>
    <div class="card-status ${on ? 'on' : ''}">${on ? 'Encendido' : 'Apagado'}</div>
    ${on ? `
      <div class="slider-lbl">Intensidad</div>
      <div class="slider-row">
        <input type="range" min="5" max="100" value="${int}"
          data-key="${key}" data-action="intensity">
        <span class="slider-val">${int}%</span>
      </div>
      <div class="ct-row">
        <button class="ct-btn ${!isColour && ct < 33 ? 'active' : ''}" data-key="${key}" data-ct="5">Cálido</button>
        <button class="ct-btn ${!isColour && ct >= 33 && ct < 66 ? 'active' : ''}" data-key="${key}" data-ct="50">Neutro</button>
        <button class="ct-btn ${!isColour && ct >= 66 ? 'active' : ''}" data-key="${key}" data-ct="95">Frío</button>
        <button class="ct-btn color-toggle-btn ${wheelOpen ? 'open' : ''}" data-key="${key}" data-action="toggle-wheel"
          style="${isColour ? `border-color:${colorPreview};color:${colorPreview}` : ''}">
          <span class="color-dot" style="background:${colorPreview}"></span> Color
        </button>
      </div>
      ${wheelOpen ? `
      <div class="color-wheel-wrap">
        <div class="color-wheel" data-key="${key}" data-action="pick-color">
          <div class="color-wheel-cursor" style="transform: translate(${cx}px, ${cy}px); background:${colorPreview}"></div>
        </div>
      </div>` : ''}` : ''}
  </div>`;
}

// ── CURTAIN CARD ──────────────────────────────────────────────────────────────
function buildCurtainCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const pos = s.position ?? 0;
  const lbl = pos === 0 ? 'Cerrada' : pos === 100 ? 'Abierta' : `${pos}% abierta`;

  return `<div class="device-card full-width" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🪟</span><span class="card-label">${cfg.label}</span></div>
      <span class="card-status" style="margin:0">${lbl}</span>
    </div>
    <div class="curtain-btns">
      <button class="curtain-btn" data-key="${key}" data-curtain="open">▲ Abrir</button>
      <button class="curtain-btn stop-btn" data-key="${key}" data-curtain="stop">⏹ Parar</button>
      <button class="curtain-btn" data-key="${key}" data-curtain="close">▼ Cerrar</button>
    </div>
    <div class="slider-lbl">Posición</div>
    <div class="slider-row">
      <input type="range" min="0" max="100" value="${pos}"
        data-key="${key}" data-action="curtain-pos">
      <span class="slider-val" id="curtain-val-${key}">${pos}%</span>
    </div>
  </div>`;
}

// ── SWITCH CARD ───────────────────────────────────────────────────────────────
function buildSwitchCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;

  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${on ? '🔌' : '⬜'}</span><span class="card-label">${cfg.label}</span></div>
      <div class="toggle ${on ? 'on' : ''}" data-key="${key}" data-action="toggle-switch"></div>
    </div>
    <div class="card-status ${on ? 'on' : ''}">${on ? 'Encendido' : 'Apagado'}</div>
  </div>`;
}

// ── SWITCH MULTI-CANAL (2 o 3 canales) ───────────────────────────────────────
function buildSwitch3CHCard(key) {
  const s    = app.devices[key] || {};
  const cfg  = app.config[key];
  // Usar los canales definidos en config; si no hay, asumir 3
  const chs  = cfg.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
  const vals = [s.ch1, s.ch2, s.ch3];
  const anyOn = vals.slice(0, chs.length).some(Boolean);

  // Generar una fila por cada canal definido (no siempre 3)
  const rows = chs.map((label, i) => `
    <div class="ch-row">
      <span class="ch-label">${label}</span>
      <div class="toggle ${vals[i] ? 'on' : ''}" data-key="${key}" data-action="toggle-ch${i + 1}"></div>
    </div>`).join('');

  const ico = chs.length <= 2 ? '🔌' : '⚡';

  return `<div class="device-card full-width ${anyOn ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${ico}</span><span class="card-label">${cfg.label}</span></div>
    </div>
    ${rows}
  </div>`;
}

// ── AC CARD ───────────────────────────────────────────────────────────────────
function buildACCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const temp = s.temp ?? 22;

  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">❄️</span><span class="card-label">${cfg.label}</span></div>
      <div class="toggle ${on ? 'on' : ''}" data-key="${key}" data-action="toggle-ac"></div>
    </div>
    <div class="ac-temp-display">
      <div class="ac-temp-val ${on ? 'on' : ''}">${temp}°C</div>
    </div>
    <div class="ac-temp-btns">
      <button class="ac-btn" data-key="${key}" data-temp="-1" ${on ? '' : 'disabled'}>−</button>
      <span class="ac-range">16 – 30°C</span>
      <button class="ac-btn" data-key="${key}" data-temp="+1" ${on ? '' : 'disabled'}>+</button>
    </div>
  </div>`;
}

// ── FUNCIONES DEL PLAN (placeholders no conectados a dispositivos reales) ────
const PLAN_FEATURES_INFO = {
  voice: {
    icon: '🔊', title: 'Control por Voz', minPlan: 'premium', badge: 'PREMIUM',
    desc: 'Controla tu habitación con Amazon Echo. Disponible en el plan Premium del hotel.',
  },
  bathroom: {
    icon: '🚿', title: 'Baño Inteligente', minPlan: 'max_comfort', addonFrom: 'base', badge: 'MAX COMFORT',
    desc: 'Sensor de presencia + luz inteligente en el baño. Incluido en el plan Max Comfort.',
  },
  bidet: {
    icon: '🚽', title: 'Baño Japonés', minPlan: 'max_comfort', badge: 'MAX COMFORT',
    desc: 'Bidé inteligente con asiento calefaccionado. Incluido en el plan Max Comfort.',
  },
  rug: {
    icon: '🔥', title: 'Alfombra Calefaccionable', minPlan: 'max_comfort', badge: 'MAX COMFORT',
    desc: 'Alfombra con calefacción para pie de cama o baño. Incluida en el plan Max Comfort.',
  },
};

function renderPlanGrid() {
  const grid = document.getElementById('plan-grid');
  grid.innerHTML = [
    buildTVCard(),
    buildFeatureCard('voice',    PLAN_FEATURES_INFO.voice,    buildVoiceCard),
    buildFeatureCard('bathroom', PLAN_FEATURES_INFO.bathroom, buildBathroomCard),
    buildFeatureCard('bidet',    PLAN_FEATURES_INFO.bidet,    buildBidetCard),
    buildFeatureCard('rug',      PLAN_FEATURES_INFO.rug,      buildRugCard),
  ].join('');
}

function buildFeatureCard(key, info, builder) {
  if (planLevel(app.plan) >= planLevel(info.minPlan)) return builder();
  return buildLockedCard(key, info);
}

function buildLockedCard(key, info) {
  const isAddon = info.addonFrom && planLevel(app.plan) >= planLevel(info.addonFrom);
  return `<div class="device-card feature-card locked" id="feature-${key}">
    <div class="feature-lock-icon">${info.icon}</div>
    <div class="feature-lock-title">${info.title}</div>
    <div class="feature-lock-desc">${info.desc}</div>
    ${isAddon
      ? `<span class="feature-addon-badge">Disponible como add-on</span>`
      : `<span class="feature-plan-badge">${info.badge}</span>`}
  </div>`;
}

// ── TV ────────────────────────────────────────────────────────────────────────
function buildTVCard() {
  const s = app._placeholder.tv ?? (app._placeholder.tv = { on: false, vol: 30, source: 'cable' });
  const sources = [
    { id: 'cable',   label: 'TV Cable' },
    { id: 'netflix', label: 'Streaming' },
    { id: 'hdmi',    label: 'HDMI' },
  ];
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-tv">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">📺</span><span class="card-label">TV</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="tv" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? 'Encendida' : 'Apagada'}</div>
    ${s.on ? `
      <div class="slider-lbl">Volumen</div>
      <div class="slider-row">
        <input type="range" min="0" max="100" value="${s.vol}" data-feature="tv" data-action="vol">
        <span class="slider-val">${s.vol}%</span>
      </div>
      <div class="source-row">
        ${sources.map(src => `<button class="source-btn ${s.source === src.id ? 'active' : ''}" data-feature="tv" data-action="source" data-source="${src.id}">${src.label}</button>`).join('')}
      </div>` : ''}
  </div>`;
}

// ── CONTROL POR VOZ (Echo) ────────────────────────────────────────────────────
function buildVoiceCard() {
  const s = app._placeholder.voice ?? (app._placeholder.voice = { on: true });
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-voice">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🔊</span><span class="card-label">Control por Voz</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="voice" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? 'Asistente activo (Amazon Echo)' : 'Modo privado — solo control por app'}</div>
    <div class="feature-row">
      <span class="feature-row-label"><span class="led-dot ${s.on ? 'on' : ''}"></span>LED indicador</span>
      <span class="preview-tag">${s.on ? 'Encendido' : 'Apagado'}</span>
    </div>
  </div>`;
}

// ── BAÑO INTELIGENTE (sensor de presencia + luz) ─────────────────────────────
function buildBathroomCard() {
  const s = app._placeholder.bathroom ?? (app._placeholder.bathroom = { presence: false, lightOn: false, intensity: 60, colorTemp: 50, auto: true });
  return `<div class="device-card full-width ${s.lightOn ? 'on' : ''}" id="feature-bathroom">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🚿</span><span class="card-label">Baño Inteligente</span></div>
      <div class="toggle ${s.lightOn ? 'on' : ''}" data-feature="bathroom" data-action="toggle"></div>
    </div>
    <div class="feature-row" data-action="presence" style="cursor:pointer">
      <span class="feature-row-label"><span class="led-dot ${s.presence ? 'on' : ''}"></span>Sensor de presencia</span>
      <span class="preview-tag">${s.presence ? 'Detectada' : 'Sin presencia'}</span>
    </div>
    <div class="feature-row">
      <span class="feature-row-label">Encendido automático con presencia</span>
      <div class="toggle ${s.auto ? 'on' : ''}" data-feature="bathroom" data-action="auto"></div>
    </div>
    <div class="card-status ${s.lightOn ? 'on' : ''}" style="margin-top:8px">${s.lightOn ? 'Luz encendida' : 'Luz apagada'}${s.auto ? ' · Programada para encenderse automáticamente si hay alguien dentro' : ''}</div>
    ${s.lightOn ? `
    <div class="slider-lbl">Intensidad</div>
    <div class="slider-row">
      <input type="range" min="5" max="100" value="${s.intensity}" data-feature="bathroom" data-action="intensity">
      <span class="slider-val">${s.intensity}%</span>
    </div>
    <div class="ct-row">
      <button class="ct-btn ${s.colorTemp < 33 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="5">Cálido</button>
      <button class="ct-btn ${s.colorTemp >= 33 && s.colorTemp < 66 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="50">Neutro</button>
      <button class="ct-btn ${s.colorTemp >= 66 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="95">Frío</button>
    </div>` : ''}
  </div>`;
}

// ── BAÑO JAPONÉS (bidé inteligente) ──────────────────────────────────────────
function buildBidetCard() {
  const s = app._placeholder.bidet ?? (app._placeholder.bidet = { on: false, heatedSeat: false, mode: null });
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-bidet">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🚽</span><span class="card-label">Baño Japonés</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="bidet" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? 'Encendido' : 'Apagado'}</div>
    ${s.on ? `
    <div class="feature-row">
      <span class="feature-row-label">Asiento calefaccionado</span>
      <div class="toggle ${s.heatedSeat ? 'on' : ''}" data-feature="bidet" data-action="heated"></div>
    </div>
    <div class="source-row">
      <button class="source-btn ${s.mode === 'wash' ? 'active' : ''}" data-feature="bidet" data-action="mode" data-mode="wash">💧 Lavado</button>
      <button class="source-btn ${s.mode === 'dry'  ? 'active' : ''}" data-feature="bidet" data-action="mode" data-mode="dry">🌬 Secado</button>
    </div>` : ''}
  </div>`;
}

// ── ALFOMBRA CALEFACCIONABLE ──────────────────────────────────────────────────
function buildRugCard() {
  const s = app._placeholder.rug ?? (app._placeholder.rug = { on: false, level: 'media' });
  const levels = [{ id: 'baja', label: 'Baja' }, { id: 'media', label: 'Media' }, { id: 'alta', label: 'Alta' }];
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-rug">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🔥</span><span class="card-label">Alfombra Calefaccionable</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="rug" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? 'Encendida' : 'Apagada'}</div>
    ${s.on ? `
    <div class="level-row">
      ${levels.map(l => `<button class="level-btn ${s.level === l.id ? 'active' : ''}" data-feature="rug" data-action="level" data-level="${l.id}">${l.label}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

// ── VISTA CLIMA (AC + sensor de ventana + automatizaciones, Premium+) ────────
function renderClimateView() {
  const el = document.getElementById('climate-content');

  if (planLevel(app.plan) < PLAN_TIERS.premium) {
    el.innerHTML = `<div class="premium-lock">
      <div class="premium-lock-icon">❄️</div>
      <h3>Control de Clima</h3>
      <p>Ajusta la temperatura de tu habitación, revisa el sensor de ventana y crea automatizaciones con el aire acondicionado. Esta función está disponible en el plan Premium del hotel.</p>
      <span class="premium-badge-lg">PREMIUM</span>
    </div>`;
    return;
  }

  const s = app._placeholder.climate ?? (app._placeholder.climate = { acOn: false, temp: 22, windowOpen: false, autoOff: true });

  el.innerHTML = `
    <div class="section-label">Aire Acondicionado</div>
    <div class="device-grid">
      <div class="device-card ${s.acOn ? 'on' : ''}" id="feature-ac">
        <div class="card-head">
          <div class="card-ico-name"><span class="card-ico">❄️</span><span class="card-label">Aire Acondicionado</span></div>
          <div class="toggle ${s.acOn ? 'on' : ''}" data-feature="climate" data-action="ac-toggle"></div>
        </div>
        <div class="ac-temp-display"><div class="ac-temp-val ${s.acOn ? 'on' : ''}">${s.temp}°C</div></div>
        <div class="ac-temp-btns">
          <button class="ac-btn" data-feature="climate" data-action="ac-temp" data-delta="-1" ${s.acOn ? '' : 'disabled'}>−</button>
          <span class="ac-range">16 – 30°C</span>
          <button class="ac-btn" data-feature="climate" data-action="ac-temp" data-delta="1" ${s.acOn ? '' : 'disabled'}>+</button>
        </div>
      </div>
      <div class="device-card ${s.windowOpen ? '' : 'on'}" id="feature-window">
        <div class="card-head">
          <div class="card-ico-name"><span class="card-ico">🪟</span><span class="card-label">Sensor de Ventana</span></div>
        </div>
        <div class="card-status ${s.windowOpen ? '' : 'on'}">${s.windowOpen ? 'Ventana abierta' : 'Ventana cerrada'}</div>
        <button class="curtain-btn" style="margin-top:8px;width:100%" data-feature="climate" data-action="window-toggle">Simular ${s.windowOpen ? 'cierre' : 'apertura'}</button>
      </div>
    </div>
    <div class="section-label" style="margin-top:18px">Automatizaciones</div>
    <div class="device-grid">
      <div class="device-card full-width">
        <div class="card-head">
          <div class="card-ico-name"><span class="card-ico">⚙️</span><span class="card-label">Apagar AC al abrir la ventana</span></div>
          <div class="toggle ${s.autoOff ? 'on' : ''}" data-feature="climate" data-action="auto-toggle"></div>
        </div>
        <div class="card-status">Si está activo, el AC se apaga automáticamente y se notifica a recepción cuando se detecta una ventana abierta.</div>
      </div>
    </div>
  `;
}

// ── EVENTOS: FUNCIONES DEL PLAN (placeholders) ───────────────────────────────
function rerenderFeature(key) {
  const builders = { tv: buildTVCard, voice: buildVoiceCard, bathroom: buildBathroomCard, bidet: buildBidetCard, rug: buildRugCard };
  const el = document.getElementById(`feature-${key}`);
  if (el && builders[key]) el.outerHTML = builders[key]();
}

function showPreviewToast() {
  showToast('Vista previa — función no conectada a un dispositivo real', '');
}

function handlePlanGridClick(e) {
  const tog = e.target.closest('[data-action="toggle"]');
  if (tog) {
    const key = tog.dataset.feature;
    const s = app._placeholder[key];
    if (key === 'bathroom') s.lightOn = !s.lightOn;
    else s.on = !s.on;
    rerenderFeature(key);
    showPreviewToast();
    return;
  }

  const bathroomAuto = e.target.closest('[data-feature="bathroom"][data-action="auto"]');
  if (bathroomAuto) {
    app._placeholder.bathroom.auto = !app._placeholder.bathroom.auto;
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  const bathroomCt = e.target.closest('[data-feature="bathroom"][data-action="ct"]');
  if (bathroomCt) {
    app._placeholder.bathroom.colorTemp = parseInt(bathroomCt.dataset.ct);
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  const presence = e.target.closest('[data-action="presence"]');
  if (presence) {
    app._placeholder.bathroom.presence = !app._placeholder.bathroom.presence;
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  const src = e.target.closest('[data-action="source"]');
  if (src) {
    app._placeholder.tv.source = src.dataset.source;
    rerenderFeature('tv');
    showPreviewToast();
    return;
  }

  const heated = e.target.closest('[data-action="heated"]');
  if (heated) {
    app._placeholder.bidet.heatedSeat = !app._placeholder.bidet.heatedSeat;
    rerenderFeature('bidet');
    showPreviewToast();
    return;
  }

  const mode = e.target.closest('[data-action="mode"]');
  if (mode) {
    const s = app._placeholder.bidet;
    s.mode = s.mode === mode.dataset.mode ? null : mode.dataset.mode;
    rerenderFeature('bidet');
    showPreviewToast();
    return;
  }

  const level = e.target.closest('[data-action="level"]');
  if (level) {
    app._placeholder.rug.level = level.dataset.level;
    rerenderFeature('rug');
    showPreviewToast();
    return;
  }

  const acTog = e.target.closest('[data-action="ac-toggle"]');
  if (acTog) {
    app._placeholder.climate.acOn = !app._placeholder.climate.acOn;
    renderClimateView();
    showPreviewToast();
    return;
  }

  const acTemp = e.target.closest('[data-action="ac-temp"]');
  if (acTemp && !acTemp.disabled) {
    const s = app._placeholder.climate;
    s.temp = Math.min(30, Math.max(16, s.temp + parseInt(acTemp.dataset.delta)));
    renderClimateView();
    showPreviewToast();
    return;
  }

  const winTog = e.target.closest('[data-action="window-toggle"]');
  if (winTog) {
    app._placeholder.climate.windowOpen = !app._placeholder.climate.windowOpen;
    renderClimateView();
    showPreviewToast();
    return;
  }

  const autoTog = e.target.closest('[data-action="auto-toggle"]');
  if (autoTog) {
    app._placeholder.climate.autoOff = !app._placeholder.climate.autoOff;
    renderClimateView();
    showPreviewToast();
    return;
  }
}

function handlePlanGridInput(e) {
  const vol = e.target.closest('input[data-feature="tv"][data-action="vol"]');
  if (vol) {
    const val = parseInt(vol.value);
    const valEl = vol.parentElement?.querySelector('.slider-val');
    if (valEl) valEl.textContent = val + '%';
    app._placeholder.tv.vol = val;
    return;
  }

  const intensity = e.target.closest('input[data-feature="bathroom"][data-action="intensity"]');
  if (intensity) {
    const val = parseInt(intensity.value);
    const valEl = intensity.parentElement?.querySelector('.slider-val');
    if (valEl) valEl.textContent = val + '%';
    app._placeholder.bathroom.intensity = val;
    return;
  }
}

// ── EVENT: CLICK EN EL GRID ───────────────────────────────────────────────────
function handleGridClick(e) {
  // Toggle genérico de luz/LED
  const tog = e.target.closest('[data-action^="toggle-light"]');
  if (tog) {
    const key = tog.dataset.key;
    doCmd(key, { on: !app.devices[key]?.on });
    return;
  }

  // Toggle de enchufe
  const sw = e.target.closest('[data-action="toggle-switch"]');
  if (sw) { doCmd(sw.dataset.key, { on: !app.devices[sw.dataset.key]?.on }); return; }

  // Toggle AC
  const ac = e.target.closest('[data-action="toggle-ac"]');
  if (ac) { doCmd(ac.dataset.key, { on: !app.devices[ac.dataset.key]?.on }); return; }

  // Toggle canales switch_3ch
  ['1','2','3'].forEach(n => {
    const ch = e.target.closest(`[data-action="toggle-ch${n}"]`);
    if (ch) {
      const key = ch.dataset.key;
      const prop = `ch${n}`;
      doCmd(key, { [prop]: !app.devices[key]?.[prop] });
    }
  });

  // Color temp buttons
  const ctBtn = e.target.closest('[data-ct]');
  if (ctBtn) {
    const key = ctBtn.dataset.key;
    const ct  = parseInt(ctBtn.dataset.ct);
    const cmd = { colorTemp: ct, mode: 'white' };
    if (!app.devices[key]?.on) cmd.on = true;
    app._wheelOpen[key] = false; // cerrar la rueda de color al elegir temperatura
    doCmd(key, cmd);
    return;
  }

  // Botones de cortina (open/stop/close)
  const cBtn = e.target.closest('[data-curtain]');
  if (cBtn) {
    const key = cBtn.dataset.key;
    const ctrl = cBtn.dataset.curtain;
    const optimistic = ctrl === 'open' ? { position: 100 } : ctrl === 'close' ? { position: 0 } : {};
    Object.assign(app.devices[key], optimistic);
    doCmd(key, { control: ctrl });
    return;
  }

  // Toggle del selector de color (rueda)
  const wheelBtn = e.target.closest('[data-action="toggle-wheel"]');
  if (wheelBtn) {
    const key = wheelBtn.dataset.key;
    const wasOpen   = !!app._wheelOpen[key];
    const isColour  = app.devices[key]?.mode === 'colour';
    app._wheelOpen[key] = !wasOpen;

    // Al abrir la rueda, activar modo color de inmediato (deselecciona Cálido/Neutro/Frío)
    if (!wasOpen && !isColour) {
      const hue = app.devices[key]?.hue ?? 0;
      const sat = app.devices[key]?.saturation ?? 1000;
      doCmd(key, { on: true, hue, saturation: sat, mode: 'colour' });
    } else {
      updateCard(key);
    }
    return;
  }

  // Click en la rueda de color → calcular hue desde el ángulo
  const wheel = e.target.closest('[data-action="pick-color"]');
  if (wheel) {
    const key  = wheel.dataset.key;
    const rect = wheel.getBoundingClientRect();
    const dx   = e.clientX - (rect.left + rect.width / 2);
    const dy   = e.clientY - (rect.top  + rect.height / 2);
    let hue    = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (hue < 0) hue += 360;
    doCmd(key, { on: true, hue: Math.round(hue), saturation: 1000, mode: 'colour' });
    return;
  }

  // AC +/−
  const acBtn = e.target.closest('[data-temp]');
  if (acBtn && !acBtn.disabled) {
    const key    = acBtn.dataset.key;
    const delta  = parseInt(acBtn.dataset.temp);
    const newTemp = Math.min(30, Math.max(16, (app.devices[key]?.temp ?? 22) + delta));
    doCmd(key, { temp: newTemp });
    return;
  }
}

// ── EVENT: INPUT EN EL GRID (sliders) ────────────────────────────────────────
function handleGridInput(e) {
  // Slider de intensidad
  const intSlider = e.target.closest('input[data-action="intensity"]');
  if (intSlider) {
    const key = intSlider.dataset.key;
    const val = parseInt(intSlider.value);
    // Actualizar display inmediatamente
    const valEl = intSlider.parentElement?.querySelector('.slider-val');
    if (valEl) valEl.textContent = val + '%';
    // Debounce a 250ms
    clearTimeout(app._timers[`int-${key}`]);
    app._timers[`int-${key}`] = setTimeout(() => doCmd(key, { intensity: val }), 250);
    return;
  }

  // Slider de posición de cortina
  const curtainSlider = e.target.closest('input[data-action="curtain-pos"]');
  if (curtainSlider) {
    const key = curtainSlider.dataset.key;
    const pos = parseInt(curtainSlider.value);
    const valEl = document.getElementById(`curtain-val-${key}`);
    if (valEl) valEl.textContent = pos + '%';
    clearTimeout(app._timers[`curtain-${key}`]);
    app._timers[`curtain-${key}`] = setTimeout(() => {
      app.devices[key].position = pos;
      doCmd(key, { position: pos });
    }, 250);
  }
}

// ── ESCENAS ───────────────────────────────────────────────────────────────────
async function applyScene(sceneName) {
  const scene = SCENES[sceneName];
  if (!scene) return;

  const btn = document.querySelector(`.scene-card[data-scene="${sceneName}"]`);
  if (btn) btn.classList.add('loading');

  // Filtrar solo los dispositivos que existen en esta habitación
  const steps = scene.filter(({ dev }) => app.config[dev]);

  // Optimistic: aplicar estados localmente
  steps.forEach(({ dev, cmd, optimistic }) => {
    Object.assign(app.devices[dev], cmd, optimistic || {});
  });
  renderGrid();

  try {
    await Promise.all(steps.map(({ dev, cmd }) => apiCommand(dev, cmd)));
    showToast('Escena aplicada', 'success');
  } catch {
    showToast('Algunos comandos fallaron', 'error');
  } finally {
    if (btn) btn.classList.remove('loading');
  }
}

// ── RELOJ EN TIEMPO REAL ──────────────────────────────────────────────────────
function startClock(checkoutDate) {
  const clockEl     = document.getElementById('live-clock');
  const countdownEl = document.getElementById('checkout-countdown');
  const coInfoEl    = document.getElementById('checkout-info');

  function tick() {
    const now  = new Date();
    const diff = checkoutDate - now; // ms

    // Hora actual (24 h para evitar confusión con a.m./p.m.)
    clockEl.textContent = now.toLocaleTimeString('es-CL', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

    if (diff > 0) {
      const d  = Math.floor(diff / 86_400_000);
      const h  = Math.floor((diff % 86_400_000) / 3_600_000);
      const m  = Math.floor((diff % 3_600_000)  / 60_000);
      const s  = Math.floor((diff % 60_000)      / 1_000);

      if (diff > 86_400_000) {
        // Más de 24 h → mostrar días para que se entienda de inmediato
        countdownEl.textContent = `Faltan ${d}d ${h}h ${m}m`;
        countdownEl.className   = 'countdown ok';
        coInfoEl.className      = 'checkout-info';
      } else if (diff > 14_400_000) {
        // 4 h – 24 h
        countdownEl.textContent = `Faltan ${h}h ${m}m`;
        countdownEl.className   = 'countdown ok';
        coInfoEl.className      = 'checkout-info';
      } else if (diff > 1_800_000) {
        // 30 min – 4 h
        countdownEl.textContent = `Faltan ${h > 0 ? h + 'h ' : ''}${m}m`;
        countdownEl.className   = 'countdown soon';
        coInfoEl.className      = 'checkout-info soon';
      } else {
        // Menos de 30 min — urgente con segundos
        countdownEl.textContent = `Faltan ${m}m ${s}s`;
        countdownEl.className   = 'countdown urgent';
        coInfoEl.className      = 'checkout-info soon';
      }
    } else {
      // Pasó el checkout
      const over = Math.abs(diff);
      const oh   = Math.floor(over / 3_600_000);
      const om   = Math.floor((over % 3_600_000) / 60_000);
      const os   = Math.floor((over % 60_000)    / 1_000);

      countdownEl.textContent = oh > 0
        ? `Vencido hace ${oh}h ${om}m`
        : om > 0
          ? `Vencido hace ${om}m ${os}s`
          : `Venció ahora`;
      countdownEl.className = 'countdown expired';
      coInfoEl.className    = 'checkout-info urgent';
    }
  }

  tick();
  setInterval(tick, 1000);
}

// ── CHECKOUT BUTTON ───────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  if (e.target.closest('.checkout-btn')) {
    alert('Para el check-out, por favor dirígete a recepción o llama al interno del hotel.');
  }
});

// ── ERROR SCREENS ─────────────────────────────────────────────────────────────
function showError(type) {
  document.getElementById('loading-screen').style.display = 'none';
  const es = document.getElementById('error-screen');
  es.classList.remove('hidden');

  if (type === 'invalid') {
    document.getElementById('err-icon').textContent  = '🔒';
    document.getElementById('err-title').textContent = 'Enlace inválido o expirado';
    document.getElementById('err-sub').textContent   = 'Este QR ya no es válido. Solicita un nuevo acceso en recepción.';
  } else {
    document.getElementById('err-icon').textContent  = '📡';
    document.getElementById('err-title').textContent = 'Sin conexión con el servidor';
    document.getElementById('err-sub').textContent   = 'No se pudo conectar con el sistema. Verifica tu conexión WiFi o comunícate con recepción.';
  }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s, transform .3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
