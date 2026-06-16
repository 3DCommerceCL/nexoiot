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
`);

console.log('[db] SQLite listo:', DB_PATH);
module.exports = db;
