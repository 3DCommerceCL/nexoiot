'use strict';
// booking-engine.js — Motor de reservas directas (5 pasos sin dependencias externas)

const SLUG = window.location.pathname.split('/').filter(Boolean).pop() || '';
const API  = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://${window.location.host}/api`
  : 'https://nexoiot-production.up.railway.app/api';

const $ = id => document.getElementById(id);

// ── ESTADO ────────────────────────────────────────────────────────────────────
let hotelCfg  = null;
let dispData  = null;
let selRoom   = null;
let checkin   = '';
let checkout  = '';
let noches    = 0;
let pagoOpt   = 'llegar';

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  // Fechas mínimas
  const hoy = new Date().toISOString().slice(0, 10);
  const man = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  $('be-ci').min = hoy;
  $('be-co').min = man;
  $('be-ci').value = hoy;
  $('be-co').value = man;
  $('be-ci').addEventListener('change', () => {
    $('be-co').min = $('be-ci').value || hoy;
    if ($('be-co').value <= $('be-ci').value) $('be-co').value = '';
  });

  // Cargar config del hotel
  try {
    hotelCfg = await get(`/public/hotels/${SLUG}/config`);
    applyConfig(hotelCfg);
  } catch {
    $('be-hotel-name').textContent = 'Hotel';
  }

  // Handlers de navegación
  $('btn-buscar').addEventListener('click', buscarHabitaciones);
  $('btn-cambiar').addEventListener('click', () => goStep(1));
  $('btn-continuar').addEventListener('click', continuar);
  $('btn-volver-hab').addEventListener('click', () => goStep(2));
  $('btn-volver-datos').addEventListener('click', () => goStep(3));
  $('btn-confirmar').addEventListener('click', confirmarReserva);
  $('pago-llegar').addEventListener('click', () => selPago('llegar'));
  $('pago-webpay').addEventListener('click', () => {
    if (!$('pago-webpay').classList.contains('disabled')) selPago('webpay');
  });

  // Si venimos de vuelta de Transbank (Webpay redirige acá con ?pago=&reserva=),
  // saltar directo al resultado en vez de iniciar el flujo desde el paso 1.
  const params = new URLSearchParams(window.location.search);
  const pago = params.get('pago');
  if (pago) {
    renderResultadoPago(pago, params.get('reserva'));
    goStep(5);
  }
}

function applyConfig(cfg) {
  if (!cfg) return;
  document.title = cfg.titulo || `Reserva — ${cfg.nombre}`;
  $('be-hotel-name').textContent = cfg.nombre;
  if (cfg.logoUrl) {
    const img = $('be-logo');
    img.src = cfg.logoUrl;
    img.classList.remove('hidden');
  }
  if (cfg.colorPrimario) {
    document.documentElement.style.setProperty('--be-color', cfg.colorPrimario);
    $('be-header').style.background = `linear-gradient(135deg, ${cfg.colorSecundario || '#102943'} 0%, ${cfg.colorPrimario} 100%)`;
  }
  if (cfg.politicaCancel) {
    $('be-policy').textContent = `Política de cancelación: ${cfg.politicaCancel}`;
  }
}

// ── NAVEGACIÓN ────────────────────────────────────────────────────────────────
function goStep(n) {
  for (let i = 1; i <= 5; i++) $(`s${i}`).classList.toggle('hidden', i !== n);
  for (let i = 1; i <= 5; i++) {
    const d = $(`d${i}`);
    d.classList.toggle('active', i === n);
    d.classList.toggle('done', i < n);
  }
}

// ── STEP 1 → 2: Buscar habitaciones ──────────────────────────────────────────
async function buscarHabitaciones() {
  $('e1').textContent = '';
  checkin  = $('be-ci').value;
  checkout = $('be-co').value;
  if (!checkin || !checkout) { $('e1').textContent = 'Selecciona ambas fechas.'; return; }
  if (checkin >= checkout)   { $('e1').textContent = 'El check-out debe ser posterior al check-in.'; return; }
  noches = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);

  $('btn-buscar').disabled = true;
  $('btn-buscar').textContent = 'Buscando…';

  try {
    dispData = await get(`/public/hotels/${SLUG}/disponibilidad?checkin=${checkin}&checkout=${checkout}`);
    renderRooms(dispData.rooms);
    $('s2-dates').textContent = `${fmt(checkin)} → ${fmt(checkout)} · ${noches} noche${noches !== 1 ? 's' : ''}`;
    goStep(2);
  } catch (err) {
    $('e1').textContent = err.message || 'Error al buscar disponibilidad.';
  } finally {
    $('btn-buscar').disabled = false;
    $('btn-buscar').textContent = 'Buscar habitaciones';
  }
}

function renderRooms(roomsList) {
  const disponibles = roomsList.filter(r => r.disponible);
  if (!disponibles.length) {
    $('rooms-list').innerHTML = `
      <div class="be-no-rooms">
        <div class="be-no-rooms-icon">🛏️</div>
        <div>Sin habitaciones disponibles para esas fechas.</div>
        <div style="margin-top:6px;font-size:12px;color:var(--text3)">Prueba con fechas distintas.</div>
      </div>`;
    return;
  }
  const PLAN = { base: 'Estándar', premium: 'Premium', max_comfort: 'Max Comfort' };
  $('rooms-list').innerHTML = disponibles.map(r => {
    const precioHTML = r.precioPorNoche
      ? `<div class="be-price-uf">${r.precioPorNoche.uf.toFixed(2)} <span>UF/noche</span></div>
         <div class="be-price-clp">~$${r.precioPorNoche.clp_referencial.toLocaleString('es-CL')} CLP</div>
         <div class="be-price-total">Total: ${r.precioTotal.uf.toFixed(2)} UF</div>`
      : '<div class="be-price-clp">Precio a consultar</div>';
    return `
      <div class="be-room" id="room-${r.id}" onclick="selRoom('${r.id}')">
        <div class="be-room-icon">${iconoRoom(r.plan)}</div>
        <div class="be-room-info">
          <div class="be-room-name">${r.nombre}</div>
          <div class="be-room-plan">${PLAN[r.plan] || r.plan}</div>
        </div>
        <div class="be-room-price">${precioHTML}</div>
      </div>`;
  }).join('');
}

window.selRoom = function(roomId) {
  document.querySelectorAll('.be-room').forEach(el => el.classList.remove('sel'));
  const el = $('room-' + roomId);
  if (el) el.classList.add('sel');
  selRoom = (dispData?.rooms || []).find(r => r.id === roomId) || null;
  $('e2').textContent = '';
  setTimeout(() => goStep(3), 220);
};

// ── STEP 3: Validar datos y avanzar ──────────────────────────────────────────
function continuar() {
  $('e3').textContent = '';
  const name  = $('be-name').value.trim();
  const email = $('be-email').value.trim();
  if (!name)  { $('e3').textContent = 'Ingresa tu nombre.'; return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('e3').textContent = 'Email inválido.';
    return;
  }

  // Sin tarifa configurada para esta habitación/fechas no hay un monto cierto
  // que cobrar — Webpay se deshabilita y solo queda "pagar al llegar".
  const sinTarifa = !selRoom?.precioTotal;
  $('pago-webpay').classList.toggle('disabled', sinTarifa);
  $('pago-webpay').querySelector('.be-pago-desc').textContent = sinTarifa
    ? 'No disponible: este hotel aún no configuró tarifa para esta habitación.'
    : 'Tarjeta de crédito, débito o redes vía Transbank.';
  if (sinTarifa && pagoOpt === 'webpay') selPago('llegar');

  goStep(4);
}

// ── STEP 4: Pago y confirmación ───────────────────────────────────────────────
function selPago(opt) {
  pagoOpt = opt;
  $('pago-llegar').classList.toggle('sel', opt === 'llegar');
  $('pago-webpay').classList.toggle('sel', opt === 'webpay');
}

async function confirmarReserva() {
  if (!selRoom) { $('e4').textContent = 'No hay habitación seleccionada. Vuelve al paso anterior.'; return; }
  $('e4').textContent = '';
  $('btn-confirmar').disabled = true;
  $('btn-confirmar').textContent = 'Confirmando…';

  try {
    const result = await post(`/public/hotels/${SLUG}/reservas`, {
      roomId:    selRoom.id,
      guestName: $('be-name').value.trim(),
      guestEmail: $('be-email').value.trim(),
      guestPhone: $('be-phone').value.trim() || undefined,
      checkin, checkout,
    });

    if (pagoOpt === 'webpay' && selRoom.precioTotal) {
      const montoCLP = Math.round(selRoom.precioTotal.clp_referencial);
      const pago = await post(`/public/hotels/${SLUG}/reservas/${result.id}/pago/webpay`, { montoCLP });
      window.location.href = pago.url; // navega a Transbank — el regreso lo maneja init()
      return;
    }

    renderConfirmacion(result);
    goStep(5);
  } catch (err) {
    $('e4').textContent = err.message || 'Error al confirmar la reserva.';
  } finally {
    $('btn-confirmar').disabled = false;
    $('btn-confirmar').textContent = 'Confirmar reserva';
  }
}

function renderConfirmacion(result) {
  $('conf-id').textContent = result.id;
  const PLAN = { base: 'Estándar', premium: 'Premium', max_comfort: 'Max Comfort' };
  $('conf-summary').innerHTML = [
    ['Habitación',  selRoom.nombre],
    ['Plan',        PLAN[selRoom.plan] || selRoom.plan],
    ['Check-in',   fmt(checkin)],
    ['Check-out',  fmt(checkout)],
    ['Noches',     noches],
    ['Huésped',    $('be-name').value.trim()],
    ['Pago',       pagoOpt === 'webpay' ? 'Pagado online (Webpay)' : 'Al llegar'],
  ].map(([l, v]) =>
    `<div class="be-summary-row"><span class="be-summary-label">${l}</span><span class="be-summary-value">${v}</span></div>`
  ).join('');
}

// Resultado al volver desde Transbank (?pago=aprobado|rechazado|cancelado|error).
function renderResultadoPago(pago, reservaId) {
  const ESTADOS = {
    aprobado:  { icon: '✅', title: '¡Pago aprobado!', sub: 'Tu reserva quedó confirmada y pagada. Guarda tu número de reserva:' },
    rechazado: { icon: '❌', title: 'Pago rechazado', sub: 'Tu reserva se creó, pero el pago no se concretó. Puedes pagar al llegar al hotel.' },
    cancelado: { icon: '⚠️', title: 'Pago cancelado', sub: 'Cancelaste el pago. Tu reserva se creó y puedes pagar al llegar al hotel.' },
    error:     { icon: '⚠️', title: 'No pudimos confirmar el pago', sub: 'Si el cargo se realizó, contacta directamente al hotel con tu número de reserva.' },
  };
  const e = ESTADOS[pago] || ESTADOS.error;
  $('conf-icon').textContent = e.icon;
  $('conf-title').textContent = e.title;
  $('conf-sub').textContent = e.sub;
  $('conf-id').textContent = reservaId || '';
  $('conf-summary').innerHTML = '';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmt(iso) {
  const [y, m, d] = iso.split('-');
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`;
}

function iconoRoom(plan) {
  return plan === 'max_comfort' ? '🛏️' : plan === 'premium' ? '🏡' : '🛌';
}

async function get(path) {
  const r = await fetch(`${API}${path}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

// ── ARRANQUE ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
