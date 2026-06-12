'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Panel General (multi-hotel)
// Vista previa visual con datos de ejemplo — no conectado al backend todavía.
// ─────────────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const PLAN_LABELS = { base: 'Base', premium: 'Premium', max_comfort: 'Max Comfort' };

const MOCK_HOTELS = [
  { name: 'Hotel Demo Plaza',    location: 'Santiago, Chile',     rooms: 24, occupied: 18, plans: ['base', 'premium', 'max_comfort'], connected: true },
  { name: 'Hotel Costa Azul',    location: 'Viña del Mar, Chile', rooms: 40, occupied: 27, plans: ['base', 'premium'] },
  { name: 'Hotel Andes Lodge',   location: 'Pucón, Chile',        rooms: 16, occupied: 16, plans: ['premium', 'max_comfort'] },
  { name: 'Hotel Puerto Norte',  location: 'Antofagasta, Chile',  rooms: 30, occupied: 12, plans: ['base'] },
];

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

window.openHotel = function(name) {
  const hotel = MOCK_HOTELS.find(h => h.name === name);
  if (hotel?.connected) {
    location.href = './dashboard.html';
    return;
  }
  showToast('Vista previa — este hotel de ejemplo aún no está conectado a un dashboard real.');
};

function renderKPIs() {
  const totalHotels = MOCK_HOTELS.length;
  const totalRooms  = MOCK_HOTELS.reduce((sum, h) => sum + h.rooms, 0);
  const totalOcc    = MOCK_HOTELS.reduce((sum, h) => sum + h.occupied, 0);
  const pct         = Math.round((totalOcc / totalRooms) * 100);

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
      <div class="kpi-value">${MOCK_HOTELS.filter(h => h.plans.includes('max_comfort')).length}</div>
      <div class="kpi-sub">Hoteles con el plan superior</div>
    </div>
  `;
}

function buildHotelCard(hotel) {
  const pct = Math.round((hotel.occupied / hotel.rooms) * 100);
  const plans = hotel.plans.map(p => `<span class="plan-pill ${p}">${PLAN_LABELS[p]}</span>`).join('');
  return `
  <div class="hotel-card" onclick="openHotel('${hotel.name}')">
    <div class="hc-top">
      <div>
        <div class="hc-name">${hotel.name}</div>
        <div class="hc-loc">${hotel.location}</div>
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
  $('hotel-grid').innerHTML = MOCK_HOTELS.map(buildHotelCard).join('');
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
  renderKPIs();
  renderHotels();
  startClock();
});
