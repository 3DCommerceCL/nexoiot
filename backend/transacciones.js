'use strict';
// backend/transacciones.js — CRUD de transacciones de pago (Webpay, Mercado Pago, manual)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

function createTransaccion(opts) {
  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO transacciones
      (id, reserva_id, hotel_id, tipo, monto_clp, monto_uf, estado, token_ws, buy_order,
       session_id, mp_preference_id, mp_payment_id, referencia_ota, detalle, guest_name, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    opts.reservaId || null,
    opts.hotelId,
    opts.tipo,
    opts.montoCLP,
    opts.montoUF || null,
    opts.estado || 'pendiente',
    opts.tokenWs || null,
    opts.buyOrder || null,
    opts.sessionId || null,
    opts.mpPreferenceId || null,
    opts.mpPaymentId || null,
    opts.referenciaOta || null,
    opts.detalle ? JSON.stringify(opts.detalle) : null,
    opts.guestName || null,
    ts, ts
  );
  return getById(id);
}

function parseRow(row) {
  if (!row) return null;
  try { return { ...row, detalle: row.detalle ? JSON.parse(row.detalle) : null }; }
  catch { return row; }
}

function getById(id)            { return parseRow(db.prepare('SELECT * FROM transacciones WHERE id = ?').get(id)); }
function getByBuyOrder(buyOrder){ return parseRow(db.prepare('SELECT * FROM transacciones WHERE buy_order = ?').get(buyOrder)); }
function getByTokenWs(tokenWs)  { return parseRow(db.prepare('SELECT * FROM transacciones WHERE token_ws = ?').get(tokenWs)); }

function getByReserva(reservaId) {
  return db.prepare('SELECT * FROM transacciones WHERE reserva_id = ? ORDER BY created_at DESC').all(reservaId).map(parseRow);
}

function getByHotel(hotelId, desde, hasta) {
  let sql = 'SELECT * FROM transacciones WHERE hotel_id = ?';
  const params = [hotelId];
  if (desde) { sql += ' AND created_at >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND created_at <= ?'; params.push(hasta + 'T23:59:59Z'); }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  return db.prepare(sql).all(...params).map(parseRow);
}

function updateEstado(id, estado, detalle) {
  db.prepare('UPDATE transacciones SET estado = ?, detalle = ?, updated_at = ? WHERE id = ?')
    .run(estado, detalle ? JSON.stringify(detalle) : null, now(), id);
  return getById(id);
}

function marcarPagoMP(id, mpPaymentId, estado, detalle) {
  db.prepare('UPDATE transacciones SET mp_payment_id = ?, estado = ?, detalle = ?, updated_at = ? WHERE id = ?')
    .run(mpPaymentId, estado, detalle ? JSON.stringify(detalle) : null, now(), id);
  return getById(id);
}

module.exports = {
  createTransaccion, getById, getByBuyOrder, getByTokenWs,
  getByReserva, getByHotel, updateEstado, marcarPagoMP,
};
