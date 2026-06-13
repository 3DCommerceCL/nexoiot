'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Panel General (multi-hotel)
// Lee /api/admin/hotels para mostrar los hoteles conectados a Nexo IoT.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL    = 'https://nexoiot-production.up.railway.app/api';
const KEY_STORAGE = 'nexo_admin_key';

const $ = id => document.getElementById(id);

// PLAN_LABELS viene de shared.js

let hotels = [];

function getAdminKey() { return sessionStorage.getItem(KEY_STORAGE) || ''; }

const apiFetch = createApiFetch(API_URL, () => ({ 'X-Admin-Key': getAdminKey() }));

function showToast(msg) {
  renderToast(msg, { axis: 'x' });
}

window.openHotel = function(id) {
  location.href = `./dashboard.html?hotel=${encodeURIComponent(id)}`;
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function login() {
  const key   = $('login-key').value.trim();
  const error = $('login-error');
  error.textContent = '';
  if (!key) { error.textContent = 'Ingresa la clave de acceso.'; return; }

  sessionStorage.setItem(KEY_STORAGE, key);
  try {
    await loadHotels();
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
async function loadHotels() {
  hotels = await apiFetch('/admin/hotels');
  renderKPIs();
  renderHotels();
}

function renderKPIs() {
  const totalHotels = hotels.length;
  const totalRooms  = hotels.reduce((sum, h) => sum + h.rooms, 0);
  const totalOcc    = hotels.reduce((sum, h) => sum + h.occupied, 0);
  const pct         = totalRooms ? Math.round((totalOcc / totalRooms) * 100) : 0;

  $('kpi-row').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Hoteles activos</div>
      <div class="kpi-value">${totalHotels}</div>
      <div class="kpi-sub">Conectados a Nexo IoT</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Habitaciones totales</div>
      <div class="kpi-value">${totalRooms}</div>
      <div class="kpi-sub">En todos los hoteles</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ocupación global</div>
      <div class="kpi-value">${pct}%</div>
      <div class="kpi-prog-track"><div class="kpi-prog-fill" style="width:${pct}%"></div></div>
      <div class="kpi-sub">${totalOcc} / ${totalRooms} ocupadas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Habitaciones Max Comfort</div>
      <div class="kpi-value">${hotels.filter(h => h.plans.includes('max_comfort')).length}</div>
      <div class="kpi-sub">Hoteles con el plan superior</div>
    </div>
  `;
}

function buildHotelCard(hotel) {
  const pct = hotel.rooms ? Math.round((hotel.occupied / hotel.rooms) * 100) : 0;
  const plans = hotel.plans.map(p => `<span class="plan-pill ${p}">${PLAN_LABELS[p] || p}</span>`).join('');
  return `
  <div class="hotel-card" onclick="openHotel('${hotel.id}')">
    <div class="hc-top">
      <div>
        <div class="hc-name">${hotel.name}</div>
        <div class="hc-loc">${hotel.location || ''}</div>
      </div>
      <span class="badge badge-active">Activo</span>
    </div>
    <div>
      <div class="hc-occ-row"><span>Ocupación</span><span>${hotel.occupied} / ${hotel.rooms} (${pct}%)</span></div>
      <div class="kpi-prog-track" style="margin-top:6px"><div class="kpi-prog-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="hc-plans">${plans}</div>
    <div class="hc-footer">
      <span>${hotel.rooms} habitaciones</span>
      <span>Planes activos: ${hotel.plans.length}</span>
    </div>
  </div>`;
}

function renderHotels() {
  if (!hotels.length) {
    $('hotel-grid').innerHTML = '<div class="kpi-sub">Sin hoteles registrados todavía.</div>';
    return;
  }
  $('hotel-grid').innerHTML = hotels.map(buildHotelCard).join('');
}

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

document.addEventListener('DOMContentLoaded', () => {
  $('login-btn').addEventListener('click', login);
  $('login-key').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('logout-btn').addEventListener('click', logout);

  startClock();

  if (getAdminKey()) {
    loadHotels()
      .then(() => {
        $('login-screen').classList.add('hidden');
        $('sidebar').classList.remove('hidden');
        $('main').classList.remove('hidden');
      })
      .catch(() => sessionStorage.removeItem(KEY_STORAGE));
  }
});
