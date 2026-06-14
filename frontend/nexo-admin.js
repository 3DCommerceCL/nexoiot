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

// ── NAVEGACIÓN ENTRE VISTAS ───────────────────────────────────────────────────
const VIEW_TITLES = { hotels: 'Hoteles', analytics: 'Analíticas' };

function setView(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view));
  $('view-hotels').classList.toggle('hidden', view !== 'hotels');
  $('view-analytics').classList.toggle('hidden', view !== 'analytics');
  $('tb-title').textContent = VIEW_TITLES[view] || '';
  if (view === 'analytics') renderAnalytics();
}

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
  if (!$('view-analytics').classList.contains('hidden')) renderAnalytics();
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

// ── ANALÍTICAS AGREGADAS (multi-hotel) ───────────────────────────────────────
function renderAnalytics() {
  if (!hotels.length) {
    $('analytics-kpi-row').innerHTML = '';
    $('occupancy-list').innerHTML = '<div class="analytics-empty">Sin hoteles registrados todavía.</div>';
    $('plan-dist-list').innerHTML = '<div class="analytics-empty">Sin hoteles registrados todavía.</div>';
    $('pending-req-list').innerHTML = '<div class="analytics-empty">Sin hoteles registrados todavía.</div>';
    return;
  }

  const totalRooms = hotels.reduce((sum, h) => sum + h.rooms, 0);
  const totalOcc   = hotels.reduce((sum, h) => sum + h.occupied, 0);
  const totalPending = hotels.reduce((sum, h) => sum + (h.pendingRequests || 0), 0);
  const avgOcc = totalRooms ? Math.round((totalOcc / totalRooms) * 100) : 0;
  const occByHotel = hotels.map(h => ({ h, pct: h.rooms ? Math.round((h.occupied / h.rooms) * 100) : 0 }));
  const busiest = occByHotel.reduce((a, b) => (b.pct > a.pct ? b : a), occByHotel[0]);
  const quietest = occByHotel.reduce((a, b) => (b.pct < a.pct ? b : a), occByHotel[0]);

  $('analytics-kpi-row').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Ocupación promedio</div>
      <div class="kpi-value">${avgOcc}%</div>
      <div class="kpi-sub">${totalOcc} / ${totalRooms} habitaciones</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Hotel más ocupado</div>
      <div class="kpi-value" style="font-size:18px">${busiest.h.name}</div>
      <div class="kpi-sub">${busiest.pct}% de ocupación</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Hotel con más disponibilidad</div>
      <div class="kpi-value" style="font-size:18px">${quietest.h.name}</div>
      <div class="kpi-sub">${quietest.pct}% de ocupación</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Solicitudes pendientes</div>
      <div class="kpi-value">${totalPending}</div>
      <div class="kpi-sub">En todos los hoteles</div>
    </div>
  `;

  $('occupancy-list').innerHTML = occByHotel
    .slice()
    .sort((a, b) => b.pct - a.pct)
    .map(({ h, pct }) => `
      <div class="analytics-row">
        <div class="analytics-row-label">${h.name}</div>
        <div class="analytics-row-bar kpi-prog-track"><div class="kpi-prog-fill" style="width:${pct}%"></div></div>
        <div class="analytics-row-value">${h.occupied} / ${h.rooms} (${pct}%)</div>
      </div>`)
    .join('');

  const planTotals = hotels.reduce((acc, h) => {
    for (const [plan, count] of Object.entries(h.planCounts || {})) {
      acc[plan] = (acc[plan] || 0) + count;
    }
    return acc;
  }, {});
  const planOrder = ['base', 'premium', 'max_comfort'];
  $('plan-dist-list').innerHTML = planOrder
    .filter(plan => planTotals[plan])
    .map(plan => {
      const count = planTotals[plan];
      const pct = totalRooms ? Math.round((count / totalRooms) * 100) : 0;
      return `
      <div class="analytics-row">
        <div class="analytics-row-label"><span class="plan-pill ${plan}">${PLAN_LABELS[plan] || plan}</span></div>
        <div class="analytics-row-bar kpi-prog-track"><div class="kpi-prog-fill" style="width:${pct}%"></div></div>
        <div class="analytics-row-value">${count} habitaciones (${pct}%)</div>
      </div>`;
    })
    .join('');

  const withPending = hotels.filter(h => h.pendingRequests > 0);
  $('pending-req-list').innerHTML = withPending.length
    ? withPending
        .slice()
        .sort((a, b) => b.pendingRequests - a.pendingRequests)
        .map(h => `
          <div class="analytics-row">
            <div class="analytics-row-label">${h.name}</div>
            <div class="analytics-row-bar"></div>
            <div class="analytics-row-value">${h.pendingRequests} pendiente${h.pendingRequests === 1 ? '' : 's'}</div>
          </div>`)
        .join('')
    : '<div class="analytics-empty">Sin solicitudes pendientes en ningún hotel.</div>';
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

  document.querySelectorAll('.nav-item[data-view]').forEach(el =>
    el.addEventListener('click', () => setView(el.dataset.view)));

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
