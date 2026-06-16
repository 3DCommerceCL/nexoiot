# Prompt 03 — Motor de reservas directo (Booking Engine)

> Incluir `docs/prompts/00-contexto-proyecto.md` al inicio de la sesión antes de ejecutar este prompt.

**Estimación:** 2 semanas para el flujo completo (sin pagos). Pagos: ver prompt 04.
**Pre-requisito bloqueante:** Migración a PostgreSQL + tabla `reservas` (prompt 01) y tabla `tarifas` (definida abajo).

---

## Arquitectura: página pública embebible + API pública

El motor de reservas tiene dos capas:

1. **Página alojada en el servidor**: `GET /reservar/:propertySlug` — página HTML completa, ideal para enlazar desde el sitio del hotel
2. **Widget JS embebible**: una línea de código que el hotel pega en su propio sitio web

Ambas opciones consumen los mismos endpoints de la API pública (sin auth).

---

## Pre-requisito: tabla de tarifas en la base de datos

```sql
CREATE TABLE IF NOT EXISTS tarifas (
  id          TEXT PRIMARY KEY,
  hotel_id    TEXT NOT NULL,
  room_id     TEXT NOT NULL,           -- NULL = tarifa para todos los tipos
  nombre      TEXT NOT NULL,           -- 'Tarifa base', 'Temporada alta', 'Fin de semana'
  precio_uf   REAL NOT NULL,           -- Precio en UF por noche
  desde       DATE NOT NULL,           -- Inicio de vigencia
  hasta       DATE NOT NULL,           -- Fin de vigencia
  min_noches  INTEGER DEFAULT 1,       -- Mínimo de noches requeridas
  activa      BOOLEAN DEFAULT true,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tarifas_hotel ON tarifas(hotel_id, desde, hasta);

-- Configuración del booking engine por hotel
CREATE TABLE IF NOT EXISTS booking_config (
  hotel_id         TEXT PRIMARY KEY,
  titulo           TEXT,               -- 'Reserva directa — Hotel Pacífico Suites'
  color_primario   TEXT DEFAULT '#009D71',
  color_secundario TEXT DEFAULT '#102943',
  logo_url         TEXT,               -- URL de la imagen del logo del hotel
  politica_cancel  TEXT,               -- Texto libre de política de cancelación
  idiomas          TEXT DEFAULT '["es"]', -- JSON array: ["es","en"]
  rooms_visibles   TEXT,               -- JSON array de room_ids visibles en el widget (NULL = todas)
  activo           BOOLEAN DEFAULT true,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
```

---

## Endpoints de la API pública (sin autenticación)

Agregar en `backend/server.js`. Todos tienen rate limiting más estricto para evitar scraping.

```js
const bookingLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,  // 30 req/min por IP — más estricto que el /api/ general (120/min)
  message: { error: 'Demasiadas solicitudes. Espera un momento.' },
});

// ── GET /api/public/hotels/:slug/disponibilidad ────────────────────────────────
// ?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
// Sin autenticación. Rate limited. Cache de 60 segundos.
app.get('/api/public/hotels/:slug/disponibilidad', bookingLimiter, async (req, res) => {
  const { checkin, checkout } = req.query;
  if (!checkin || !checkout || checkin >= checkout) {
    return res.status(400).json({ error: 'Fechas inválidas' });
  }
  const hotel = await getHotelBySlug(req.params.slug);
  if (!hotel || !hotel.booking_activo) {
    return res.status(404).json({ error: 'Hotel no encontrado' });
  }
  const rooms = await getRoomsDisponibles(hotel.id, checkin, checkout);
  const tarifas = await getTarifasVigentes(hotel.id, checkin, checkout);
  res.set('Cache-Control', 'public, max-age=60');  // cache 60 segundos
  res.json({
    hotel:  { nombre: hotel.nombre, slug: hotel.slug, logo: hotel.logo_url },
    rooms:  rooms.map(r => ({
      id:         r.id,
      nombre:     r.nombre,
      plan:       r.plan,
      precioPorNoche: tarifas[r.id] || tarifas['base'] || null,  // UF
      disponible: true,
    })),
  });
});

// ── POST /api/public/hotels/:slug/reservas ────────────────────────────────────
// Crear reserva desde el booking engine (sin pago previo — pago al check-in)
// O con referencia de pago si se integra Transbank (ver prompt 04)
app.post('/api/public/hotels/:slug/reservas', bookingLimiter, async (req, res) => {
  const { roomId, guestName, guestEmail, guestPhone, checkin, checkout, lang } = req.body;
  // Validar todos los campos requeridos
  if (!roomId || !guestName || !guestEmail || !checkin || !checkout) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  // Validar email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  const hotel = await getHotelBySlug(req.params.slug);
  if (!hotel || !hotel.booking_activo) return res.status(404).json({ error: 'Hotel no encontrado' });

  // Verificar disponibilidad (carrera crítica — verificar justo antes de crear)
  const disponible = await checkDisponibilidad(roomId, checkin, checkout);
  if (!disponible) return res.status(409).json({ error: 'Habitación no disponible', code: 'UNAVAILABLE' });

  const reserva = await createReserva(hotel.id, roomId, guestName, checkin, checkout, {
    guestEmail, guestPhone, source: 'direct', lang: lang || 'es',
  });
  // Enviar email de confirmación al huésped <!-- COMPLETAR: integrar Resend o SendGrid -->
  res.status(201).json({ id: reserva.id, estado: 'confirmed', mensaje: 'Reserva confirmada. Recibirás un email de confirmación.' });
});

// ── Servir la página del booking engine ───────────────────────────────────────
app.get('/reservar/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/booking-engine.html'));
});
```

---

## Lógica de disponibilidad

```js
// backend/reservas.js — función de disponibilidad
// Una habitación está disponible si NO tiene reservas que se solapen
// Solapamiento: reserva existente.checkin < checkout_pedido AND reserva existente.checkout > checkin_pedido
// Excluir reservas con status 'cancelled' y 'checked_out'
// Excluir reservas bloqueadas manualmente (estado 'blocked' — ver tabla room_blocks)
// Respetar min_noches configurado para la propiedad y la temporada
async function checkDisponibilidad(roomId, checkin, checkout, excludeId = null) {
  const noches = (new Date(checkout) - new Date(checkin)) / 86400000;
  if (noches < 1) return false;

  // Consultar solapamientos en la tabla reservas
  // WHERE room_id = roomId
  // AND status NOT IN ('cancelled', 'checked_out')
  // AND checkin < checkout_pedido AND checkout > checkin_pedido
  // AND id != excludeId (para updates)

  // Consultar mínimo de noches en tarifas vigentes
  const minNoches = await getMinNoches(roomId, checkin, checkout);
  if (noches < minNoches) return false;

  return solapamientos.length === 0;
}
```

---

## Nuevo archivo: `frontend/booking-engine.html`

Página HTML standalone (no reutiliza `dashboard.html`). Usa los mismos tokens de diseño de `theme.css`.

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <!-- El color del tema se inyecta dinámicamente desde booking_config.color_primario -->
  <link rel="stylesheet" href="./theme.css">
  <title>Reserva directa</title>
</head>
<body>
  <!-- Paso 1: Selector de fechas -->
  <div id="step-fechas">...</div>

  <!-- Paso 2: Listado de habitaciones disponibles con precio -->
  <div id="step-habitaciones" class="hidden">...</div>

  <!-- Paso 3: Formulario de datos del huésped -->
  <div id="step-datos" class="hidden">...</div>

  <!-- Paso 4: Pago (Transbank Webpay o "Pago al llegar") -->
  <div id="step-pago" class="hidden">...</div>

  <!-- Paso 5: Confirmación -->
  <div id="step-confirmacion" class="hidden">...</div>

  <script src="./booking-engine.js"></script>
</body>
</html>
```

**Nuevo archivo: `frontend/booking-engine.js`** — lógica del flujo de 5 pasos.

**El slug del hotel se lee de la URL**: `window.location.pathname.split('/').pop()` → `/reservar/hotel-pacifico-suites` → `hotel-pacifico-suites`.

---

## Selector de fechas

**No usar FullCalendar** para esto. Usar un date range picker liviano:
- **Litepicker** (vanilla JS, 12 KB gzip) → `https://cdn.jsdelivr.net/npm/litepicker/dist/litepicker.js`
- O implementar manualmente con dos `<input type="date">` — más simple, compatible con todos los browsers

```js
// Opción simple con inputs nativos (recomendada para este proyecto)
const inputCheckin  = document.getElementById('checkin');
const inputCheckout = document.getElementById('checkout');

// Fecha mínima = hoy
inputCheckin.min = new Date().toISOString().slice(0, 10);
inputCheckin.addEventListener('change', () => {
  inputCheckout.min = inputCheckin.value;
  if (inputCheckout.value <= inputCheckin.value) inputCheckout.value = '';
});
```

---

## Integración de pago

Al llegar al paso 4:
- **Opción A — "Pagar al llegar"**: confirmar la reserva sin pago previo → guardar con `status: 'confirmed'`
- **Opción B — Pago con Transbank Webpay**: iniciar transacción, redirigir a Webpay, confirmar al volver

Detalles de la opción B en `docs/prompts/04-pagos-transbank.md`.

El selector entre opciones lo define `booking_config.requiere_pago_previo` (<!-- COMPLETAR: campo a agregar en tabla booking_config -->).

---

## Widget JS embebible

Una vez que la página funciona, crear el script que el hotel embebe en su sitio:

```html
<!-- El hotel pega estas 3 líneas en cualquier página de su sitio -->
<div id="smartrooms-widget" data-hotel="hotel-pacifico-suites"></div>
<script>
  window.SMARTROOMS_CONFIG = { lang: 'es', colorPrimario: '#009D71' };
</script>
<script src="https://nexoiot-production.up.railway.app/widget.js" async></script>
```

El `widget.js` crea un iframe apuntando a `/reservar/:slug` e inyecta los colores de configuración via `postMessage`.

```js
// backend/server.js — servir el widget script
app.get('/widget.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(`
    (function() {
      const el = document.getElementById('smartrooms-widget');
      if (!el) return;
      const slug = el.dataset.hotel;
      const cfg  = window.SMARTROOMS_CONFIG || {};
      const iframe = document.createElement('iframe');
      iframe.src = 'https://nexoiot-production.up.railway.app/reservar/' + slug;
      iframe.style.cssText = 'border:none;width:100%;min-height:600px;border-radius:12px';
      el.appendChild(iframe);
    })();
  `);
});
```

---

## Panel de administración del widget (en nexo-admin.html)

Nueva vista "Booking Engine" en el panel multi-hotel:
- Activar/desactivar el motor de reservas para cada hotel
- Configurar: título, color primario, logo, política de cancelación, idiomas disponibles
- Seleccionar qué habitaciones son visibles en el widget
- Configurar mínimo de noches por temporada
- Copiar código de embed con un click ("Copiar código")
- Ver URL directa del booking engine

Reutilizar los estilos de `.form-group`, `.form-input`, `.form-label`, `.btn` existentes en `nexo-admin.html`.

---

## Commits recomendados

```
Agregar tablas tarifas y booking_config en la base de datos
Agregar endpoints públicos de disponibilidad y creación de reserva
Crear página booking-engine.html con flujo de 5 pasos
Implementar selector de fechas y listado de habitaciones disponibles
Agregar formulario de datos del huésped con validación
Conectar con Transbank Webpay para pago previo (ver prompt 04)
Crear widget.js embebible para sitios externos
Agregar vista de configuración del booking engine en el panel general
```

---

## Marcadores COMPLETAR

- `<!-- COMPLETAR: integrar email de confirmación -->` — Resend (resend.com) o SendGrid; costo ~USD $0 en tier free para volumen bajo
- `<!-- COMPLETAR: booking_config.requiere_pago_previo -->` — decisión de negocio: ¿cobrar siempre al reservar, o solo al check-in?
- `<!-- COMPLETAR: política de cancelación por defecto -->` — texto legal en español
- `<!-- COMPLETAR: min_noches en temporada alta -->` — definir por propiedad
- `<!-- COMPLETAR: idiomas del widget -->` — hoy app del huésped tiene es/en/pt; ¿quieren portugués en el booking engine?
- `<!-- COMPLETAR: dominio del widget en producción -->` — actualizar URL en widget.js cuando smartrooms.cl esté registrado
