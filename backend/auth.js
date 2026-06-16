'use strict';
// backend/auth.js — Usuarios, contraseñas (scrypt) y sesiones (tokens opacos en SQLite)

const crypto = require('crypto');
const db     = require('./db');

const now   = () => new Date().toISOString();
const genId = () => crypto.randomBytes(8).toString('hex');

const SESION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// ── PASSWORDS ─────────────────────────────────────────────────────────────────
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(plain, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── USUARIOS ──────────────────────────────────────────────────────────────────
function createUsuario(hotelId, email, password, nombre, rol) {
  const id = genId();
  db.prepare(`
    INSERT INTO usuarios (id, hotel_id, email, password_hash, nombre, rol, activo, created_at)
    VALUES (?,?,?,?,?,?,1,?)
  `).run(id, hotelId || null, email.trim().toLowerCase(), hashPassword(password), nombre, rol, now());
  return getUsuarioById(id);
}

function getUsuarioById(id)    { return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) || null; }
function getUsuarioByEmail(e)  { return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(e.trim().toLowerCase()) || null; }

function listUsuarios(hotelId) {
  return hotelId
    ? db.prepare('SELECT id, hotel_id, email, nombre, rol, activo, created_at, last_login_at FROM usuarios WHERE hotel_id = ? ORDER BY created_at DESC').all(hotelId)
    : db.prepare('SELECT id, hotel_id, email, nombre, rol, activo, created_at, last_login_at FROM usuarios ORDER BY created_at DESC').all();
}

function updateUsuario(id, fields) {
  const ALLOWED = ['activo', 'rol', 'nombre'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length) {
    vals.push(id);
    db.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  return getUsuarioById(id);
}

function deleteUsuario(id) {
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);
  return db.prepare('DELETE FROM usuarios WHERE id = ?').run(id).changes > 0;
}

function marcarLogin(id) {
  db.prepare('UPDATE usuarios SET last_login_at = ? WHERE id = ?').run(now(), id);
}

// ── SESIONES ──────────────────────────────────────────────────────────────────
function createSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sesiones (token, usuario_id, expires_at, created_at) VALUES (?,?,?,?)')
    .run(token, usuarioId, expiresAt, now());
  return { token, expiresAt };
}

function getSesionConUsuario(token) {
  const sesion = db.prepare('SELECT * FROM sesiones WHERE token = ?').get(token);
  if (!sesion) return null;
  if (sesion.expires_at < now()) {
    db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
    return null;
  }
  const usuario = getUsuarioById(sesion.usuario_id);
  if (!usuario || !usuario.activo) return null;
  return { sesion, usuario };
}

function deleteSesion(token) {
  return db.prepare('DELETE FROM sesiones WHERE token = ?').run(token).changes > 0;
}

module.exports = {
  hashPassword, verifyPassword,
  createUsuario, getUsuarioById, getUsuarioByEmail, listUsuarios, updateUsuario, deleteUsuario, marcarLogin,
  createSesion, getSesionConUsuario, deleteSesion,
};
