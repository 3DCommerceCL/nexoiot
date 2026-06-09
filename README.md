# Nexo IoT — Room Control App

Web app para control de habitación de hotel. El huésped escanea un QR único → accede al panel sin descargar ninguna app.

## Requisitos

- **Node.js 18+** (usa `fetch` nativo y `node --watch`)
- Cuenta en [iot.tuya.com](https://iot.tuya.com) con dispositivos vinculados

---

## Instalación rápida

```bash
cd nexo-room-app
npm install
npm run dev        # inicia con DEMO_MODE=true
```

Abre: **http://localhost:3000/room/DEMO1234**

---

## Configuración de Tuya IoT Platform (Paso 0)

### 1. Crear proyecto en iot.tuya.com

1. Ir a [iot.tuya.com](https://iot.tuya.com) → **Cloud** → **Development**
2. **Create Cloud Project** → tipo: **Smart Home**
3. Seleccionar región: para Chile usar **Americas**
4. En el proyecto: **Overview** → copiar **Client ID** y **Client Secret**

### 2. Vincular cuenta Smart Life

1. En el proyecto: **Devices** → **Link App Account**
2. Escanear el QR con la app **Smart Life** del hotel
3. Los dispositivos vinculados en Smart Life aparecen en **Devices**

### 3. Obtener los Device IDs

1. En **Devices** → ver lista de dispositivos → cada uno tiene un **Device ID**
2. Para esta instalación ya están configurados en `backend/data/rooms.json`

### 4. Configurar .env

```bash
# .env ya incluye las credenciales de la instalación:
TUYA_CLIENT_ID=qvnvgcf53m5w5qry4cvx
TUYA_CLIENT_SECRET=769f0f4dbab54b59a454a213f5dc6a87
TUYA_BASE_URL=https://openapi.tuyaus.com   # probar también tuyaeu.com si falla
```

### Verificar región Tuya

Si al pasar a modo live ves errores de firma, probar con otra URL base:
- `https://openapi.tuyaus.com` — América
- `https://openapi.tuyaeu.com` — Europa

---

## Modos de operación

### Modo Demo / Offline (por defecto)

```
DEMO_MODE=true   # en .env
```

- El servidor corre localmente, **sin llamar a Tuya**
- Los comandos actualizan estado en memoria
- Perfecto para diseño y pruebas de UI

### Modo Live (dispositivos reales)

```
DEMO_MODE=false  # en .env
```

- Requiere credenciales Tuya correctas y dispositivos online
- Los comandos van a los dispositivos físicos

---

## Dispositivos configurados (Habitación 101)

| Clave en rooms.json | Label            | Device ID                | Tipo        |
|---------------------|------------------|--------------------------|-------------|
| `puerta`            | Sensor de Puerta | `eb24a9f06a4c32ba51p42s` | door_sensor |
| `ty_mini_3ch`       | Interruptores    | `ebc06c6118bf9128ec9i9s` | switch_3ch  |
| `luz_velador`       | Luz Velador      | `eba6a890c60baf97desmep` | light       |
| `luz_techo`         | Luz Techo        | `eba435f5b263f3d00eerya` | light       |
| `led_ambiente`      | LED Ambiente     | `eb8b2178103676296ca2hk` | light_rgb   |
| `cortina`           | Cortina          | `ebaf8a7cc5374f6b26n4v6` | curtain     |
| `enchufe`           | Enchufe USB      | `ebeffe2c971f4f2b88ciac` | switch      |

---

## Agregar habitaciones a rooms.json

```json
{
  "102": {
    "name":  "Habitación 102",
    "hotel": "Hotel Demo Plaza",
    "floor": 1,
    "devices": {
      "luz_velador": {
        "deviceId": "TU_DEVICE_ID_AQUI",
        "type":     "light",
        "label":    "Luz Velador"
      }
    }
  }
}
```

Tipos de dispositivo soportados: `light`, `light_rgb`, `curtain`, `switch`, `switch_3ch`, `ac`, `door_sensor`

---

## Generar token para un huésped

### Via curl

```bash
curl -X POST http://localhost:3000/api/admin/token \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: nexo_admin_2026_cambiar_esto" \
  -d '{
    "roomId":    "101",
    "guestName": "Juan Pérez",
    "phone":     "+56912345678",
    "checkin":   "2026-06-08T14:00:00Z",
    "checkout":  "2026-06-10T12:00:00Z"
  }'
```

Respuesta:
```json
{
  "token": "a8f3x2k1",
  "url":   "http://localhost:3000/room/a8f3x2k1",
  "roomId": "101",
  "guestName": "Juan Pérez"
}
```

### Via dashboard

Usa el botón **Nueva estadía** en `dashboard.html`. Para que llame a la API real, configura el `ADMIN_API_KEY` y asegúrate de que el servidor esté corriendo.

---

## API Reference

### Endpoints del huésped

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/room/:token` | Sirve la web app del huésped |
| `GET` | `/api/room/:token` | Estado de la habitación y dispositivos |
| `POST` | `/api/room/:token/command` | Enviar comando a un dispositivo |

**Body de comando:**
```json
{ "device": "luz_velador", "command": { "on": true, "intensity": 75 } }
{ "device": "cortina",     "command": { "control": "open" } }
{ "device": "cortina",     "command": { "position": 50 } }
{ "device": "led_ambiente","command": { "hue": 270, "saturation": 800 } }
{ "device": "ac",          "command": { "temp": 22 } }
```

### Endpoints admin (requieren `X-Admin-Key`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/admin/token` | Crear nueva estadía |
| `DELETE` | `/api/admin/token/:token` | Expirar token |
| `GET` | `/api/admin/tokens` | Listar tokens activos |
| `GET` | `/api/admin/rooms` | Listar habitaciones |
| `GET` | `/health` | Estado del servidor |

---

## Desarrollo

```bash
npm run dev    # node --watch (recarga automática en Node 18+)
```

Logs del servidor muestran cada request con el token enmascarado.

---

## Despliegue en producción (PM2 + nginx)

### Con PM2

```bash
npm install -g pm2
pm2 start backend/server.js --name nexo-room
pm2 save
pm2 startup
```

### nginx reverse proxy

```nginx
server {
    listen 80;
    server_name nexoiot.cl;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Agregar en `.env`:
```
HOTEL_URL=https://nexoiot.cl
```

---

## Estructura del proyecto

```
nexo-room-app/
├── backend/
│   ├── server.js       Express + endpoints API
│   ├── tuya.js         Integración Tuya OpenAPI (HMAC-SHA256)
│   ├── rooms.js        Gestión de tokens y habitaciones
│   └── data/
│       ├── rooms.json  Config de habitaciones y device IDs
│       └── tokens.json Tokens activos (generado automáticamente)
├── frontend/
│   ├── index.html      Web app del huésped
│   ├── style.css       Estilos dark theme mobile-first
│   └── app.js          Lógica: carga, controles, optimistic UI
├── .env                Credenciales (no subir a git)
├── .env.example        Template para otros deployments
├── .gitignore
└── package.json
```

---

## Escalabilidad (v2)

Para reemplazar JSON por base de datos:
- Cambiar `backend/rooms.js` para usar **SQLite** (mejor-sqlite3) o **PostgreSQL** (pg)
- La lógica de negocio (validateToken, expireToken, etc.) no cambia
- Agregar migraciones con drizzle-orm o knex

Para WebSockets (alertas en tiempo real al dashboard):
- Agregar `ws` o `socket.io` al servidor
- Suscribir a eventos Tuya via [Tuya Message Queue Service](https://developer.tuya.com/en/docs/cloud/message-service)
