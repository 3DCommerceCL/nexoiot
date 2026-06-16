# Prompt 02 — Channel Manager (sincronización con OTAs)

> Incluir `docs/prompts/00-contexto-proyecto.md` al inicio de la sesión antes de ejecutar este prompt.

**Estimación:** 2–3 semanas de desarrollo + 2–4 semanas de proceso de aprobación con cada OTA.
**Pre-requisito bloqueante:** Migración a PostgreSQL + tabla `reservas` (prompt 01). El channel manager sincroniza reservas externas con el mismo sistema de reservas local.

---

## Estrategia recomendada: Opción B — Via agregador (SiteMinder)

### Por qué NO integración directa con Booking.com o Airbnb:

1. **Proceso de aprobación de cada OTA toma 2–6 semanas** y requiere demostrar volumen de hoteles en la plataforma
2. La API de Booking.com Connectivity requiere cumplimiento con su certificación de conectividad antes de poder recibir reservas reales
3. Airbnb API Partners tiene cupo limitado y proceso de aplicación largo
4. Mantener integraciones directas con 2+ OTAs multiplica la superficie de código a mantener

### Por qué SiteMinder para el mercado chileno:

- Tiene **presencia comercial en Chile** y soporte en español
- Conecta con Booking.com, Airbnb, Expedia, Despegar.com y 400+ canales con **una sola integración**
- Tiene API REST moderna y webhooks para recepción de reservas
- Precio ~USD $75–100/mes por propiedad (<!-- COMPLETAR: verificar tarifa actual en siteminder.com/es -->)
- Alternativas a evaluar: **RateGain** (también con presencia en LATAM) y **Cloudbeds Channel Manager** (si ya usan Cloudbeds como PMS)

**Si el hotel ya usa Cloudbeds:** integrar directamente con Cloudbeds Channel Manager API en lugar de SiteMinder — ya tiene las OTAs conectadas.

---

## Pre-requisito: tablas adicionales en la base de datos

```sql
-- Canales configurados por propiedad
CREATE TABLE IF NOT EXISTS canales (
  id          TEXT PRIMARY KEY,
  hotel_id    TEXT NOT NULL,
  nombre      TEXT NOT NULL,           -- 'booking', 'airbnb', 'expedia', 'despegar', etc.
  activo      BOOLEAN DEFAULT true,
  config      TEXT,                    -- JSON con credenciales específicas del canal (cifradas)
  created_at  TEXT NOT NULL
);

-- Mapeo de tipos de habitación local ↔ habitación en OTA
CREATE TABLE IF NOT EXISTS canal_room_mapping (
  id          TEXT PRIMARY KEY,
  canal_id    TEXT NOT NULL REFERENCES canales(id),
  room_id     TEXT NOT NULL,           -- room_id local en rooms.json / tabla rooms
  ota_room_id TEXT NOT NULL,           -- ID de la habitación en la OTA
  ota_rate_id TEXT,                    -- ID de tarifa en la OTA (opcional)
  created_at  TEXT NOT NULL
);

-- Log de sincronizaciones (auditoría y diagnóstico de errores)
CREATE TABLE IF NOT EXISTS sync_log (
  id          TEXT PRIMARY KEY,
  hotel_id    TEXT NOT NULL,
  canal_id    TEXT,
  tipo        TEXT NOT NULL,           -- 'push_disponibilidad' | 'push_tarifa' | 'pull_reserva'
  status      TEXT NOT NULL,           -- 'ok' | 'error'
  payload     TEXT,                    -- JSON del request/response
  error       TEXT,
  created_at  TEXT NOT NULL
);
```

---

## Nuevo módulo: `backend/channel-manager.js`

```js
'use strict';
// backend/channel-manager.js — Sincronización con OTAs via SiteMinder API

const SITEMINDER_API_URL = process.env.SITEMINDER_API_URL || 'https://api.siteminder.com/v1';
const SITEMINDER_API_KEY = process.env.SITEMINDER_API_KEY; // <!-- COMPLETAR -->

// ── PUSH: Actualizar disponibilidad en todos los canales activos ──────────────
// Llamar después de: crear reserva, cancelar reserva, bloquear habitación
async function pushDisponibilidad(hotelId, roomId, desde, hasta) { /* ... */ }

// ── PUSH: Actualizar tarifa en canales ──────────────────────────────────────
async function pushTarifa(hotelId, roomId, tarifa, desde, hasta) { /* ... */ }

// ── PULL: Procesar reserva entrante de OTA (llamado desde webhook) ───────────
// Crea la reserva en el sistema local + genera notificación a recepción
async function procesarReservaOTA(payload, canalId) { /* ... */ }

module.exports = { pushDisponibilidad, pushTarifa, procesarReservaOTA };
```

---

## Nuevos endpoints en `backend/server.js`

```js
const cm = require('./channel-manager');

// ── WEBHOOK: POST /api/webhook/reserva/:canalId ───────────────────────────────
// SiteMinder llama a este endpoint cuando llega una reserva de una OTA
// IMPORTANTE: verificar firma de SiteMinder antes de procesar
app.post('/api/webhook/reserva/:canalId', async (req, res) => {
  const signature = req.headers['x-siteminder-signature'];
  if (!verificarFirmaSiteMinder(signature, req.body)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }
  // Responder 200 inmediatamente (SiteMinder requiere ACK rápido)
  res.json({ received: true });
  // Procesar asíncronamente
  cm.procesarReservaOTA(req.body, req.params.canalId).catch(err =>
    console.error('[webhook] Error procesando reserva OTA:', err)
  );
});

// ── ADMIN: GET /api/admin/canales ─────────────────────────────────────────────
app.get('/api/admin/canales', adminAuth, (req, res) => { /* ... */ });

// ── ADMIN: POST /api/admin/canales ────────────────────────────────────────────
app.post('/api/admin/canales', adminAuth, async (req, res) => { /* ... */ });

// ── ADMIN: GET /api/admin/canales/:id/sync-status ─────────────────────────────
app.get('/api/admin/canales/:id/sync-status', adminAuth, (req, res) => { /* ... */ });

// ── ADMIN: POST /api/admin/canales/:id/sync-now ───────────────────────────────
// Forzar resync manual de disponibilidad desde el panel
app.post('/api/admin/canales/:id/sync-now', adminAuth, async (req, res) => { /* ... */ });
```

---

## Flujo bidireccional

### PUSH (local → OTAs): cuándo disparar

Llamar a `cm.pushDisponibilidad()` en estos puntos de `backend/server.js`:

```js
// Después de POST /api/admin/reservas (nueva reserva)
// Después de DELETE /api/admin/reservas/:id (cancelación)
// Después de POST /api/admin/token (check-in — opcional, la habitación ya estaba reservada)
// Después de DELETE /api/admin/token/:token (check-out — libera disponibilidad)
// Nunca bloquear la respuesta HTTP esperando el push — hacerlo asíncronamente
cm.pushDisponibilidad(hotelId, roomId, checkin, checkout).catch(err =>
  console.error('[cm] Push fallido, reintentar:', err)
);
```

**Nunca** hacer el push sincrónico dentro del handler del request — añadiría 200–500ms de latencia.

### PULL (OTA → local): qué hacer al recibir una reserva de OTA

```js
async function procesarReservaOTA(payload, canalId) {
  // 1. Parsear el payload de SiteMinder al formato interno
  const { hotelId, roomId, guestName, checkin, checkout, ... } = parsearPayloadSiteMinder(payload, canalId);

  // 2. Verificar disponibilidad local (puede haber conflicto si el push tuvo delay)
  const disponible = await checkDisponibilidad(roomId, checkin, checkout);
  if (!disponible) {
    await logSync({ tipo: 'pull_reserva', status: 'error', error: 'Conflicto de disponibilidad', payload });
    // Notificar a recepción del problema urgentemente
    // <!-- COMPLETAR: enviar WhatsApp o email de alerta -->
    return;
  }

  // 3. Crear reserva local con source: 'booking' | 'airbnb' | etc.
  const reserva = await createReserva(hotelId, roomId, guestName, checkin, checkout, {
    source: canalId,
    guestEmail: payload.email,
    guestPhone: payload.phone,
  });

  // 4. Registrar en log de sync
  await logSync({ tipo: 'pull_reserva', status: 'ok', canalId, payload });

  // 5. Notificar a recepción (toast en tiempo real si hay WebSocket, o badge en próximo refresh)
  // <!-- COMPLETAR: implementar notificación en tiempo real (WebSocket o polling) -->
}
```

---

## Panel de configuración de canales en el dashboard

Agregar nueva vista en `frontend/nexo-admin.html` (panel general multi-hotel, no en dashboard.html del hotel individual):

```html
<!-- VIEW: CHANNEL MANAGER -->
<div class="view" id="view-channels">
  <div class="sec-header">
    <span class="sec-title">Canales de distribución</span>
    <button class="btn btn-primary" id="btn-add-canal">+ Agregar canal</button>
  </div>

  <!-- Para cada hotel seleccionado, mostrar sus canales configurados -->
  <div id="canal-grid">
    <!-- .canal-card por canal:
         - Nombre del canal (booking.com, airbnb, etc.) con logo
         - Status (activo / inactivo / error en última sincronización)
         - Última sincronización: "hace 5 min" / "Error: 401 Unauthorized"
         - Botón "Sincronizar ahora"
         - Habitaciones mapeadas (n de m habitaciones configuradas)
    -->
  </div>
</div>
```

**No crear UI nueva desde cero** — reutilizar los mismos estilos de `.kpi-card`, `.sec-header`, `.sec-title`, `.btn`, `.badge` ya existentes en `nexo-admin.html`.

---

## Sistema de alertas

**Nunca silenciar errores de sincronización.** Ante un fallo:

1. Registrar en `sync_log` con `status: 'error'` y el mensaje de error completo
2. Mostrar badge de error en el panel de canales (`badge alert` con el texto del error)
3. Si hay 3+ fallos consecutivos del mismo canal: <!-- COMPLETAR: enviar alerta por email o WhatsApp al equipo técnico -->
4. El panel de canales debe mostrar el timestamp y mensaje del último error

```js
// Patrón para manejo de errores de sync (en channel-manager.js)
async function safePush(fn, meta) {
  try {
    await fn();
    await logSync({ ...meta, status: 'ok' });
  } catch (err) {
    await logSync({ ...meta, status: 'error', error: err.message });
    // No re-throw — el caller no debe verse afectado por fallos de canal
  }
}
```

---

## Variables de entorno a agregar en `.env`

```
# SiteMinder Channel Manager
SITEMINDER_API_URL=https://api.siteminder.com/v1    # <!-- COMPLETAR: URL real de SiteMinder -->
SITEMINDER_API_KEY=<!-- COMPLETAR: obtener en siteminder.com/es -->
SITEMINDER_WEBHOOK_SECRET=<!-- COMPLETAR: para verificar firma de webhooks -->

# URL pública del webhook (debe ser HTTPS en producción)
# Railway provee HTTPS automáticamente en .railway.app
WEBHOOK_BASE_URL=https://nexoiot-production.up.railway.app
```

---

## Commits recomendados

```
Agregar tablas canales, canal_room_mapping y sync_log en la base de datos
Crear módulo channel-manager.js con integración SiteMinder
Agregar webhook para recibir reservas de OTAs
Disparar push de disponibilidad al crear/cancelar reservas
Agregar vista de canales en el panel multi-hotel
Implementar configuración de mapeo de habitaciones por canal
Agregar sistema de log y alertas de errores de sincronización
```

---

## Marcadores COMPLETAR

- `<!-- COMPLETAR: SITEMINDER_API_KEY -->` — obtener cuenta en siteminder.com/es, precio ~USD $75-100/mes/hotel
- `<!-- COMPLETAR: SITEMINDER_WEBHOOK_SECRET -->` — configurar en el dashboard de SiteMinder
- `<!-- COMPLETAR: notificación en tiempo real -->` — WebSocket o polling para alertas de nuevas reservas OTA
- `<!-- COMPLETAR: alerta email/WhatsApp en 3+ fallos consecutivos -->` — definir canal de alerta del equipo
- `<!-- COMPLETAR: verificar tarifa actual de SiteMinder -->` — puede haber cambiado
