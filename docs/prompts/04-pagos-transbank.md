# Prompt 04 — Cobro y procesamiento de pagos (Transbank Webpay + Mercado Pago)

> Incluir `docs/prompts/00-contexto-proyecto.md` al inicio de la sesión antes de ejecutar este prompt.

**Estimación:** 1–2 semanas para integración completa (sandbox + producción).
**Pre-requisito:** Tabla `reservas` (prompt 01). No requiere channel manager ni booking engine, pero se conecta con ambos si están implementados.
**Requisito externo:** Cuenta en Transbank (comercio afiliado). Proceso de afiliación toma 3–10 días hábiles con documentación de la empresa (<!-- COMPLETAR: iniciar proceso en transbank.cl/comercios -->).

---

## Decisión: Transbank Webpay Plus como estándar, Mercado Pago como alternativa

### Por qué Transbank Webpay Plus primero:

- Es el **estándar de facto en Chile** para pagos con tarjeta de crédito y débito (Redcompra)
- Los hoteles chilenos esperan ver el logo de Transbank — genera confianza
- Webpay Plus no requiere que el huésped tenga cuenta en ningún servicio
- SDK oficial en npm: `transbank-sdk` (actualizado por Transbank Chile)

### Por qué también Mercado Pago:

- **Link de pago**: permite enviar por WhatsApp un link que el huésped puede pagar desde cualquier tarjeta, sin que la recepción tenga un terminal físico
- **QR de cobro**: útil para cobros en el counter de recepción desde el celular del recepcionista
- No requiere terminal física Transbank

---

## Instalación

```bash
npm install transbank-sdk mercadopago
```

Estas son las únicas dependencias nuevas. El resto usa `require` de Node nativo y los módulos ya instalados (`express`, `crypto`, `dotenv`).

---

## Pre-requisito: tabla de transacciones en la base de datos

```sql
CREATE TABLE IF NOT EXISTS transacciones (
  id              TEXT PRIMARY KEY,
  reserva_id      TEXT REFERENCES reservas(id),
  hotel_id        TEXT NOT NULL,
  tipo            TEXT NOT NULL,   -- 'webpay' | 'mercadopago' | 'efectivo' | 'transferencia'
  monto_clp       INTEGER NOT NULL,  -- en pesos chilenos (Transbank requiere CLP enteros)
  monto_uf        REAL,              -- referencia en UF al momento del cobro
  estado          TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'aprobado' | 'rechazado' | 'anulado'
  token_ws        TEXT,              -- token de Webpay (para reintentos y confirmación)
  buy_order       TEXT,              -- orden de compra única enviada a Transbank
  session_id      TEXT,              -- session_id enviado a Transbank
  mp_preference_id TEXT,             -- preference_id de Mercado Pago
  mp_payment_id   TEXT,              -- payment_id de Mercado Pago (confirmación)
  referencia_ota  TEXT,              -- referencia de la OTA si aplica
  detalle         TEXT,              -- JSON libre (respuesta completa de la pasarela)
  guest_name      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transacciones_reserva ON transacciones(reserva_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_hotel ON transacciones(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transacciones_buy_order ON transacciones(buy_order);
```

---

## Nuevo módulo: `backend/pagos.js`

```js
'use strict';
// backend/pagos.js — Integración con Transbank Webpay Plus y Mercado Pago

const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = require('transbank-sdk');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const crypto = require('crypto');

// ── TRANSBANK ─────────────────────────────────────────────────────────────────
// Ambiente de integración (sandbox) por defecto — cambiar en producción
const isProduction = process.env.NODE_ENV === 'production';

const txOptions = isProduction
  ? new Options(
      process.env.TRANSBANK_COMMERCE_CODE,  // <!-- COMPLETAR -->
      process.env.TRANSBANK_API_KEY,         // <!-- COMPLETAR -->
      Environment.Production
    )
  : new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration   // sandbox — tarjetas de prueba en transbank.cl/developers
    );

const tx = new WebpayPlus.Transaction(txOptions);

// ── MERCADO PAGO ──────────────────────────────────────────────────────────────
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,  // <!-- COMPLETAR -->
});

// Genera una buy_order única para Transbank (máx 26 caracteres alfanuméricos)
function genBuyOrder() {
  return 'NX' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ── INICIAR PAGO WEBPAY ───────────────────────────────────────────────────────
async function iniciarWebpay(reservaId, montoCLP, returnUrl) {
  const buyOrder  = genBuyOrder();
  const sessionId = crypto.randomBytes(8).toString('hex');

  const response = await tx.create(buyOrder, sessionId, montoCLP, returnUrl);
  // response: { token: string, url: string }
  return { token: response.token, url: response.url, buyOrder, sessionId };
}

// ── CONFIRMAR PAGO WEBPAY (llamado desde el return_url) ──────────────────────
async function confirmarWebpay(tokenWs) {
  const response = await tx.commit(tokenWs);
  // response.response_code === 0 → aprobado
  // response.response_code !== 0 → rechazado
  return response;
}

// ── CREAR LINK DE PAGO MERCADO PAGO ──────────────────────────────────────────
async function crearLinkMP(reservaId, montoCLP, descripcion, guestEmail) {
  const preference = new Preference(mpClient);
  const result = await preference.create({
    body: {
      items: [{ title: descripcion, unit_price: montoCLP, quantity: 1, currency_id: 'CLP' }],
      payer: { email: guestEmail || '' },
      back_urls: {
        success: `${process.env.HOTEL_URL}/api/pagos/mp-callback?status=success&reserva=${reservaId}`,
        failure: `${process.env.HOTEL_URL}/api/pagos/mp-callback?status=failure&reserva=${reservaId}`,
      },
      auto_return: 'approved',
      external_reference: reservaId,
    },
  });
  return { preferenceId: result.id, linkPago: result.init_point };
}

module.exports = { iniciarWebpay, confirmarWebpay, crearLinkMP, genBuyOrder };
```

---

## Endpoints en `backend/server.js`

```js
const pagos = require('./pagos');

// ── ADMIN: POST /api/admin/reservas/:id/pago/webpay ───────────────────────────
// Inicia un pago Webpay para una reserva desde el dashboard de recepción
app.post('/api/admin/reservas/:id/pago/webpay', adminAuth, async (req, res) => {
  const { montoCLP } = req.body;
  if (!montoCLP || montoCLP < 1) return res.status(400).json({ error: 'Monto inválido' });

  const returnUrl = `${process.env.HOTEL_URL}/api/pagos/webpay-return`;
  try {
    const { token, url, buyOrder, sessionId } = await pagos.iniciarWebpay(req.params.id, montoCLP, returnUrl);
    // Guardar en tabla transacciones con estado 'pendiente'
    await crearTransaccion({ reservaId: req.params.id, tipo: 'webpay', montoCLP, tokenWs: token, buyOrder, sessionId });
    res.json({ url, token });  // frontend redirige a url con token
  } catch (err) {
    res.status(500).json({ error: 'Error iniciando pago Webpay', detail: err.message });
  }
});

// ── ADMIN: GET /api/pagos/webpay-return ────────────────────────────────────────
// Transbank redirige aquí después del pago (éxito o fracaso)
// No requiere adminAuth — es el return URL público de Webpay
app.get('/api/pagos/webpay-return', async (req, res) => {
  const { token_ws, TBK_TOKEN, TBK_ORDEN_COMPRA } = req.query;

  // Si TBK_TOKEN está presente → el usuario canceló en Webpay
  if (TBK_TOKEN && !token_ws) {
    await marcarTransaccionCancelada(TBK_ORDEN_COMPRA);
    return res.redirect('/dashboard.html?pago=cancelado');
  }

  try {
    const response = await pagos.confirmarWebpay(token_ws);
    if (response.response_code === 0) {
      await marcarTransaccionAprobada(token_ws, response);
      res.redirect('/dashboard.html?pago=aprobado');
    } else {
      await marcarTransaccionRechazada(token_ws, response);
      res.redirect('/dashboard.html?pago=rechazado');
    }
  } catch (err) {
    console.error('[webpay] Error en return:', err);
    res.redirect('/dashboard.html?pago=error');
  }
});

// ── ADMIN: POST /api/admin/reservas/:id/pago/link-mp ─────────────────────────
// Genera un link de Mercado Pago para enviar al huésped por WhatsApp
app.post('/api/admin/reservas/:id/pago/link-mp', adminAuth, async (req, res) => {
  const { montoCLP, descripcion, guestEmail } = req.body;
  try {
    const { linkPago, preferenceId } = await pagos.crearLinkMP(req.params.id, montoCLP, descripcion, guestEmail);
    await crearTransaccion({ reservaId: req.params.id, tipo: 'mercadopago', montoCLP, mpPreferenceId: preferenceId });
    res.json({ linkPago });
  } catch (err) {
    res.status(500).json({ error: 'Error generando link de pago', detail: err.message });
  }
});

// ── ADMIN: POST /api/admin/reservas/:id/pago/manual ──────────────────────────
// Registrar pago en efectivo o transferencia bancaria
app.post('/api/admin/reservas/:id/pago/manual', adminAuth, async (req, res) => {
  const { montoCLP, tipo, referencia } = req.body;
  if (!montoCLP || !['efectivo', 'transferencia'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser "efectivo" o "transferencia"' });
  }
  await crearTransaccion({
    reservaId: req.params.id,
    tipo,
    montoCLP,
    estado: 'aprobado',  // manual = ya recibido
    detalle: { referencia },
  });
  res.json({ success: true });
});

// ── WEBHOOK: POST /api/webhook/mercadopago ────────────────────────────────────
// Mercado Pago notifica el resultado del pago
app.post('/api/webhook/mercadopago', async (req, res) => {
  const { type, data } = req.body;
  res.json({ received: true }); // ACK inmediato
  if (type === 'payment') {
    // Consultar el pago y actualizar la transacción
    // mp.get('/v1/payments/:id') → si status === 'approved' → marcar aprobado
  }
});

// ── ADMIN: GET /api/admin/transacciones ───────────────────────────────────────
// ?hotel=<id>&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
app.get('/api/admin/transacciones', adminAuth, async (req, res) => { /* ... */ });
```

---

## Flujos desde el dashboard

### Flujo 1: Pago al check-in desde el dashboard de recepción

En el modal de detalle de habitación (`#modal-room` en `dashboard.html`), agregar nueva sección "Cobros" si la reserva tiene `status: 'confirmed'`:

```html
<!-- Agregar en .modal-body, después del QR section -->
<div class="modal-section" id="mr-cobros-section">
  <div class="modal-section-title">Cobros</div>
  <div class="cobros-grid">
    <!-- Monto calculado automáticamente desde tarifa × noches -->
    <div class="cobro-monto">$XXX.XXX CLP (X noches × tarifa)</div>
    <div class="cobros-acciones">
      <button class="btn btn-primary" id="btn-pagar-webpay">💳 Pagar con tarjeta</button>
      <button class="btn btn-outline-teal" id="btn-link-mp">📱 Enviar link WhatsApp</button>
      <button class="btn btn-outline" id="btn-pago-manual">✓ Registrar efectivo/transferencia</button>
    </div>
  </div>
</div>
```

El botón "Pagar con tarjeta" llama a `POST /api/admin/reservas/:id/pago/webpay` y abre `response.url` en una ventana nueva. Al volver, el dashboard detecta `?pago=aprobado` en la URL y refresca el modal.

### Flujo 2: Link de pago por WhatsApp

1. Recepcionista hace clic en "Enviar link WhatsApp"
2. Dashboard llama a `POST /api/admin/reservas/:id/pago/link-mp`
3. Recibe `{ linkPago: "https://www.mercadopago.cl/..." }`
4. Dashboard abre `https://wa.me/56XXXXXXXXX?text=...linkPago...` en nueva ventana
5. El recepcionista envía el link al huésped desde WhatsApp Web

### Flujo 3: Pago desde el booking engine

Si el booking engine (prompt 03) está implementado y `requiere_pago_previo = true`:
- El paso 4 del flujo del huésped inicia Webpay o muestra el formulario de MP
- La URL de retorno del pago redirige a la página de confirmación del booking engine
- No al `dashboard.html` (que no es público)

---

## Integración con SII (facturación electrónica)

> Este sub-módulo es opcional y se puede implementar en sprint separado.

Al confirmar un pago (`estado: 'aprobado'`), si el hotel tiene configurada la emisión de DTE:

```js
// Si el hotel requiere factura electrónica al confirmar pago
if (hotel.emite_dte && transaccion.estado === 'aprobado') {
  // Integrar con API de DTE → opciones para Chile:
  // - Facturador.cl API (<!-- COMPLETAR: cotizar -->)
  // - Bsale API (<!-- COMPLETAR: cotizar, tiene integración con hotelería -->)
  // - SII directo (requiere certificado digital de la empresa)
  await emitirDTE(reserva, transaccion);
}
```

---

## Ambiente de pruebas de Transbank

En el ambiente de integración (`Environment.Integration`):
- Tarjeta de crédito de prueba: `4051 8856 0044 6623`, CVV: `123`, cualquier fecha de expiración futura
- Tarjeta de débito de prueba: `4051 8842 3993 7763`, PIN: `1234`
- Documentación completa: https://www.transbankdevelopers.cl/referencia/webpay

---

## Variables de entorno a agregar en `.env`

```
# Transbank Webpay Plus
TRANSBANK_COMMERCE_CODE=<!-- COMPLETAR: código de comercio asignado por Transbank -->
TRANSBANK_API_KEY=<!-- COMPLETAR: API key asignada por Transbank -->
# NODE_ENV=production para usar credenciales de producción (default: integración/sandbox)

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=<!-- COMPLETAR: obtener en mercadopago.cl/developers -->
```

---

## Commits recomendados

```
Agregar tabla transacciones en la base de datos
Instalar transbank-sdk y mercadopago
Crear módulo pagos.js con integración Webpay Plus y Mercado Pago
Agregar endpoints de inicio y confirmación de pago Webpay
Agregar endpoint de generación de link de pago Mercado Pago
Agregar endpoint de registro de pago manual (efectivo/transferencia)
Integrar sección de cobros en el modal de detalle de habitación
Agregar historial de transacciones en el panel general
```

---

## Marcadores COMPLETAR

- `<!-- COMPLETAR: iniciar afiliación Transbank -->` — transbank.cl/comercios, tarda 3–10 días hábiles
- `<!-- COMPLETAR: TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY -->` — los entrega Transbank al afiliarse
- `<!-- COMPLETAR: MERCADO_PAGO_ACCESS_TOKEN -->` — mercadopago.cl/developers, se puede tener cuenta de prueba inmediatamente
- `<!-- COMPLETAR: integración DTE/factura electrónica -->` — evaluar Bsale o Facturador.cl, contactar para pricing por hotel
- `<!-- COMPLETAR: número WhatsApp de recepción para link MP -->` — reemplazar en el template del mensaje
