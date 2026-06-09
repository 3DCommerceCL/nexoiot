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
  checkout:  new Date(Date.now() + 2 * 86400000).toISOString(), // en 2 días
  demoMode:  true,
  devices: {
    led_cama: {
      label: 'LED Bajo Cama', type: 'switch', available: true,
      state: { on: false }
    },
    luz_techo: {
      label: 'Luz Techo', type: 'light', available: true,
      state: { on: true, intensity: 80, colorTemp: 70 }
    },
    luz_velador1: {
      label: 'Luz Velador 1', type: 'light', available: true,
      state: { on: false, intensity: 70, colorTemp: 30 }
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
  _timers: {},   // debounce timers para sliders
};

// ── COLORES LED (paleta de 6 presets) ─────────────────────────────────────────
const LED_COLORS = [
  { label: 'Cálido',  bg: '#FFA040', ct: 0,   hue: null },   // colorTemp cálido
  { label: 'Neutro',  bg: '#FFE8C0', ct: 50,  hue: null },   // colorTemp neutro
  { label: 'Frío',    bg: '#C8E8FF', ct: 100, hue: null },   // colorTemp frío
  { label: 'Rojo',    bg: '#FF4040', ct: null, hue: 0,   sat: 1000 },
  { label: 'Violeta', bg: '#A855F7', ct: null, hue: 270, sat: 1000 },
  { label: 'Azul',    bg: '#4488FF', ct: null, hue: 240, sat: 1000 },
];

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
    { dev: 'luz_velador2', cmd: { on: true, hue: 270, saturation: 800 }, optimistic: { on: true, hue: 270 } },
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

  // Header
  document.getElementById('hotel-name').textContent  = data.hotelName;
  document.getElementById('room-name').textContent   = data.roomName;
  document.getElementById('guest-name').textContent  = `Hola, ${data.guestName.split(' ')[0]} 👋`;

  const co     = new Date(data.checkout);
  const coDate = co.toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' });
  const coTime = co.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('checkout-info').textContent = `📅 Check-out: ${coDate} a las ${coTime}`;

  startClock(co);

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

  // Mostrar app
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  // Listeners de escenas
  document.querySelectorAll('.scene-btn').forEach(btn => {
    btn.addEventListener('click', () => applyScene(btn.dataset.scene));
  });

  // Delegación de eventos para los controles del grid
  const grid = document.getElementById('device-grid');
  grid.addEventListener('click',  handleGridClick);
  grid.addEventListener('input',  handleGridInput);
  grid.addEventListener('change', handleGridInput);
}

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
        <span class="card-ico">💡</span>
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
function buildLEDCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const int = s.intensity ?? 50;
  const ct  = s.colorTemp ?? 50;
  const hue = s.hue;

  const swatches = LED_COLORS.map((c, i) => {
    const isActive = c.hue !== null
      ? (on && hue !== undefined && Math.abs(hue - c.hue) < 30)
      : (on && s.mode !== 'colour' && Math.abs(ct - c.ct) < 25);
    return `<div class="color-swatch ${isActive ? 'active' : ''}"
      style="background:${c.bg}"
      data-key="${key}" data-color-idx="${i}"
      title="${c.label}"></div>`;
  }).join('');

  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name">
        <span class="card-ico">💡</span>
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
      <div class="color-palette">${swatches}</div>` : ''}
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
    const cmd = { colorTemp: ct };
    if (!app.devices[key]?.on) cmd.on = true;
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

  // Swatch de color LED
  const swatch = e.target.closest('[data-color-idx]');
  if (swatch) {
    const key = swatch.dataset.key;
    const c   = LED_COLORS[parseInt(swatch.dataset.colorIdx)];
    const cmd = { on: true };
    if (c.hue !== null)  { cmd.hue = c.hue; cmd.saturation = c.sat ?? 1000; }
    else                 { cmd.colorTemp = c.ct; }
    doCmd(key, cmd);
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

  const btn = document.querySelector(`.scene-btn[data-scene="${sceneName}"]`);
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
