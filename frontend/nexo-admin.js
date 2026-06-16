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

// ── TEMA DEL PANEL (claro / oscuro) ───────────────────────────────────────────
const DASH_THEME_KEY = 'nexo_dash_theme';

function applyDashTheme() {
  const dark = localStorage.getItem(DASH_THEME_KEY) === 'dark';
  document.body.classList.toggle('theme-dark', dark);
  const btn = $('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

function toggleDashTheme() {
  const dark = document.body.classList.toggle('theme-dark');
  localStorage.setItem(DASH_THEME_KEY, dark ? 'dark' : 'light');
  const btn = $('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

const apiFetch = createApiFetch(API_URL, () => ({ 'X-Admin-Key': getAdminKey() }));

function showToast(msg) {
  renderToast(msg, { axis: 'x' });
}

window.openHotel = function(id) {
  location.href = `./dashboard.html?hotel=${encodeURIComponent(id)}`;
};

// ── NAVEGACIÓN ENTRE VISTAS ───────────────────────────────────────────────────
const VIEW_TITLES = { hotels: 'Hoteles', analytics: 'Analíticas', channels: 'Canales OTA' };
const ALL_VIEWS   = ['hotels', 'analytics', 'channels'];

function setView(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view));
  ALL_VIEWS.forEach(v => $('view-' + v).classList.toggle('hidden', v !== view));
  $('tb-title').textContent = VIEW_TITLES[view] || '';
  if (view === 'analytics') renderAnalytics();
  if (view === 'channels')  initCanalView();
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

// ── CANALES OTA ───────────────────────────────────────────────────────────────
const CANAL_ICONS = { booking: '🏨', airbnb: '🏡', expedia: '✈️', despegar: '🌎', directo: '🔗' };
const CANAL_NAMES = { booking: 'Booking.com', airbnb: 'Airbnb', expedia: 'Expedia', despegar: 'Despegar.com', directo: 'Reserva directa' };

let currentCanalId = null;

function initCanalView() {
  // Poblar selector de hotel con los hoteles cargados
  const sel = $('canal-hotel-filter');
  const prevVal = sel.value;
  sel.innerHTML = '<option value="">— Seleccionar hotel —</option>' +
    hotels.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  if (prevVal) sel.value = prevVal;
  if (sel.value) loadCanales(sel.value);
}

async function loadCanales(hotelId) {
  if (!hotelId) { $('canal-grid').innerHTML = ''; $('canal-sec-header').style.display = 'none'; return; }
  try {
    const lista = await apiFetch(`/admin/canales?hotel=${encodeURIComponent(hotelId)}`);
    renderCanales(lista, hotels.find(h => h.id === hotelId)?.name || hotelId);
  } catch (err) {
    showToast('Error cargando canales: ' + err.message);
  }
}

function syncAge(iso) {
  if (!iso) return 'Nunca sincronizado';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'hace menos de 1 min';
  if (diff < 3600000) return `hace ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `hace ${Math.round(diff / 3600000)} h`;
  return `hace ${Math.round(diff / 86400000)} d`;
}

function renderCanales(lista, hotelName) {
  $('canal-sec-header').style.display = '';
  $('canal-sec-title').textContent = `Canales — ${hotelName}`;

  if (!lista.length) {
    $('canal-grid').innerHTML = `<div class="analytics-empty" style="grid-column:1/-1">Sin canales configurados. Haz clic en "Agregar canal" para conectar una OTA.</div>`;
    return;
  }

  $('canal-grid').innerHTML = lista.map(c => {
    const lastSync  = c.syncStatus;
    const hasError  = lastSync?.status === 'error';
    const statusBadge = !c.activo
      ? '<span class="badge badge-inactive">Inactivo</span>'
      : hasError
        ? '<span class="badge badge-error">Error sync</span>'
        : '<span class="badge badge-active">Activo</span>';

    return `
    <div class="canal-card${hasError ? ' canal-error' : ''}" id="canal-card-${c.id}">
      <div class="canal-top">
        <div>
          <div class="canal-name">${CANAL_ICONS[c.nombre] || '🔗'} ${CANAL_NAMES[c.nombre] || c.nombre}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="canal-sync${hasError ? ' has-error' : ''}">
        Última sync: ${syncAge(lastSync?.created_at)}
        ${hasError ? `<br><span style="color:var(--alert)">${lastSync.error || 'Error desconocido'}</span>` : ''}
      </div>
      <div class="canal-mappings">${c.mappings} habitación${c.mappings !== 1 ? 'es' : ''} mapeada${c.mappings !== 1 ? 's' : ''}</div>
      <div class="canal-actions">
        <button class="btn btn-outline btn-sm" onclick="syncNow('${c.id}', this)">↻ Sync</button>
        <button class="btn btn-outline btn-sm" onclick="openCanalConfig('${c.id}', '${c.nombre}')">Configurar</button>
        <button class="btn btn-outline btn-sm" onclick="toggleCanal('${c.id}', ${c.activo})">${c.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="btn btn-outline btn-sm" style="color:var(--alert)" onclick="deleteCanal('${c.id}', '${CANAL_NAMES[c.nombre] || c.nombre}')">Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

window.syncNow = async function(canalId, btn) {
  const prev = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const r = await apiFetch(`/admin/canales/${canalId}/sync-now`, { method: 'POST' });
    showToast(`Sync completado: ${r.mapeadas} hab. actualizadas (${r.desde} → ${r.hasta})`);
    const hotelId = $('canal-hotel-filter').value;
    if (hotelId) loadCanales(hotelId);
  } catch (err) {
    showToast('Error en sync: ' + err.message);
  } finally {
    btn.textContent = prev;
    btn.disabled = false;
  }
};

window.toggleCanal = async function(canalId, activo) {
  try {
    await apiFetch(`/admin/canales/${canalId}`, { method: 'PATCH', body: JSON.stringify({ activo: activo ? 0 : 1 }) });
    const hotelId = $('canal-hotel-filter').value;
    if (hotelId) loadCanales(hotelId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
};

window.deleteCanal = async function(canalId, nombre) {
  if (!confirm(`¿Eliminar canal "${nombre}"? También se borrarán todos sus mapeos de habitaciones.`)) return;
  try {
    await apiFetch(`/admin/canales/${canalId}`, { method: 'DELETE' });
    showToast('Canal eliminado');
    const hotelId = $('canal-hotel-filter').value;
    if (hotelId) loadCanales(hotelId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
};

// ── MODAL: Agregar canal ──────────────────────────────────────────────────────
function openAddCanalModal() {
  const sel = $('ac-hotel');
  sel.innerHTML = hotels.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  const presel = $('canal-hotel-filter').value;
  if (presel) sel.value = presel;
  $('ac-property-id').value = '';
  $('ac-error').textContent = '';
  $('modal-add-canal').classList.add('open');
}

async function submitAddCanal() {
  const hotelId    = $('ac-hotel').value;
  const nombre     = $('ac-nombre').value;
  const propertyId = $('ac-property-id').value.trim();
  $('ac-error').textContent = '';
  if (!hotelId) { $('ac-error').textContent = 'Selecciona un hotel.'; return; }
  try {
    await apiFetch('/admin/canales', {
      method: 'POST',
      body: JSON.stringify({ hotelId, nombre, config: { siteminder_property_id: propertyId || null } }),
    });
    $('modal-add-canal').classList.remove('open');
    showToast('Canal agregado correctamente');
    loadCanales(hotelId);
    $('canal-hotel-filter').value = hotelId;
    $('canal-sec-header').style.display = '';
  } catch (err) {
    $('ac-error').textContent = err.message;
  }
}

// ── MODAL: Configurar canal (mappings + sync log) ─────────────────────────────
window.openCanalConfig = async function(canalId, nombre) {
  currentCanalId = canalId;
  $('cc-title').textContent = `Configurar — ${CANAL_NAMES[nombre] || nombre}`;
  $('modal-canal-config').classList.add('open');

  // Activar pestaña mappings por defecto
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mappings'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-mappings'));

  // Poblar selector de habitaciones locales desde la API
  const hotelId = $('canal-hotel-filter').value;
  try {
    const roomsList = await apiFetch(`/admin/rooms?hotel=${encodeURIComponent(hotelId)}`);
    $('map-room-id').innerHTML = roomsList.length
      ? roomsList.map(r => `<option value="${r.id}">${r.name} (${r.id})</option>`).join('')
      : '<option value="">Sin habitaciones</option>';
  } catch { $('map-room-id').innerHTML = '<option value="">Error cargando habitaciones</option>'; }

  await reloadMappings();
};

async function reloadMappings() {
  if (!currentCanalId) return;
  try {
    const mappings = await apiFetch(`/admin/canales/${currentCanalId}/mappings`);
    $('mapping-list').innerHTML = mappings.length
      ? mappings.map(m => `
          <div class="mapping-row">
            <span class="mapping-room">${m.room_id}</span>
            <span class="mapping-ota">→ OTA: ${m.ota_room_id}${m.ota_rate_id ? ` / ${m.ota_rate_id}` : ''}</span>
            <button class="mapping-del" onclick="deleteMapping('${m.id}')" title="Eliminar">✕</button>
          </div>`)
        .join('')
      : '<div class="analytics-empty">Sin habitaciones mapeadas todavía.</div>';
  } catch { $('mapping-list').innerHTML = '<div class="analytics-empty">Error cargando mapeos.</div>'; }
}

window.deleteMapping = async function(mappingId) {
  try {
    await apiFetch(`/admin/canales/mappings/${mappingId}`, { method: 'DELETE' });
    await reloadMappings();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
};

async function addMapping() {
  const roomId    = $('map-room-id').value;
  const otaRoomId = $('map-ota-room-id').value.trim();
  const otaRateId = $('map-ota-rate-id').value.trim();
  $('map-error').textContent = '';
  if (!roomId || !otaRoomId) { $('map-error').textContent = 'Selecciona la habitación e ingresa el ID OTA.'; return; }
  try {
    await apiFetch(`/admin/canales/${currentCanalId}/mappings`, {
      method: 'POST',
      body: JSON.stringify({ roomId, otaRoomId, otaRateId: otaRateId || undefined }),
    });
    $('map-ota-room-id').value = '';
    $('map-ota-rate-id').value = '';
    await reloadMappings();
    // Recargar tarjeta del canal para actualizar contador de mappings
    const hotelId = $('canal-hotel-filter').value;
    if (hotelId) loadCanales(hotelId);
  } catch (err) {
    $('map-error').textContent = err.message;
  }
}

async function loadSyncLog() {
  if (!currentCanalId) return;
  try {
    const logs = await apiFetch(`/admin/canales/${currentCanalId}/sync-status`);
    $('sync-log-list').innerHTML = logs.length
      ? logs.map(l => `
          <div class="mapping-row" style="${l.status === 'error' ? 'border-left:3px solid var(--alert)' : ''}">
            <span class="mapping-room" style="flex:none;width:100px">${l.tipo.replace('_', ' ')}</span>
            <span class="mapping-ota" style="flex:1">${l.status === 'error' ? (l.error || 'Error') : 'OK'}</span>
            <span style="font-size:10px;color:var(--text3);white-space:nowrap">${new Date(l.created_at).toLocaleString('es-CL')}</span>
          </div>`)
        .join('')
      : '<div class="analytics-empty">Sin registros de sincronización.</div>';
  } catch { $('sync-log-list').innerHTML = '<div class="analytics-empty">Error cargando log.</div>'; }
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

  applyDashTheme();
  $('theme-toggle').addEventListener('click', toggleDashTheme);

  startClock();

  // Canal: selector de hotel
  $('canal-hotel-filter').addEventListener('change', e => loadCanales(e.target.value));
  $('btn-add-canal').addEventListener('click', openAddCanalModal);

  // Modal agregar canal
  $('ac-cancel').addEventListener('click', () => $('modal-add-canal').classList.remove('open'));
  $('ac-save').addEventListener('click', submitAddCanal);
  $('modal-add-canal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });

  // Modal config canal
  $('cc-close').addEventListener('click', () => $('modal-canal-config').classList.remove('open'));
  $('modal-canal-config').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });
  $('btn-add-mapping').addEventListener('click', addMapping);

  // Tabs del modal config
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'log') loadSyncLog();
    });
  });

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
