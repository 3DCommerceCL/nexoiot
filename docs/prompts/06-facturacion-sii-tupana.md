# Prompt 06 — Facturación Electrónica SII Chile (Tupana)

> Incluir `docs/prompts/00-contexto-proyecto.md` al inicio de la sesión antes de ejecutar este prompt.

**Estimación:** 1–2 semanas de desarrollo. La habilitación como emisor DTE ante el SII toma 3–10 días hábiles adicionales y debe iniciarse en paralelo.
**Pre-requisito bloqueante:** Tabla `reservas` (prompt 01).
**Pre-requisito recomendado:** Valor UF del día (prompt 05) para calcular montos correctos. Sin él, se puede ingresar el monto manualmente.
**Requisito externo:** Cuenta Tupana activa + certificado digital de firma electrónica + habilitación DTE ante SII (ver sección "Pre-requisito de habilitación" abajo).

---

## Por qué es el diferenciador más importante

Ningún competidor directo (MiniHotel, Cloudbeds, Little Hotelier) emite documentos tributarios chilenos desde el mismo sistema. Los hoteles chilenos deben entrar manualmente al portal web del SII y emitir cada boleta o factura por separado — el proceso toma 3–5 minutos por documento. En un hotel con 15 check-outs diarios eso son 45–75 minutos de trabajo administrativo evitable.

Con esta integración: un clic desde el modal de reserva → boleta o factura electrónica emitida, enviada al SII, y PDF disponible para descargar o enviar por WhatsApp al huésped.

---

## Contexto legal

Chile exige que toda prestación de servicios emita un **Documento Tributario Electrónico (DTE)** timbrado y enviado al SII:

| Tipo DTE | Código SII | Cuándo usar |
|----------|-----------|-------------|
| Boleta electrónica | Tipo 39 | Huésped persona natural (turista, particular) |
| Factura electrónica | Tipo 33 | Empresa que paga el alojamiento (tiene RUT empresa) |
| Nota de crédito | Tipo 61 | Anular o corregir documento ya emitido |

Los documentos deben:
- Estar firmados con un **certificado digital** de la empresa emisora
- Usar **folios CAF** (Código de Autorización de Folios) pre-autorizados por el SII
- Ser enviados al SII dentro de **24 horas** de emisión
- El SII debe aceptarlos (puede rechazarlos por errores de formato o datos)

La integración directa con el SII usa XML y SOAP — complejidad alta. **Tupana** abstrae esto con una API REST moderna.

---

## Pre-requisito de habilitación (acción externa, iniciar ya)

Antes de emitir documentos reales, NEXOSMART SpA debe completar este proceso **una sola vez**:

1. **Obtener certificado digital de firma electrónica**
   - Proveedor: Acepta (acepta.com) o E-certchile
   - Costo: <!-- COMPLETAR: ~$15.000–30.000 CLP/año -->
   - El certificado es un archivo `.pfx` o `.p12` protegido con contraseña

2. **Registrarse como emisor DTE en el SII**
   - sii.cl → Servicios Online → Factura Electrónica → Registro como empresa emisora
   - Subir el certificado digital al SII
   - Solicitar **folios CAF** para Tipo 39 (boletas) y Tipo 33 (facturas)
   - El ambiente de **certificación SII** (staging) está disponible de inmediato para desarrollo

3. **Configurar cuenta en Tupana**
   - tupana.cl → crear cuenta empresa → subir certificado digital → configurar RUT NEXOSMART SpA
   - Tupana maneja la generación de XML, firma digital, envío al SII y gestión de folios
   - Costo: <!-- COMPLETAR: verificar precio por documento y/o suscripción mensual en tupana.cl -->

4. **Agregar variables de entorno**

```
# Tupana API
TUPANA_API_URL=https://api.tupana.cl/v1
TUPANA_API_KEY=<!-- COMPLETAR: obtener en panel.tupana.cl -->
TUPANA_RUT_EMISOR=<!-- COMPLETAR: RUT de NEXOSMART SpA sin puntos con guión, ej: 12345678-9 -->

# SII ambiente: 'cert' (staging para desarrollo) o 'prod' (producción real)
SII_AMBIENTE=cert

# CMF API para valor UF del día (también usada en prompt 05)
CMF_API_KEY=<!-- COMPLETAR: gratuita en api.cmfchile.cl -->
```

---

## Nueva tabla en `backend/db.js`

Agregar dentro del `db.exec()` existente, después de la tabla `reservas`:

```sql
CREATE TABLE IF NOT EXISTS documentos_tributarios (
  id              TEXT PRIMARY KEY,
  hotel_id        TEXT NOT NULL,
  reserva_id      TEXT,                  -- puede ser NULL si se emite sin reserva vinculada
  tipo            TEXT NOT NULL,         -- 'boleta' | 'factura' | 'nota_credito'
  numero_folio    INTEGER,               -- folio asignado por SII
  rut_receptor    TEXT,                  -- solo para facturas (RUT empresa con guión)
  razon_social    TEXT,                  -- solo para facturas
  giro_receptor   TEXT,                  -- giro comercial del receptor (facturas)
  monto_neto      REAL NOT NULL,         -- CLP sin IVA (para facturas: base imponible)
  iva             REAL,                  -- 19% de monto_neto (facturas). NULL en boletas.
  monto_total     REAL NOT NULL,         -- CLP total (neto + IVA para facturas; total bruto para boletas)
  uf_valor        REAL,                  -- valor UF del día de emisión (para auditoría)
  monto_uf        REAL,                  -- monto_total / uf_valor
  descripcion     TEXT NOT NULL,         -- 'Alojamiento 3 noches — Hab. 201'
  pdf_url         TEXT,                  -- URL de descarga del PDF desde Tupana
  track_id        TEXT,                  -- ID de seguimiento en SII (para consultar estado)
  sii_estado      TEXT DEFAULT 'pendiente', -- 'pendiente' | 'aceptado' | 'rechazado'
  sii_glosa       TEXT,                  -- mensaje del SII en caso de rechazo
  anulado_por     TEXT,                  -- id del documento de nota_credito que anuló este
  emitido_at      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_hotel ON documentos_tributarios(hotel_id, emitido_at);
CREATE INDEX IF NOT EXISTS idx_docs_reserva ON documentos_tributarios(reserva_id);
```

---

## Nuevo módulo: `backend/facturacion.js`

```js
'use strict';
// backend/facturacion.js — Emisión de DTE via Tupana API
// Tupana maneja: XML SII, firma digital, folios CAF, envío al SII y PDF.

const crypto = require('crypto');
const db     = require('./db');

const TUPANA_URL = process.env.TUPANA_API_URL;
const TUPANA_KEY = process.env.TUPANA_API_KEY;

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

// ── VALOR UF DEL DÍA (cache simple) ──────────────────────────────────────────
let ufCache = { valor: 41000, fecha: '' };

async function getValorUF() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (ufCache.fecha === hoy) return ufCache.valor;
  try {
    const res  = await fetch(`https://api.cmfchile.cl/api-sbifv3/recursos/v1/uf?apikey=${process.env.CMF_API_KEY}&formato=json`);
    const data = await res.json();
    const val  = parseFloat(data.UFs[0].Valor.replace(/\./g, '').replace(',', '.'));
    ufCache = { valor: val, fecha: hoy };
    return val;
  } catch {
    return ufCache.valor; // valor de respaldo si la API falla
  }
}

// ── HELPER TUPANA ─────────────────────────────────────────────────────────────
async function tupanaPost(endpoint, body) {
  const res = await fetch(`${TUPANA_URL}${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TUPANA_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || data.error || `Error Tupana ${res.status}`);
  return data;
}

// ── BOLETA ELECTRÓNICA (Tipo 39) ──────────────────────────────────────────────
// montoTotal en CLP (bruto, no desglosa IVA para boletas de servicios)
async function emitirBoleta(hotelId, reservaId, descripcion, montoTotal) {
  const ufValor   = await getValorUF();
  const montoUF   = parseFloat((montoTotal / ufValor).toFixed(4));
  const id        = genId();
  const ts        = now();

  // <!-- COMPLETAR: ajustar según documentación exacta de Tupana para boletas Tipo 39 -->
  const payload = {
    tipo:        39,                     // Tipo DTE boleta electrónica
    ambiente:    process.env.SII_AMBIENTE || 'cert',
    emisor:      { rut: process.env.TUPANA_RUT_EMISOR },
    detalles: [{
      descripcion,
      cantidad:  1,
      precio:    montoTotal,
    }],
    totales: { montoTotal },
  };

  const respuesta = await tupanaPost('/dte/emitir', payload);

  db.prepare(`
    INSERT INTO documentos_tributarios
      (id, hotel_id, reserva_id, tipo, numero_folio, monto_neto, monto_total,
       uf_valor, monto_uf, descripcion, pdf_url, track_id, sii_estado, emitido_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, hotelId, reservaId || null, 'boleta',
    respuesta.folio || null,
    montoTotal,       // boletas no desglosan neto/IVA
    montoTotal,
    ufValor, montoUF,
    descripcion,
    respuesta.pdf_url || null,
    respuesta.track_id || null,
    'pendiente',
    ts, ts, ts
  );

  return db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(id);
}

// ── FACTURA ELECTRÓNICA (Tipo 33) ─────────────────────────────────────────────
// receptor: { rut, razonSocial, giro, direccion }
// montoNeto: monto sin IVA. IVA 19% se calcula automáticamente.
async function emitirFactura(hotelId, reservaId, descripcion, montoNeto, receptor) {
  if (!validarRUT(receptor.rut)) throw new Error(`RUT inválido: ${receptor.rut}`);

  const ufValor   = await getValorUF();
  const iva       = Math.round(montoNeto * 0.19);
  const total     = montoNeto + iva;
  const montoUF   = parseFloat((total / ufValor).toFixed(4));
  const id        = genId();
  const ts        = now();

  // <!-- COMPLETAR: ajustar según documentación exacta de Tupana para facturas Tipo 33 -->
  const payload = {
    tipo:        33,
    ambiente:    process.env.SII_AMBIENTE || 'cert',
    emisor:      { rut: process.env.TUPANA_RUT_EMISOR },
    receptor: {
      rut:          receptor.rut,
      razonSocial:  receptor.razonSocial,
      giro:         receptor.giro,
      direccion:    receptor.direccion || '',
    },
    detalles: [{
      descripcion,
      cantidad: 1,
      precio:   montoNeto,
    }],
    totales: { montoNeto, iva, montoTotal: total },
  };

  const respuesta = await tupanaPost('/dte/emitir', payload);

  db.prepare(`
    INSERT INTO documentos_tributarios
      (id, hotel_id, reserva_id, tipo, numero_folio, rut_receptor, razon_social,
       giro_receptor, monto_neto, iva, monto_total, uf_valor, monto_uf,
       descripcion, pdf_url, track_id, sii_estado, emitido_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, hotelId, reservaId || null, 'factura',
    respuesta.folio || null,
    receptor.rut, receptor.razonSocial, receptor.giro || null,
    montoNeto, iva, total,
    ufValor, montoUF,
    descripcion,
    respuesta.pdf_url || null,
    respuesta.track_id || null,
    'pendiente',
    ts, ts, ts
  );

  return db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(id);
}

// ── ANULAR DOCUMENTO (emite Nota de Crédito) ──────────────────────────────────
async function anularDocumento(docId, motivo = 'Anulación') {
  const doc = db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(docId);
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.sii_estado === 'rechazado') throw new Error('No se puede anular un documento rechazado');
  if (doc.anulado_por) throw new Error('El documento ya está anulado');

  // <!-- COMPLETAR: endpoint de anulación/NC de Tupana -->
  const payload = {
    tipo:             61,
    ambiente:         process.env.SII_AMBIENTE || 'cert',
    emisor:           { rut: process.env.TUPANA_RUT_EMISOR },
    referencia_folio: doc.numero_folio,
    referencia_tipo:  doc.tipo === 'boleta' ? 39 : 33,
    motivo,
    totales: { montoTotal: doc.monto_total },
  };

  const respuesta = await tupanaPost('/dte/emitir', payload);
  const ncId = genId();
  const ts   = now();

  db.prepare(`
    INSERT INTO documentos_tributarios
      (id, hotel_id, reserva_id, tipo, numero_folio, monto_neto, monto_total,
       uf_valor, monto_uf, descripcion, pdf_url, track_id, sii_estado, emitido_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    ncId, doc.hotel_id, doc.reserva_id, 'nota_credito',
    respuesta.folio || null,
    doc.monto_neto, doc.monto_total,
    doc.uf_valor, doc.monto_uf,
    `Anulación doc. ${doc.numero_folio} — ${motivo}`,
    respuesta.pdf_url || null,
    respuesta.track_id || null,
    'pendiente',
    ts, ts, ts
  );

  db.prepare('UPDATE documentos_tributarios SET anulado_por = ?, updated_at = ? WHERE id = ?')
    .run(ncId, ts, docId);

  return { notaCredito: db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(ncId) };
}

// ── VALIDADOR RUT CHILENO ─────────────────────────────────────────────────────
function validarRUT(rut) {
  const clean = rut.replace(/[.\s]/g, '').toUpperCase();
  if (!/^\d{7,8}-[\dK]$/.test(clean)) return false;
  const [num, dv] = clean.split('-');
  let sum = 0, mul = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    sum += parseInt(num[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const expected = 11 - (sum % 11);
  const dvCalc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dvCalc === dv;
}

module.exports = { emitirBoleta, emitirFactura, anularDocumento, validarRUT, getValorUF };
```

---

## Nuevos endpoints en `backend/server.js`

```js
const facturacion = require('./facturacion');

// ── POST /api/admin/reservas/:id/boleta ───────────────────────────────────────
// Body: { descripcion?, montoTotal } (montoTotal en CLP)
app.post('/api/admin/reservas/:id/boleta', adminAuth, async (req, res) => {
  const reserva = reservas.getById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  const { montoTotal, descripcion } = req.body;
  if (!montoTotal || montoTotal <= 0) return res.status(400).json({ error: 'montoTotal requerido en CLP' });

  const desc = descripcion || generarDescripcion(reserva);
  try {
    const doc = await facturacion.emitirBoleta(reserva.hotel_id, reserva.id, desc, montoTotal);
    res.status(201).json(doc);
  } catch (err) {
    console.error('[facturacion] Error boleta:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/reservas/:id/factura ──────────────────────────────────────
// Body: { rutEmpresa, razonSocial, giro, direccion?, montoNeto, descripcion? }
app.post('/api/admin/reservas/:id/factura', adminAuth, async (req, res) => {
  const reserva = reservas.getById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  const { rutEmpresa, razonSocial, giro, direccion, montoNeto, descripcion } = req.body;
  if (!rutEmpresa || !razonSocial || !giro || !montoNeto) {
    return res.status(400).json({ error: 'Requeridos: rutEmpresa, razonSocial, giro, montoNeto' });
  }
  if (!facturacion.validarRUT(rutEmpresa)) {
    return res.status(400).json({ error: 'RUT inválido. Formato: 12345678-9' });
  }

  const desc = descripcion || generarDescripcion(reserva);
  try {
    const doc = await facturacion.emitirFactura(
      reserva.hotel_id, reserva.id, desc, montoNeto,
      { rut: rutEmpresa, razonSocial, giro, direccion }
    );
    res.status(201).json(doc);
  } catch (err) {
    console.error('[facturacion] Error factura:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/documentos ─────────────────────────────────────────────────
// ?hotel=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=boleta|factura|nota_credito
app.get('/api/admin/documentos', adminAuth, (req, res) => {
  const { hotel, desde, hasta, tipo } = req.query;
  if (!hotel) return res.status(400).json({ error: 'hotel requerido' });

  let sql  = 'SELECT * FROM documentos_tributarios WHERE hotel_id = ?';
  const params = [hotel];
  if (desde) { sql += ' AND emitido_at >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND emitido_at <= ?'; params.push(hasta + 'T23:59:59Z'); }
  if (tipo)  { sql += ' AND tipo = ?';        params.push(tipo); }
  sql += ' ORDER BY emitido_at DESC LIMIT 500';

  res.json(db.prepare(sql).all(...params));
});

// ── DELETE /api/admin/documentos/:id ──────────────────────────────────────────
// Anula el documento (emite nota de crédito). No borra el registro.
app.delete('/api/admin/documentos/:id', adminAuth, async (req, res) => {
  const { motivo } = req.body || {};
  try {
    const result = await facturacion.anularDocumento(req.params.id, motivo);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/admin/documentos/:id/pdf ─────────────────────────────────────────
// Redirige al PDF en Tupana (no expone API key al frontend)
app.get('/api/admin/documentos/:id/pdf', adminAuth, async (req, res) => {
  const doc = db.prepare('SELECT pdf_url FROM documentos_tributarios WHERE id = ?').get(req.params.id);
  if (!doc?.pdf_url) return res.status(404).json({ error: 'PDF no disponible' });
  res.redirect(doc.pdf_url);
});

// Helper: generar descripción automática desde la reserva
function generarDescripcion(reserva) {
  const noches = Math.round(
    (new Date(reserva.checkout) - new Date(reserva.checkin)) / 86400000
  );
  return `Alojamiento ${noches} noche${noches !== 1 ? 's' : ''} — ${reserva.guest_name}`;
}
```

---

## Integración en el frontend (`dashboard.js` y `dashboard.html`)

### 1. Botones en el modal de reserva del calendario

En `openReservaModal()`, cuando `reserva.status === 'checked_out'` o `'confirmed'`, agregar:

```js
// Al final del modal body, antes del cierre:
`<div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
  <button class="btn btn-outline btn-sm" id="rv-boleta">🧾 Emitir boleta</button>
  <button class="btn btn-outline btn-sm" id="rv-factura">📄 Emitir factura</button>
</div>`
```

### 2. Nova vista "Documentos" en sidebar

```html
<!-- En <nav class="sb-nav"> después del ítem Calendario -->
<div class="nav-item" data-view="documentos">
  <span class="nav-icon">🧾</span>
  <span class="nav-label">Documentos</span>
</div>
```

Vista `#view-documentos`: tabla con columnas Fecha, Tipo, Folio, Huésped/Empresa, Monto CLP, UF, Estado SII, acciones (PDF, Anular).

### 3. Modal emisión de boleta

Campos: descripción (auto-generada, editable), monto CLP (editable), equivalente UF (calculado). Botón "Emitir boleta" → spinner → éxito con link PDF.

### 4. Modal emisión de factura

Campos adicionales: RUT empresa (con validación dígito verificador en tiempo real), razón social, giro comercial, dirección, monto neto CLP (IVA y total se calculan automáticamente).

---

## Cálculo del monto sugerido

Al abrir el modal de boleta, calcular el monto a sugerir:

```js
// Fuentes en orden de prioridad:
// 1. Si hay tarifa en tabla tarifas → noches × precio_uf × uf_valor
// 2. Si la reserva tiene campo precio_total (reservas OTA con precio conocido)
// 3. Monto 0 → el recepcionista lo ingresa manualmente

async function calcularMontoSugerido(reserva) {
  const noches = Math.round(
    (new Date(reserva.checkout) - new Date(reserva.checkin)) / 86400000
  );
  // Consultar tarifa vigente para la habitación y período
  const tarifa = await apiFetch(`/admin/tarifas?room=${reserva.room_id}&fecha=${reserva.checkin}`);
  if (tarifa?.precio_uf) {
    const uf  = await apiFetch('/api/public/uf');
    return Math.round(noches * tarifa.precio_uf * uf.valor);
  }
  return 0; // ingresar manualmente
}
```

---

## Cálculo IVA para facturas

Para facturas electrónicas (B2B), el SII exige desglose de IVA:

```
Monto neto   = precio de servicio sin IVA
IVA (19%)    = monto_neto × 0.19
Monto total  = monto_neto + IVA

Ejemplo:
  Neto:  $100.000 CLP
  IVA:    $19.000 CLP
  Total: $119.000 CLP
```

Para **boletas** (B2C), el monto total incluye IVA implícito — no se desglosa en el documento (así lo define el SII para boletas Tipo 39).

---

## Consulta de estado SII (polling)

El SII puede demorar hasta 24 horas en procesar un DTE. Tupana provee un endpoint para consultar el estado:

```js
// Ejecutar cada hora para documentos en estado 'pendiente'
// (implementar con setInterval al iniciar server.js)
async function actualizarEstadosDTE() {
  const pendientes = db.prepare(
    "SELECT id, track_id FROM documentos_tributarios WHERE sii_estado = 'pendiente' LIMIT 50"
  ).all();

  for (const doc of pendientes) {
    if (!doc.track_id) continue;
    try {
      // <!-- COMPLETAR: endpoint de consulta de estado en Tupana -->
      const estado = await fetch(`${TUPANA_URL}/dte/estado/${doc.track_id}`, {
        headers: { Authorization: `Bearer ${TUPANA_KEY}` }
      }).then(r => r.json());

      db.prepare(
        'UPDATE documentos_tributarios SET sii_estado = ?, sii_glosa = ?, updated_at = ? WHERE id = ?'
      ).run(estado.estado, estado.glosa || null, now(), doc.id);
    } catch { /* no interrumpir el loop */ }
  }
}
setInterval(actualizarEstadosDTE, 60 * 60 * 1000); // cada hora
```

---

## Commits recomendados

```
Agregar tabla documentos_tributarios en SQLite
Crear módulo facturacion.js con integración Tupana (boleta, factura, NC, validador RUT)
Agregar endpoints boleta, factura, documentos, anulación y proxy PDF
Agregar polling de estado SII para documentos pendientes
Agregar botones Emitir boleta/factura en modal de reserva del calendario
Agregar vista Documentos en dashboard con tabla y descarga PDF
Implementar modal de boleta con monto sugerido desde tarifas
Implementar modal de factura con validación RUT y cálculo de IVA
```

---

## Marcadores COMPLETAR

- `<!-- COMPLETAR: TUPANA_API_KEY -->` — crear cuenta en tupana.cl, obtener API key del panel
- `<!-- COMPLETAR: precio Tupana -->` — tarifa por documento emitido (verificar en tupana.cl/precios)
- `<!-- COMPLETAR: TUPANA_RUT_EMISOR -->` — RUT de NEXOSMART SpA formato 12345678-9
- `<!-- COMPLETAR: certificado digital -->` — Acepta (acepta.com) o E-certchile, ~$15.000-30.000 CLP/año
- `<!-- COMPLETAR: endpoint estado Tupana -->` — consultar documentación exacta de Tupana para polling de estado SII
- `<!-- COMPLETAR: endpoint payload Tupana -->` — ajustar campos exactos del body según doc. de Tupana para Tipo 39 y Tipo 33
- `<!-- COMPLETAR: CMF_API_KEY -->` — registrarse en api.cmfchile.cl (gratuita) para valor UF del día
- `<!-- COMPLETAR: giro comercial NEXOSMART SpA -->` — texto exacto registrado en SII para las facturas emitidas
- `<!-- COMPLETAR: política de cancelación y NC automática -->` — ¿se emite nota de crédito automáticamente al cancelar una reserva pagada?
