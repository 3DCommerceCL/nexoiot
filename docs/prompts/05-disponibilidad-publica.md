# Prompt 05 — Página pública de disponibilidad

> Incluir `docs/prompts/00-contexto-proyecto.md` al inicio de la sesión antes de ejecutar este prompt.

**Estimación:** 3–4 días (el endpoint ya está diseñado en el prompt 03 — este prompt lo detalla y documenta su cache, rate limiting y lógica de disponibilidad).
**Pre-requisito:** Tabla `reservas` (prompt 01) y tabla `tarifas` (prompt 03). Este módulo es la base que consume el booking engine.

---

## Objetivo

Proveer un endpoint público (sin autenticación) que retorna disponibilidad y precios en tiempo real para un hotel y rango de fechas dado. Este endpoint es consumido por:

1. El **booking engine** propio (prompt 03)
2. El **channel manager** (prompt 02) para calcular disponibilidad antes de publicar a OTAs
3. Potencialmente **Google Hotel Search** (si se configura en el futuro con Google Hotel Center)

---

## Endpoint principal

El endpoint ya está definido en el prompt 03. Este documento especifica su implementación completa.

```
GET /api/public/hotels/:slug/disponibilidad
Query params:
  checkin  = YYYY-MM-DD  (requerido)
  checkout = YYYY-MM-DD  (requerido)
```

### Respuesta exitosa (200)

```json
{
  "hotel": {
    "nombre": "Hotel Pacífico Suites",
    "slug":   "pacifico-suites",
    "logo":   "https://nexoiot-production.up.railway.app/assets/hotels/pacifico-suites/logo.png"
  },
  "checkin":  "2026-07-01",
  "checkout": "2026-07-04",
  "noches":   3,
  "rooms": [
    {
      "id":              "201",
      "nombre":          "Habitación 201",
      "plan":            "premium",
      "disponible":      true,
      "precioPorNoche":  { "uf": 11.7, "clp_referencial": 479000 },
      "precioTotal":     { "uf": 35.1, "clp_referencial": 1437000 },
      "minNoches":       1
    },
    {
      "id":              "202",
      "nombre":          "Habitación 202",
      "plan":            "base",
      "disponible":      false,
      "motivoBloqueo":   "ocupada"  /* no exponer detalles de quién → solo "ocupada" o "bloqueada" */
    }
  ]
}
```

### Respuestas de error

```json
// 400 — fechas inválidas
{ "error": "El checkin debe ser anterior al checkout", "code": "INVALID_DATES" }

// 400 — checkin en el pasado
{ "error": "No se puede consultar disponibilidad para fechas pasadas", "code": "PAST_DATES" }

// 404 — hotel no encontrado o booking engine desactivado
{ "error": "Hotel no encontrado o reservas no disponibles en este canal", "code": "HOTEL_NOT_FOUND" }

// 429 — rate limit
{ "error": "Demasiadas solicitudes. Espera un momento." }
```

---

## Implementación completa en `backend/server.js`

```js
'use strict';
// Agregar después del bloque de rutas de admin existentes
// Requiere: const disponibilidadCache = new Map(); al inicio de server.js

// Cache simple en memoria (invalida automáticamente cada 60 segundos)
// En producción con múltiples instancias de Railway → reemplazar con Redis
// Para el volumen actual de hoteles (<50) el cache en memoria es suficiente
const disponibilidadCache = new Map();
const CACHE_TTL_MS = 60 * 1000;  // 60 segundos

function getCached(key) {
  const entry = disponibilidadCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    disponibilidadCache.delete(key);
    return null;
  }
  return entry.data;
}
function setCached(key, data) {
  disponibilidadCache.set(key, { ts: Date.now(), data });
}

// Rate limiter específico para endpoints públicos (más estricto que el /api/ general)
const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,  // 30 req/min por IP (el general es 120/min)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un momento.' },
  keyGenerator: req => req.ip + ':' + req.params.slug,  // por IP + por hotel
});

// ── GET /api/public/hotels/:slug/disponibilidad ────────────────────────────────
app.get('/api/public/hotels/:slug/disponibilidad', publicLimiter, async (req, res) => {
  const { checkin, checkout } = req.query;

  // ── Validación de fechas
  if (!checkin || !checkout) {
    return res.status(400).json({ error: 'Se requieren checkin y checkout', code: 'MISSING_DATES' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
    return res.status(400).json({ error: 'Formato de fecha inválido. Usar YYYY-MM-DD', code: 'INVALID_FORMAT' });
  }
  const hoy = new Date().toISOString().slice(0, 10);
  if (checkin < hoy) {
    return res.status(400).json({ error: 'No se puede consultar disponibilidad para fechas pasadas', code: 'PAST_DATES' });
  }
  if (checkin >= checkout) {
    return res.status(400).json({ error: 'El checkin debe ser anterior al checkout', code: 'INVALID_DATES' });
  }
  const noches = (new Date(checkout) - new Date(checkin)) / 86400000;
  if (noches > 365) {
    return res.status(400).json({ error: 'El rango máximo de consulta es 365 noches', code: 'RANGE_TOO_LARGE' });
  }

  // ── Cache
  const cacheKey = `disp:${req.params.slug}:${checkin}:${checkout}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(cached);
  }

  // ── Obtener hotel por slug
  const hotel = await getHotelBySlug(req.params.slug);  // busca en DB donde slug = req.params.slug AND booking_activo = true
  if (!hotel) {
    return res.status(404).json({ error: 'Hotel no encontrado o reservas no disponibles en este canal', code: 'HOTEL_NOT_FOUND' });
  }

  // ── Calcular disponibilidad
  const todasLasRooms = await getRoomsDelHotel(hotel.id);           // rooms visibles en el booking engine (según booking_config.rooms_visibles)
  const reservasExistentes = await getReservasEnRango(hotel.id, checkin, checkout);  // status NOT IN ('cancelled', 'checked_out')
  const bloqueos = await getBloqueos(hotel.id, checkin, checkout);  // habitaciones en mantenimiento

  const tarifas = await getTarifasVigentes(hotel.id, checkin, checkout);

  const rooms = todasLasRooms.map(room => {
    // Solapamiento: reserva.checkin < checkout_pedido AND reserva.checkout > checkin_pedido
    const estaOcupada = reservasExistentes.some(r =>
      r.room_id === room.id && r.checkin < checkout && r.checkout > checkin
    );
    const estaBloqueada = bloqueos.some(b =>
      b.room_id === room.id && b.desde < checkout && b.hasta > checkin
    );

    if (estaOcupada || estaBloqueada) {
      return { id: room.id, nombre: room.nombre, plan: room.plan, disponible: false, motivoBloqueo: estaOcupada ? 'ocupada' : 'bloqueada' };
    }

    // Tarifa aplicable: tarifa específica de la habitación, o tarifa general del hotel
    const tarifa = tarifas.find(t => t.room_id === room.id) || tarifas.find(t => !t.room_id);
    const minNoches = tarifa?.min_noches || 1;
    if (noches < minNoches) {
      return { id: room.id, nombre: room.nombre, plan: room.plan, disponible: false, motivoBloqueo: `minimo_${minNoches}_noches` };
    }

    const precioUF = tarifa?.precio_uf || null;
    const clpRef   = precioUF ? Math.round(precioUF * 41000) : null;  // <!-- COMPLETAR: obtener valor UF del día del SII o CMF -->

    return {
      id:    room.id,
      nombre: room.nombre,
      plan:  room.plan,
      disponible: true,
      precioPorNoche: precioUF ? { uf: precioUF, clp_referencial: clpRef } : null,
      precioTotal:    precioUF ? { uf: +(precioUF * noches).toFixed(2), clp_referencial: clpRef * noches } : null,
      minNoches,
    };
  });

  const responseData = {
    hotel:    { nombre: hotel.nombre, slug: hotel.slug, logo: hotel.logo_url || null },
    checkin,
    checkout,
    noches,
    rooms,
  };

  setCached(cacheKey, responseData);
  res.set('X-Cache', 'MISS');
  res.set('Cache-Control', 'public, max-age=60');
  res.json(responseData);
});
```

---

## Invalidación de cache

El cache en memoria se invalida automáticamente por TTL (60 segundos). Para invalidación activa al crear/cancelar una reserva:

```js
// En backend/rooms.js o backend/reservas.js, al crear/cancelar una reserva:
function invalidarCacheDisponibilidad(hotelSlug, desde, hasta) {
  // Invalida todas las keys que afecten el rango de fechas modificado
  // Estrategia simple: eliminar todas las keys del slug
  for (const key of disponibilidadCache.keys()) {
    if (key.startsWith(`disp:${hotelSlug}:`)) {
      disponibilidadCache.delete(key);
    }
  }
}
```

Llamar a `invalidarCacheDisponibilidad` desde:
- `POST /api/admin/reservas` (nueva reserva)
- `DELETE /api/admin/reservas/:id` (cancelación)
- `PATCH /api/admin/reservas/:id` (cambio de fechas o habitación)

---

## Slug del hotel

El campo `slug` no existe en el `hotels.json` actual. Al migrar a DB, agregar:

```sql
ALTER TABLE hotels ADD COLUMN slug TEXT UNIQUE;
-- Generar slug desde el nombre: 'Hotel Pacífico Suites' → 'hotel-pacifico-suites'
-- Función de slugify: nombre.toLowerCase().replace(/[áéíóú]/g, ...).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
```

Los slugs actuales en `hotels.json` ya tienen el formato correcto: `"pacifico-suites"`, `"andes-lodge"`, etc. Usarlos como slug.

---

## Valor de la UF

El precio en CLP referencial requiere el valor del día de la UF. Opciones:

```js
// Opción A — CMF API (gratuita, oficial del Banco Central de Chile)
// GET https://api.cmfchile.cl/api-sbifv3/recursos/v1/uf/dias/[dia]/meses/[mes]/anios/[anio]?apikey=...&formato=json
// Actualizar una vez al día, guardar en memoria/DB
async function getValorUF() {
  const hoy = new Date();
  const resp = await fetch(`https://api.cmfchile.cl/api-sbifv3/recursos/v1/uf?apikey=${process.env.CMF_API_KEY}&formato=json`);
  const { UFs } = await resp.json();
  return parseFloat(UFs[0].Valor.replace('.', '').replace(',', '.'));
}

// Opción B — mindicador.cl API (<!-- COMPLETAR: registrarse en mindicador.cl para obtener API key -->)
// GET https://mindicador.cl/api/uf

// Actualizar el valor de la UF una vez al día al arrancar el servidor
let valorUFDia = 41000;  // Valor de respaldo si la API falla
async function actualizarUF() {
  try { valorUFDia = await getValorUF(); } catch {}
}
actualizarUF(); // al iniciar
setInterval(actualizarUF, 24 * 60 * 60 * 1000); // cada 24 horas
```

---

## Tabla `room_blocks` (bloqueos manuales)

Para que recepción pueda bloquear habitaciones por mantenimiento o limpieza extendida:

```sql
CREATE TABLE IF NOT EXISTS room_blocks (
  id       TEXT PRIMARY KEY,
  room_id  TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  desde    DATE NOT NULL,
  hasta    DATE NOT NULL,         -- exclusivo (hasta pero no incluyendo)
  motivo   TEXT,                  -- 'mantenimiento' | 'limpieza' | 'reservado' | 'otro'
  notas    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_room ON room_blocks(room_id, desde, hasta);
```

Endpoints de admin para gestionar bloqueos:
```
POST   /api/admin/rooms/:roomId/bloqueo     → crear bloqueo
DELETE /api/admin/bloqueos/:id              → eliminar bloqueo
GET    /api/admin/rooms/:roomId/bloqueos    → listar bloqueos activos
```

---

## Compatibilidad con Google Hotel Search (futuro)

Si en el futuro se quiere aparecer en Google Hotel Search:
- El endpoint de disponibilidad debe cumplir el formato de **Google Hotel Price Feed** (XML o API)
- Requiere configuración en **Google Hotel Center** (<!-- COMPLETAR: programa de socio de Google Hotels -->)
- El rate limiting actual (30 req/min) puede necesitar aumentarse para el crawler de Google

---

## Commits recomendados

```
Implementar endpoint público de disponibilidad con validación de fechas
Agregar cache en memoria con TTL de 60 segundos para disponibilidad
Agregar rate limiting estricto para endpoints públicos
Implementar lógica de solapamiento de reservas y bloqueos manuales
Integrar valor de UF desde API CMF para precio referencial en CLP
Agregar tabla room_blocks y endpoints de gestión de bloqueos
Invalidar cache al crear, modificar o cancelar reservas
```

---

## Marcadores COMPLETAR

- `<!-- COMPLETAR: CMF_API_KEY -->` — registrarse en cmfchile.cl para API key (gratuita)
- `<!-- COMPLETAR: mindicador.cl -->` — alternativa más simple si CMF API tiene downtime frecuente
- `<!-- COMPLETAR: booking_config.rooms_visibles -->` — definir qué habitaciones exponer públicamente por hotel
- `<!-- COMPLETAR: Google Hotel Center -->` — evaluación futura, no parte del sprint actual
- `<!-- COMPLETAR: Redis para cache multi-instancia -->` — solo necesario si Railway escala a múltiples instancias (no urgente para el volumen actual)
