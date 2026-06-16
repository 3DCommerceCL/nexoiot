# Contexto del proyecto — nexo-room-app (smartrooms PMS)
## Generado por Claude Code el 16 de junio de 2026

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend runtime | Node.js ≥ 18 (usa `fetch` nativo, `crypto` nativo) |
| Framework HTTP | Express 4.x |
| Módulos | CommonJS (`'use strict'; const x = require(...)`) |
| Persistencia actual | JSON flat files en `backend/data/` — NO hay base de datos |
| IoT | Tuya OpenAPI v1.0 (HMAC-SHA256) vía `backend/tuya.js` |
| Rate limiting | `express-rate-limit` 7.x |
| Auth admin | Header `X-Admin-Key` (string plano almacenado en `.env`) |
| Frontend | Vanilla JS — sin React, Vue ni framework |
| CSS | CSS puro con variables CSS — sin Tailwind, sin Bootstrap |
| Llamadas API | `fetch()` nativo (browser y Node) |
| Hosting | Railway (auto-deploy desde `main` en GitHub) |
| Git remote | https://github.com/3DCommerceCL/nexoiot.git |
| Sin tests | No hay Jest, Mocha ni ningún framework de testing |
| Sin linting | No hay `.eslintrc` |
| Sin bundler | Archivos JS cargados directamente con `<script src>` |

---

## Estructura de archivos

```
nexo-room-app/
├── package.json              ← main: "backend/server.js", scripts: start / dev
├── .env                      ← TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, ADMIN_API_KEY, PORT, etc.
├── .env.example
├── backend/
│   ├── server.js             ← Entry point, todos los endpoints Express, middleware
│   ├── rooms.js              ← Lógica de negocio: tokens, habitaciones, solicitudes, actividad
│   ├── tuya.js               ← Integración Tuya OpenAPI + estado mock para demo mode
│   └── data/
│       ├── rooms.json        ← Habitaciones y sus dispositivos (muy grande, ~885 KB)
│       ├── hotels.json       ← Hoteles { id: { name, location } }
│       ├── tokens.json       ← Tokens de estadía activos e histórico
│       ├── requests.json     ← Solicitudes de servicio de huéspedes
│       └── activity.json     ← Log de actividad por habitación (max 500 registros global)
└── frontend/
    ├── index.html            ← App del huésped (escanea QR → controla su habitación)
    ├── app.js                ← Lógica de la app del huésped
    ├── dashboard.html        ← Panel de recepción por hotel (login + vista habitaciones)
    ├── dashboard.js          ← Lógica del dashboard de recepción
    ├── nexo-admin.html       ← Panel general multi-hotel (rol Nexo IoT)
    ├── nexo-admin.js         ← Lógica del panel multi-hotel
    ├── shared.js             ← Constantes compartidas: PLAN_TIERS, i18n, utilidades
    ├── theme.css             ← Tokens de diseño (variables CSS) — importado por todos
    ├── style.css             ← Estilos de la app del huésped
    ├── tv.html               ← Pantalla TV de habitación (muestra QR del huésped activo)
    ├── tv.js
    ├── tv.css
    └── 404.html
```

---

## Esquemas de datos (JSON flat files)

### rooms.json
```json
{
  "<roomId>": {
    "name": "Habitación 101",
    "hotel": "Hotel Demo Plaza",
    "hotelId": "demo-plaza",
    "floor": 1,
    "plan": "base" | "premium" | "max_comfort",
    "demo": true,
    "devices": {
      "<deviceKey>": {
        "deviceId": "eb24a9f...",
        "type": "door_sensor" | "light" | "light_rgb" | "curtain" | "switch" | "switch_3ch" | "ac",
        "label": "Sensor de Puerta",
        "channels": ["Entrada 1", "Entrada 2"],
        "manualUnlock": false
      }
    }
  }
}
```

### tokens.json
```json
{
  "<token>": {
    "roomId": "101",
    "guestName": "Juan Pérez",
    "phone": "+56912345678",
    "checkin": "2026-06-16T14:00:00Z",
    "checkout": "2026-06-18T12:00:00Z",
    "lang": "es" | "en" | "pt",
    "accessibility": "none" | "vision" | "hearing",
    "active": true,
    "dnd": false,
    "createdAt": "2026-06-16T14:01:00Z",
    "expiredAt": null,
    "scenes": {
      "night": { "steps": [{ "dev": "luz_techo", "cmd": { "on": false } }] },
      "custom_abc123": { "name": "Mi escena", "icon": "🌅", "steps": [...] }
    }
  }
}
```

### hotels.json
```json
{
  "demo-plaza": { "name": "Hotel Demo Plaza", "location": "Santiago, Chile" }
}
```

### requests.json
```json
[
  {
    "id": "abc1234567",
    "roomId": "101",
    "roomName": "Habitación 101",
    "hotelId": "demo-plaza",
    "guestName": "Juan Pérez",
    "type": "towels" | "roomservice",
    "note": "Necesito 3 toallas extra",
    "status": "pending" | "done",
    "createdAt": "2026-06-16T15:00:00Z",
    "resolvedAt": null
  }
]
```

### activity.json
```json
[
  {
    "id": "xyz9876",
    "roomId": "101",
    "type": "checkin" | "qr_resent" | "checkout" | "prefs_changed" | "service_request" | "request_resolved" | "scene_off",
    "detail": "Juan Pérez",
    "at": "2026-06-16T14:01:00Z"
  }
]
```

---

## Todos los endpoints existentes

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/room/:token` | — | Sirve `frontend/index.html` (app del huésped) |
| GET | `/api/room/:token` | — | Datos + estado de dispositivos de la habitación |
| POST | `/api/room/:token/command` | — | Enviar comando a un dispositivo |
| POST | `/api/room/:token/scenes` | — | Guardar escena del huésped |
| DELETE | `/api/room/:token/scenes/:id` | — | Eliminar escena |
| POST | `/api/room/:token/prefs` | — | Actualizar idioma / accesibilidad / DND |
| POST | `/api/room/:token/request` | — | Crear solicitud de servicio |
| GET | `/api/tv/:roomId` | — | Datos para pantalla TV de la habitación |
| POST | `/api/admin/token` | X-Admin-Key | Crear token de estadía (check-in) |
| POST | `/api/admin/token/:token/prefs` | X-Admin-Key | Actualizar prefs de estadía activa |
| DELETE | `/api/admin/token/:token` | X-Admin-Key | Expirar token (checkout) |
| GET | `/api/admin/tokens` | X-Admin-Key | Listar tokens activos |
| GET | `/api/admin/rooms` | X-Admin-Key | Habitaciones (`?hotel=<id>`) |
| POST | `/api/admin/rooms/:roomId/scene` | X-Admin-Key | Aplicar escena masiva (`scene: 'off'`) |
| POST | `/api/admin/rooms/:roomId/devices/:key/manual-unlock` | X-Admin-Key | Toggle control manual cortina |
| GET | `/api/admin/rooms/:roomId/activity` | X-Admin-Key | Historial de actividad |
| GET | `/api/admin/hotels` | X-Admin-Key | Hoteles con métricas de ocupación |
| GET | `/api/admin/requests` | X-Admin-Key | Solicitudes (`?hotel=<id>&status=<s>`) |
| POST | `/api/admin/requests/:id/resolve` | X-Admin-Key | Resolver solicitud |
| GET | `/health` | — | Health check + modo demo/live |

### Convención de naming de rutas
- Prefijo: `/api/` para todos los endpoints de datos
- Rutas de admin: `/api/admin/<recurso>/<id>/<acción>`
- No hay versionado (`/api/v1/` — es solo `/api/`)
- Las rutas retornan JSON siempre (excepto `/room/:token` que sirve HTML)
- Respuestas de éxito: `{ success: true, ... }` o el objeto directamente
- Respuestas de error: `{ error: "Mensaje legible", code: "CODIGO_OPCIONAL" }` + status HTTP apropiado

---

## Autenticación y autorización

- **Un solo nivel de auth**: header `X-Admin-Key` para todas las rutas `/api/admin/`
- **Sin roles**: no hay distinción entre recepcionista, gerente, dueño
- **Sin sesiones en servidor**: la clave se guarda en `localStorage` del browser (`nexo_admin_key`)
- **Sin JWT**: no hay tokens firmados, no hay expiración de sesión admin
- **Sin verificación de propiedad en el token de ruta**: cualquier admin key válida puede ver cualquier hotel
  - El filtro por hotel es solo un query param `?hotel=<id>` en las rutas que lo soportan
- El token del huésped (URL/QR) es el único mecanismo de autorización para la app de habitación

---

## Convenciones de código

```js
'use strict';
const express = require('express');  // CommonJS, no ES modules

// Async/await
async function handler(req, res) {
  try {
    const result = await someAsyncOperation();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Funciones exportadas
module.exports = { handler, otherFn };
```

- Sin `import`/`export` (CommonJS puro en backend)
- `'use strict'` al inicio de cada archivo
- `const` para todo; `let` si hay reasignación
- `async/await` en lugar de `.then()` / callbacks
- Sin clases (todo funciones)
- Comentarios con `// ── SECCIÓN ──────` para separar bloques
- Sin TypeScript

### Mensajes de commit (español, sin convencional commits)
```
Agregar historial de actividad por habitación en el panel
Corregir contraste de selects e inputs en modo oscuro
Simplificar badges de funciones bloqueadas a solo Premium o Max Comfort
```

---

## Tokens de diseño (theme.css)

```css
:root {
  --bg:          #F3F5F8;
  --card:        #FFFFFF;
  --card2:       #F4F6F9;
  --sidebar:     #FFFFFF;
  --border:      #E6E9EE;
  --teal:        #009D71;
  --teal-d:      #007A58;
  --teal-l:      rgba(0,157,113,.12);
  --purple:      #534AB7;
  --purple-l:    rgba(83,74,183,.12);
  --text:        #1A1D24;
  --text2:       #8A8FA0;
  --text3:       #C9CDD6;
  --alert:       #E5484D;
  --alert-l:     rgba(229,72,77,.10);
  --warn:        #F0A030;
  --warn-l:      rgba(240,160,48,.12);
  --header-grad: linear-gradient(135deg,#102943,#1E4066);
  --icon-bg:     #EEF2F6;
  --shadow:      0 1px 2px rgba(16,24,40,.04), 0 2px 8px rgba(16,24,40,.05);
  --font:        system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --r:           18px;
  --rsm:         10px;
}
body.theme-dark { /* override de colores para modo oscuro */ }
```

---

## Estado del PMS básico — qué hay implementado

### Implementado ✅
| Módulo | Dónde |
|--------|-------|
| Control IoT de habitaciones (luces, cortina, AC, enchufes) | `backend/server.js` + `tuya.js` |
| App del huésped (QR → panel web sin descarga) | `frontend/index.html` + `app.js` |
| Check-in (crear token de estadía) | `POST /api/admin/token` |
| Check-out (expirar token) | `DELETE /api/admin/token/:token` |
| Dashboard de recepción por hotel | `frontend/dashboard.html` + `dashboard.js` |
| Vista general con KPIs de ocupación | `frontend/dashboard.html` (view-overview) |
| Vista de habitaciones por piso con filtros y búsqueda | `frontend/dashboard.html` (view-rooms) |
| Modal de detalle de habitación con control remoto de dispositivos | `frontend/dashboard.js` |
| Generación y visualización de QR de estadía | `frontend/dashboard.js` |
| Escenas del huésped (guardar / aplicar / personalizar) | `backend/rooms.js` + `frontend/app.js` |
| Solicitudes de servicio (toallas, room service) | `backend/rooms.js` + `frontend/app.js` |
| Historial de actividad por habitación | `backend/rooms.js` + `frontend/dashboard.js` |
| Panel multi-hotel (Nexo IoT) con analíticas agregadas | `frontend/nexo-admin.html` + `nexo-admin.js` |
| Alerta en vivo AC + ventana abierta | `frontend/dashboard.js` |
| Acción masiva "apagar habitaciones con checkout hoy" | `frontend/dashboard.js` |
| Modo demo offline (sin Tuya real) | `backend/tuya.js` (`DEMO_MODE=true`) |
| Pantalla TV por habitación (QR en TV) | `frontend/tv.html` + `tv.js` |
| i18n básico (es/en/pt) en app del huésped y dashboard | `frontend/shared.js` |
| Modo oscuro manual (toggle) | `frontend/dashboard.js` |

### NO implementado ❌ — lo que faltaría para PMS completo
| Módulo | Notas |
|--------|-------|
| **Base de datos relacional** | Pre-requisito para todo lo demás. Hoy es JSON plano. |
| **Reservas futuras** | No existe tabla de reservas. El token solo cubre la estadía activa. |
| **Calendario de disponibilidad** | Imposible sin tabla de reservas. |
| **Channel manager** | No hay integración con Booking.com, Airbnb, etc. |
| **Motor de reservas público** | No hay booking engine para que el huésped reserve desde el web. |
| **Pagos / Transbank** | No hay ningún módulo de cobros. |
| **Facturación / DTE / SII** | No hay integración con sistema de facturación. |
| **Tarifas por temporada** | No existe tabla de tarifas. |
| **Roles de usuario** | Solo hay una clave admin. Sin roles granulares. |
| **Calendario drag & drop** | No hay vista de calendario en ningún panel. |

---

## Decisión arquitectónica crítica para los sprints de PMS

**Los JSON flat files no son suficientes para implementar reservas, tarifas, pagos ni channel manager.**

El prerrequisito para todos los prompts de esta carpeta es la migración a una base de datos real. La recomendación es:

- **Railway PostgreSQL** (add-on nativo en Railway, sin cambiar de hosting): más escalable, soporta concurrencia real
- **O SQLite + better-sqlite3** (más simple, sin cambio de infra, pero sin concurrencia multi-proceso)

El `backend/rooms.js` documenta internamente esto:
```js
// Los datos se guardan en JSON; reemplazar con SQLite/PG en v2.
```

**Todos los prompts de implementación asumen que este prerrequisito se resuelve primero**, y el `prompt 00` incluye el schema SQL propuesto para PostgreSQL/SQLite.

---

## Variables de entorno (.env.example)

```
TUYA_CLIENT_ID=tu_client_id_aqui
TUYA_CLIENT_SECRET=tu_client_secret_aqui
TUYA_BASE_URL=https://openapi.tuyaus.com
PORT=3000
HOTEL_URL=http://localhost:3000
ADMIN_API_KEY=cambiar_a_clave_aleatoria_larga
DEMO_MODE=true
HOTEL_NAME=Mi Hotel
```

Variables a agregar en sprints futuros:
```
# Base de datos
DATABASE_URL=postgresql://...  <!-- COMPLETAR: Railway PostgreSQL add-on -->

# Pagos
TRANSBANK_COMMERCE_CODE=<!-- COMPLETAR -->
TRANSBANK_API_KEY=<!-- COMPLETAR -->
MERCADO_PAGO_ACCESS_TOKEN=<!-- COMPLETAR -->

# Channel manager
BOOKING_API_KEY=<!-- COMPLETAR -->
SITEMINDER_API_KEY=<!-- COMPLETAR -->
```
