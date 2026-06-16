'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// db.js — Instancia SQLite compartida (better-sqlite3, síncrono)
// El archivo nexo.db se crea en backend/data/ al primer arranque.
// En Railway: el filesystem es efímero entre deploys — agregar Railway Volume
// apuntando a /app/backend/data/ antes de ir a producción.
// ─────────────────────────────────────────────────────────────────────────────

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'data/nexo.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    id          TEXT PRIMARY KEY,
    hotel_id    TEXT NOT NULL,
    room_id     TEXT NOT NULL,
    guest_name  TEXT NOT NULL,
    guest_email TEXT,
    guest_phone TEXT,
    checkin     TEXT NOT NULL,
    checkout    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'confirmed',
    source      TEXT          DEFAULT 'direct',
    plan        TEXT,
    notes       TEXT,
    token       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reservas_hotel ON reservas(hotel_id, checkin, checkout);
  CREATE INDEX IF NOT EXISTS idx_reservas_room  ON reservas(room_id,  checkin, checkout);

  CREATE TABLE IF NOT EXISTS room_blocks (
    id         TEXT PRIMARY KEY,
    room_id    TEXT NOT NULL,
    hotel_id   TEXT NOT NULL,
    desde      DATE NOT NULL,
    hasta      DATE NOT NULL,
    motivo     TEXT,
    notas      TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_room ON room_blocks(room_id, desde, hasta);
  CREATE INDEX IF NOT EXISTS idx_blocks_hotel ON room_blocks(hotel_id, desde, hasta);

  CREATE TABLE IF NOT EXISTS canales (
    id         TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    nombre     TEXT NOT NULL,
    activo     INTEGER NOT NULL DEFAULT 1,
    config     TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_canales_hotel ON canales(hotel_id);

  CREATE TABLE IF NOT EXISTS canal_room_mapping (
    id          TEXT PRIMARY KEY,
    canal_id    TEXT NOT NULL,
    room_id     TEXT NOT NULL,
    ota_room_id TEXT NOT NULL,
    ota_rate_id TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mapping_canal ON canal_room_mapping(canal_id);

  CREATE TABLE IF NOT EXISTS sync_log (
    id         TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    canal_id   TEXT,
    tipo       TEXT NOT NULL,
    status     TEXT NOT NULL,
    payload    TEXT,
    error      TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_synclog_hotel ON sync_log(hotel_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_synclog_canal ON sync_log(canal_id, created_at);

  CREATE TABLE IF NOT EXISTS tarifas (
    id         TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    room_id    TEXT,
    nombre     TEXT NOT NULL,
    precio_uf  REAL NOT NULL,
    desde      DATE NOT NULL,
    hasta      DATE NOT NULL,
    min_noches INTEGER NOT NULL DEFAULT 1,
    activa     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tarifas_hotel ON tarifas(hotel_id, desde, hasta);

  CREATE TABLE IF NOT EXISTS booking_config (
    hotel_id          TEXT PRIMARY KEY,
    titulo            TEXT,
    color_primario    TEXT NOT NULL DEFAULT '#009D71',
    color_secundario  TEXT NOT NULL DEFAULT '#102943',
    logo_url          TEXT,
    politica_cancel   TEXT,
    idiomas           TEXT NOT NULL DEFAULT '["es"]',
    rooms_visibles    TEXT,
    activo            INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transacciones (
    id               TEXT PRIMARY KEY,
    reserva_id       TEXT,
    hotel_id         TEXT NOT NULL,
    tipo             TEXT NOT NULL,
    monto_clp        INTEGER NOT NULL,
    monto_uf         REAL,
    estado           TEXT NOT NULL DEFAULT 'pendiente',
    token_ws         TEXT,
    buy_order        TEXT,
    session_id       TEXT,
    mp_preference_id TEXT,
    mp_payment_id    TEXT,
    referencia_ota   TEXT,
    detalle          TEXT,
    guest_name       TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transacciones_reserva ON transacciones(reserva_id);
  CREATE INDEX IF NOT EXISTS idx_transacciones_hotel ON transacciones(hotel_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_transacciones_buy_order ON transacciones(buy_order);

  CREATE TABLE IF NOT EXISTS usuarios (
    id            TEXT PRIMARY KEY,
    hotel_id      TEXT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    rol           TEXT NOT NULL,
    activo        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL,
    last_login_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_usuarios_hotel ON usuarios(hotel_id);

  CREATE TABLE IF NOT EXISTS sesiones (
    token       TEXT PRIMARY KEY,
    usuario_id  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
`);

console.log('[db] SQLite listo:', DB_PATH);
module.exports = db;
