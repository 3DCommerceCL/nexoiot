'use strict';
// backend/facturacion.js — Emisión de DTE (boleta/factura/nota de crédito) vía
// Tupana, con credenciales y RUT emisor resueltos POR HOTEL (facturacion-config.js)
// — nunca un emisor global: el documento tributario debe salir bajo el RUT del
// hotel que presta el servicio, no el de NexoSmart.
//
// Sin credenciales activas para un hotel, el módulo no llama a Tupana — registra
// el documento con sii_estado:'simulado' y sigue el flujo normal (mismo patrón de
// modo simulación que pagos.js/channel-manager.js/verificacion-rut.js), para poder
// probar el resto de la integración (BD, endpoints, UI) sin depender de una cuenta
// Tupana real.

const crypto           = require('crypto');
const db                = require('./db');
const facturacionConfig = require('./facturacion-config');
const { validarRUT }    = require('./verificacion-rut');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

// ── VALOR UF DEL DÍA (cache propio de 24h — server.js no exporta el suyo) ────
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
    return ufCache.valor; // valor de respaldo si la API o la key fallan
  }
}

// ── HELPER TUPANA ─────────────────────────────────────────────────────────────
// La forma exacta del payload/endpoint queda a ajustar contra la documentación
// real de Tupana una vez se tenga acceso — esto no bloquea probar en simulación.
async function tupanaPost(cfg, endpoint, body) {
  const res = await fetch(`${cfg.tupana_api_url}${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cfg.tupana_api_key}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.mensaje || data.error || `Error Tupana ${res.status}`);
  return data;
}

function insertarDocumento(fields) {
  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO documentos_tributarios
      (id, hotel_id, reserva_id, tipo, numero_folio, rut_receptor, razon_social,
       giro_receptor, monto_neto, iva, monto_total, uf_valor, monto_uf,
       descripcion, pdf_url, track_id, sii_estado, sii_glosa, emitido_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, fields.hotelId, fields.reservaId || null, fields.tipo,
    fields.numeroFolio || null, fields.rutReceptor || null, fields.razonSocial || null,
    fields.giroReceptor || null, fields.montoNeto, fields.iva ?? null, fields.montoTotal,
    fields.ufValor || null, fields.montoUF || null, fields.descripcion,
    fields.pdfUrl || null, fields.trackId || null, fields.siiEstado, fields.siiGlosa || null,
    ts, ts, ts
  );
  return db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(id);
}

// ── BOLETA ELECTRÓNICA (Tipo 39) ──────────────────────────────────────────────
// montoTotal en CLP (bruto — las boletas de servicios no desglosan IVA).
async function emitirBoleta(hotelId, reservaId, descripcion, montoTotal) {
  const cfg     = facturacionConfig.getConfig(hotelId);
  const ufValor = await getValorUF();
  const montoUF = parseFloat((montoTotal / ufValor).toFixed(4));

  if (!cfg.activo || !cfg.tupana_api_key) {
    console.log(`[facturacion] SIMULADO — hotel ${hotelId} sin credenciales Tupana activas, no se emite boleta real`);
    return insertarDocumento({
      hotelId, reservaId, tipo: 'boleta', montoNeto: montoTotal, montoTotal,
      ufValor, montoUF, descripcion, siiEstado: 'simulado',
    });
  }

  const payload = {
    tipo:     39,
    ambiente: cfg.ambiente,
    emisor:   { rut: cfg.rut_emisor, razonSocial: cfg.razon_social, giro: cfg.giro },
    detalles: [{ descripcion, cantidad: 1, precio: montoTotal }],
    totales:  { montoTotal },
  };
  const respuesta = await tupanaPost(cfg, '/dte/emitir', payload);

  return insertarDocumento({
    hotelId, reservaId, tipo: 'boleta', numeroFolio: respuesta.folio,
    montoNeto: montoTotal, montoTotal, ufValor, montoUF, descripcion,
    pdfUrl: respuesta.pdf_url, trackId: respuesta.track_id, siiEstado: 'pendiente',
  });
}

// ── FACTURA ELECTRÓNICA (Tipo 33) ─────────────────────────────────────────────
// receptor: { rut, razonSocial, giro, direccion }. montoNeto sin IVA — el 19% se
// calcula automáticamente.
async function emitirFactura(hotelId, reservaId, descripcion, montoNeto, receptor) {
  if (!validarRUT(receptor.rut)) throw new Error(`RUT del receptor inválido: ${receptor.rut}`);

  const cfg     = facturacionConfig.getConfig(hotelId);
  const ufValor = await getValorUF();
  const iva     = Math.round(montoNeto * 0.19);
  const total   = montoNeto + iva;
  const montoUF = parseFloat((total / ufValor).toFixed(4));

  if (!cfg.activo || !cfg.tupana_api_key) {
    console.log(`[facturacion] SIMULADO — hotel ${hotelId} sin credenciales Tupana activas, no se emite factura real`);
    return insertarDocumento({
      hotelId, reservaId, tipo: 'factura', rutReceptor: receptor.rut,
      razonSocial: receptor.razonSocial, giroReceptor: receptor.giro || null,
      montoNeto, iva, montoTotal: total, ufValor, montoUF, descripcion, siiEstado: 'simulado',
    });
  }

  const payload = {
    tipo:     33,
    ambiente: cfg.ambiente,
    emisor:   { rut: cfg.rut_emisor, razonSocial: cfg.razon_social, giro: cfg.giro },
    receptor: { rut: receptor.rut, razonSocial: receptor.razonSocial, giro: receptor.giro, direccion: receptor.direccion || '' },
    detalles: [{ descripcion, cantidad: 1, precio: montoNeto }],
    totales:  { montoNeto, iva, montoTotal: total },
  };
  const respuesta = await tupanaPost(cfg, '/dte/emitir', payload);

  return insertarDocumento({
    hotelId, reservaId, tipo: 'factura', numeroFolio: respuesta.folio,
    rutReceptor: receptor.rut, razonSocial: receptor.razonSocial, giroReceptor: receptor.giro || null,
    montoNeto, iva, montoTotal: total, ufValor, montoUF, descripcion,
    pdfUrl: respuesta.pdf_url, trackId: respuesta.track_id, siiEstado: 'pendiente',
  });
}

// ── ANULAR DOCUMENTO (emite Nota de Crédito) ──────────────────────────────────
async function anularDocumento(docId, motivo = 'Anulación') {
  const doc = db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(docId);
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.tipo === 'nota_credito') throw new Error('No se puede anular una nota de crédito');
  if (doc.anulado_por) throw new Error('El documento ya está anulado');

  const cfg = facturacionConfig.getConfig(doc.hotel_id);
  let nc;

  if (doc.sii_estado === 'simulado' || !cfg.activo || !cfg.tupana_api_key) {
    nc = insertarDocumento({
      hotelId: doc.hotel_id, reservaId: doc.reserva_id, tipo: 'nota_credito',
      montoNeto: doc.monto_neto, montoTotal: doc.monto_total, ufValor: doc.uf_valor, montoUF: doc.monto_uf,
      descripcion: `Anulación doc. ${doc.numero_folio || '(simulado)'} — ${motivo}`, siiEstado: 'simulado',
    });
  } else {
    const payload = {
      tipo: 61, ambiente: cfg.ambiente, emisor: { rut: cfg.rut_emisor },
      referencia_folio: doc.numero_folio, referencia_tipo: doc.tipo === 'boleta' ? 39 : 33,
      motivo, totales: { montoTotal: doc.monto_total },
    };
    const respuesta = await tupanaPost(cfg, '/dte/emitir', payload);
    nc = insertarDocumento({
      hotelId: doc.hotel_id, reservaId: doc.reserva_id, tipo: 'nota_credito', numeroFolio: respuesta.folio,
      montoNeto: doc.monto_neto, montoTotal: doc.monto_total, ufValor: doc.uf_valor, montoUF: doc.monto_uf,
      descripcion: `Anulación doc. ${doc.numero_folio} — ${motivo}`,
      pdfUrl: respuesta.pdf_url, trackId: respuesta.track_id, siiEstado: 'pendiente',
    });
  }

  db.prepare('UPDATE documentos_tributarios SET anulado_por = ?, updated_at = ? WHERE id = ?')
    .run(nc.id, now(), docId);
  return { notaCredito: nc };
}

function listarDocumentos(hotelId, { desde, hasta, tipo } = {}) {
  let sql = 'SELECT * FROM documentos_tributarios WHERE hotel_id = ?';
  const params = [hotelId];
  if (desde) { sql += ' AND emitido_at >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND emitido_at <= ?'; params.push(hasta + 'T23:59:59Z'); }
  if (tipo)  { sql += ' AND tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY emitido_at DESC LIMIT 500';
  return db.prepare(sql).all(...params);
}

function getDocumento(id) {
  return db.prepare('SELECT * FROM documentos_tributarios WHERE id = ?').get(id);
}

module.exports = { emitirBoleta, emitirFactura, anularDocumento, listarDocumentos, getDocumento, getValorUF };
