# Prompt 01 — Calendario de reservas con drag & drop

> Incluir `docs/prompts/00-contexto-proyecto.md` al inicio de la sesión antes de ejecutar este prompt.

**Estimación:** 3–4 días de desarrollo.
**Pre-requisito bloqueante:** La migración a PostgreSQL/SQLite (ver sección de arquitectura en `00-contexto-proyecto.md`) debe estar completada. El calendario requiere una tabla `reservas` real — los JSON flat files no soportan concurrencia ni consultas de rango de fechas.

---

## Objetivo

Agregar una vista de **calendario de reservas** al `frontend/dashboard.html` existente, accesible desde el sidebar como un nuevo ítem de navegación. La vista muestra todas las habitaciones del hotel como filas y los días como columnas, con soporte para drag & drop.

---

## Pre-requisito: tabla de reservas en la base de datos

Antes de implementar el calendario, crear la tabla de reservas. Agregar al schema de la base de datos:

```sql
CREATE TABLE IF NOT EXISTS reservas (
  id            TEXT PRIMARY KEY,          -- ID único (crypto.randomBytes(8).toString('hex'))
  hotel_id      TEXT NOT NULL,             -- FK a hotels
  room_id       TEXT NOT NULL,             -- FK a rooms
  guest_name    TEXT NOT NULL,
  guest_email   TEXT,
  guest_phone   TEXT,
  checkin       DATE NOT NULL,             -- YYYY-MM-DD (fecha, sin hora)
  checkout      DATE NOT NULL,             -- YYYY-MM-DD (fecha, sin hora)
  status        TEXT NOT NULL DEFAULT 'confirmed',  -- 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  source        TEXT DEFAULT 'direct',     -- 'direct' | 'booking' | 'airbnb' | 'whatsapp'
  plan          TEXT,                      -- 'base' | 'premium' | 'max_comfort'
  notes         TEXT,
  token         TEXT,                      -- FK a tokens.json / tokens table (cuando hay check-in activo)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  CONSTRAINT no_overlap CHECK (checkin < checkout)
);
CREATE INDEX IF NOT EXISTS idx_reservas_hotel_fechas ON reservas(hotel_id, checkin, checkout);
CREATE INDEX IF NOT EXISTS idx_reservas_room ON reservas(room_id, checkin, checkout);
```

Agregar en `backend/rooms.js` (o un nuevo `backend/reservas.js`):
```js
'use strict';
// backend/reservas.js — CRUD de reservas (requiere migración a DB)
const crypto = require('crypto');

function createReserva(hotelId, roomId, guestName, checkin, checkout, opts = {}) { /* ... */ }
function getReservasByHotel(hotelId, fromDate, toDate) { /* ... */ }
function updateReserva(id, fields) { /* ... */ }
function cancelReserva(id) { /* ... */ }
function checkDisponibilidad(roomId, checkin, checkout, excludeId = null) { /* ... */ }

module.exports = { createReserva, getReservasByHotel, updateReserva, cancelReserva, checkDisponibilidad };
```

---

## Librería de calendario

**Stack real del proyecto: frontend vanilla JS, sin React ni Vue, archivos cargados vía `<script src>`.** Por lo tanto:

**Usar FullCalendar versión vanilla** (no el paquete de React):
- Paquete npm: `@fullcalendar/core`, `@fullcalendar/resource-timeline`, `@fullcalendar/interaction`
- O bien vía CDN (recomendado para este proyecto dado que no hay bundler):

```html
<!-- Agregar en dashboard.html, en el <head>, solo cuando la vista calendario esté activa -->
<link href="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.15/main.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fullcalendar/resource-timeline@6.1.15/main.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.15/main.global.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fullcalendar/resource-timeline@6.1.15/main.global.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fullcalendar/interaction@6.1.15/main.global.min.js"></script>
```

**Por qué FullCalendar Resource Timeline:**
- Es la única librería vanilla JS que soporta layout de timeline con "recursos" (habitaciones) como filas y fechas como columnas
- La vista `resourceTimeline` con zoom de días es exactamente el layout requerido
- Tiene drag & drop y resize nativos con el plugin `interaction`
- La licencia `@fullcalendar/resource-timeline` es de pago para uso comercial — usar la versión de evaluación en desarrollo y obtener licencia al ir a producción <!-- COMPLETAR: obtener licencia Premium -->

**Alternativa gratuita si no se quiere pagar licencia:** DHTMLX Scheduler (licencia GPL gratuita para uso open source). Considerar según modelo de negocio.

---

## Nuevos endpoints de API

Agregar en `backend/server.js` usando la misma convención existente:

```js
// ── ADMIN: GET /api/admin/reservas ───────────────────────────────────────────
// ?hotel=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/admin/reservas', adminAuth, (req, res) => {
  const { hotel, from, to } = req.query;
  if (!hotel || !from || !to) {
    return res.status(400).json({ error: 'Requeridos: hotel, from, to' });
  }
  const reservas = reservasMod.getReservasByHotel(hotel, from, to);
  res.json(reservas);
});

// ── ADMIN: POST /api/admin/reservas ─────────────────────────────────────────
app.post('/api/admin/reservas', adminAuth, (req, res) => {
  const { hotelId, roomId, guestName, checkin, checkout, guestEmail, guestPhone, notes, plan } = req.body;
  if (!hotelId || !roomId || !guestName || !checkin || !checkout) {
    return res.status(400).json({ error: 'Requeridos: hotelId, roomId, guestName, checkin, checkout' });
  }
  const disponible = reservasMod.checkDisponibilidad(roomId, checkin, checkout);
  if (!disponible) {
    return res.status(409).json({ error: 'Habitación no disponible en esas fechas', code: 'ROOM_UNAVAILABLE' });
  }
  const reserva = reservasMod.createReserva(hotelId, roomId, guestName, checkin, checkout, { guestEmail, guestPhone, notes, plan });
  res.status(201).json(reserva);
});

// ── ADMIN: PATCH /api/admin/reservas/:id ─────────────────────────────────────
// Usado por drag (nueva fecha) y resize (nuevo checkout). Siempre valida disponibilidad.
app.patch('/api/admin/reservas/:id', adminAuth, (req, res) => {
  const { checkin, checkout, roomId, status } = req.body;
  if ((checkin || checkout || roomId) && (checkin || checkout)) {
    const nuevaRoom = roomId || /* obtener roomId actual de la reserva */;
    const disponible = reservasMod.checkDisponibilidad(nuevaRoom, checkin || /* actual */, checkout || /* actual */, req.params.id);
    if (!disponible) {
      return res.status(409).json({ error: 'Conflicto de disponibilidad', code: 'ROOM_UNAVAILABLE' });
    }
  }
  const updated = reservasMod.updateReserva(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Reserva no encontrada' });
  res.json(updated);
});

// ── ADMIN: DELETE /api/admin/reservas/:id ────────────────────────────────────
app.delete('/api/admin/reservas/:id', adminAuth, (req, res) => {
  const ok = reservasMod.cancelReserva(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Reserva no encontrada' });
  res.json({ success: true });
});
```

---

## Integración con dashboard.html

### 1. Agregar ítem al sidebar (modificar `frontend/dashboard.html`)

En el `<nav class="sb-nav">`, después del ítem de "Habitaciones":

```html
<div class="nav-item" data-view="calendar">
  <span class="nav-icon">📅</span>
  <span class="nav-label">Calendario</span>
</div>
```

### 2. Agregar la vista (en `<div class="content" id="content">`)

```html
<!-- VIEW: CALENDAR -->
<div class="view" id="view-calendar">
  <div id="fc-container" style="height:calc(100vh - 56px - 48px)"></div>
</div>
```

### 3. Inicializar FullCalendar en `frontend/dashboard.js`

```js
// ── CALENDARIO ────────────────────────────────────────────────────────────────
// Inicializar solo cuando se activa la vista, no al cargar el dashboard
let fcInstance = null;

function initCalendar(rooms, apiKey) {
  if (fcInstance) { fcInstance.destroy(); fcInstance = null; }

  const resources = rooms.map(r => ({
    id:    r.id,
    title: r.name,
    floor: r.floor,
    plan:  r.plan,
  }));

  fcInstance = new FullCalendar.Calendar(document.getElementById('fc-container'), {
    schedulerLicenseKey: '<!-- COMPLETAR: licencia FullCalendar Premium -->',
    initialView:         'resourceTimelineWeek',
    locale:              'es',
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth',
    },
    resources,
    events: async (fetchInfo, successCallback, failureCallback) => {
      try {
        const from = fetchInfo.startStr.slice(0, 10);
        const to   = fetchInfo.endStr.slice(0, 10);
        const data = await adminFetch(`/api/admin/reservas?hotel=${HOTEL_ID}&from=${from}&to=${to}`, apiKey);
        successCallback(data.map(reservaToEvent));
      } catch (e) {
        failureCallback(e);
      }
    },
    editable:   true,
    droppable:  true,
    eventResizableFromStart: false,

    // Color por estado
    eventClassNames: info => [`ev-${info.event.extendedProps.status}`],

    // Click en celda vacía → abrir modal de nueva reserva con habitación y fecha pre-llenados
    dateClick: info => {
      openNewStayModal({ roomId: info.resource?.id, date: info.dateStr });
    },

    // Click en reserva → abrir modal de edición
    eventClick: info => {
      openReservaModal(info.event.id, info.event.extendedProps);
    },

    // Drag: mover reserva a otra habitación o fecha
    eventDrop: async info => {
      const ok = await patchReserva(info.event.id, {
        checkin:  info.event.startStr.slice(0, 10),
        checkout: info.event.endStr.slice(0, 10),
        roomId:   info.event.getResources()[0]?.id,
      });
      if (!ok) {
        info.revert(); // devuelve el evento a su posición original
        showToast('Habitación no disponible en esas fechas', 'error');
      }
    },

    // Resize: extender o acortar estadía
    eventResize: async info => {
      const ok = await patchReserva(info.event.id, {
        checkout: info.event.endStr.slice(0, 10),
      });
      if (!ok) {
        info.revert();
        showToast('No se puede modificar la fecha de salida', 'error');
      }
    },

    // Agrupar habitaciones por piso en el sidebar del calendario
    resourceGroupField: 'floor',
    resourceLabelContent: info => info.resource.title,
  });

  fcInstance.render();
}

// Color coding de reservas por estado (agregar CSS en dashboard.html)
// .ev-confirmed  → fondo var(--teal)
// .ev-pending    → fondo var(--warn)
// .ev-checked_in → fondo #2563eb (azul)
// .ev-checked_out → fondo var(--text3)
// checkout hoy  → borde naranja (calcular en reservaToEvent)

function reservaToEvent(r) {
  const isCheckoutToday = r.checkout === new Date().toISOString().slice(0, 10);
  return {
    id:             r.id,
    resourceId:     r.room_id,
    title:          r.guest_name,
    start:          r.checkin,
    end:            r.checkout,
    borderColor:    isCheckoutToday ? '#F0A030' : 'transparent',
    borderWidth:    isCheckoutToday ? 2 : 0,
    extendedProps: {
      status:    r.status,
      source:    r.source,
      guestEmail: r.guest_email,
      guestPhone: r.guest_phone,
      notes:     r.notes,
      plan:      r.plan,
    },
  };
}
```

### 4. CSS de colores por estado (agregar en `<style>` del `dashboard.html`)

```css
/* Colores de eventos en el calendario */
.fc-event.ev-confirmed  { background: var(--teal); border-color: var(--teal-d); }
.fc-event.ev-pending    { background: var(--warn); border-color: #d4890a; color: #1A1D24; }
.fc-event.ev-checked_in { background: #2563eb; border-color: #1d4ed8; }
.fc-event.ev-checked_out { background: var(--text3); border-color: var(--text2); color: var(--text2); }
/* Override del header de FullCalendar para que use --header-grad */
.fc .fc-toolbar { background: var(--header-grad); padding: 10px 16px; border-radius: 10px 10px 0 0; }
.fc .fc-toolbar-title { color: #fff; font-size: 14px; font-weight: 600; }
.fc .fc-button { background: rgba(255,255,255,.15); border-color: rgba(255,255,255,.3); color: #fff; font-size: 12px; }
.fc .fc-button-active, .fc .fc-button:hover { background: rgba(255,255,255,.28); }
```

---

## Modal de nueva reserva

Reutilizar el modal existente `#modal-new-stay` (ya existe en `dashboard.html`). Extender su formulario para soportar:
- `roomId` pre-seleccionado (desde el click en celda del calendario)
- `checkin` y `checkout` pre-llenados
- Dropdown de plan

Al confirmar: llamar a `POST /api/admin/reservas`, y si hay check-in en la misma fecha también llamar a `POST /api/admin/token` para generar el QR.

---

## Modal de edición de reserva

Nuevo modal `#modal-reserva` (agregar en `dashboard.html`):
- Ver/editar datos del huésped
- Ver/cambiar estado (pending → confirmed → checked_in → checked_out → cancelled)
- Botón "Hacer check-in ahora" → llama `POST /api/admin/token` y actualiza `status: 'checked_in'`
- Botón "Checkout" → llama `DELETE /api/admin/token/:token` y actualiza `status: 'checked_out'`
- Botón "Cancelar reserva" → llama `DELETE /api/admin/reservas/:id`
- Historial de actividad de la habitación

---

## Manejo de conflictos

```js
async function patchReserva(id, fields) {
  try {
    const res = await fetch(`${API_URL}/admin/reservas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(fields),
    });
    if (res.status === 409) return false;  // conflicto → caller hace revert()
    if (!res.ok) throw new Error(await res.text());
    return true;
  } catch (e) {
    console.error('patchReserva:', e);
    return false;
  }
}
```

El servidor siempre valida disponibilidad antes de confirmar un PATCH. Si retorna 409, el frontend revierte el drag/resize visualmente con `info.revert()`.

---

## Commits recomendados (granularidad)

```
Agregar tabla reservas y endpoints CRUD en el backend
Agregar vista de calendario al sidebar del dashboard
Inicializar FullCalendar Resource Timeline con habitaciones como recursos
Implementar drag & drop de reservas con validación de disponibilidad en servidor
Implementar resize de estadía arrastrando el borde derecho
Agregar color coding de reservas por estado en el calendario
Conectar modal de nueva estadía con el click en celda del calendario
Agregar modal de edición de reserva con acciones de check-in y checkout
```

---

## Marcadores COMPLETAR

- `<!-- COMPLETAR: licencia FullCalendar Premium -->` — obtener en fullcalendar.io/pricing antes de ir a producción
- `<!-- COMPLETAR: migración DB completada -->` — este prompt no se puede ejecutar sin la tabla `reservas`
- `<!-- COMPLETAR: DHTMLX si se prefiere alternativa GPL -->` — evaluar según modelo de negocio

---

## Tests (no hay framework instalado)

No hay tests en el proyecto. Al implementar, verificar manualmente:
1. Drag de reserva a habitación ocupada → se revierte + muestra toast de error
2. Drag de reserva a habitación libre → se guarda + calendario se actualiza
3. Resize acortando estadía → se actualiza
4. Click en celda vacía → modal con habitación y fecha pre-llenados
5. Click en reserva existente → modal con datos del huésped
6. Vista semanal, diaria y mensual funcionan
