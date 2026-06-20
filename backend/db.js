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

// Migración: comandos_programados pasó de un solo momento (pasos + ejecutar_en)
// a rango horario + repetición (pasos_inicio/pasos_fin, hora_inicio/hora_fin,
// repetir/fecha/dias_semana). Tabla sin uso real todavía — se recrea en vez de
// migrar datos (mismo criterio ya aplicado antes hoy a esta misma tabla).
const colsProgramados = db.prepare("PRAGMA table_info(comandos_programados)").all().map(c => c.name);
if (colsProgramados.includes('device_key') || colsProgramados.includes('ejecutar_en')) {
  db.exec('DROP TABLE comandos_programados');
}

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

  CREATE TABLE IF NOT EXISTS categorias (
    id         TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    nombre     TEXT NOT NULL,
    camas      INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_categorias_hotel ON categorias(hotel_id);

  CREATE TABLE IF NOT EXISTS tarifas (
    id           TEXT PRIMARY KEY,
    hotel_id     TEXT NOT NULL,
    room_id      TEXT,
    categoria_id TEXT,
    nombre       TEXT NOT NULL,
    precio_uf    REAL NOT NULL,
    desde        DATE NOT NULL,
    hasta        DATE NOT NULL,
    min_noches   INTEGER NOT NULL DEFAULT 1,
    activa       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL
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

  CREATE TABLE IF NOT EXISTS comandos_programados (
    id            TEXT PRIMARY KEY,
    hotel_id      TEXT NOT NULL,
    room_id       TEXT NOT NULL,
    descripcion   TEXT NOT NULL,
    pasos_inicio  TEXT NOT NULL,
    pasos_fin     TEXT,
    hora_inicio   TEXT NOT NULL,
    hora_fin      TEXT,
    repetir       TEXT NOT NULL,
    fecha         TEXT,
    dias_semana   TEXT,
    ultima_inicio TEXT,
    ultima_fin    TEXT,
    origen        TEXT NOT NULL,
    creado_por    TEXT,
    estado        TEXT NOT NULL DEFAULT 'activo',
    error         TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_prog_estado ON comandos_programados(estado);
  CREATE INDEX IF NOT EXISTS idx_prog_room   ON comandos_programados(room_id);

  CREATE TABLE IF NOT EXISTS alarmas_puerta (
    id            TEXT PRIMARY KEY,
    hotel_id      TEXT NOT NULL,
    room_id       TEXT NOT NULL,
    disparada_at  TEXT NOT NULL,
    reconocida    INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_alarmas_hotel ON alarmas_puerta(hotel_id, reconocida);

  CREATE TABLE IF NOT EXISTS facturacion_config (
    hotel_id        TEXT PRIMARY KEY,
    tupana_api_url  TEXT,
    tupana_api_key  TEXT,
    rut_emisor      TEXT,
    razon_social    TEXT,
    giro            TEXT,
    ambiente        TEXT NOT NULL DEFAULT 'cert',
    activo          INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documentos_tributarios (
    id              TEXT PRIMARY KEY,
    hotel_id        TEXT NOT NULL,
    reserva_id      TEXT,
    tipo            TEXT NOT NULL,
    numero_folio    INTEGER,
    rut_receptor    TEXT,
    razon_social    TEXT,
    giro_receptor   TEXT,
    monto_neto      REAL NOT NULL,
    iva             REAL,
    monto_total     REAL NOT NULL,
    uf_valor        REAL,
    monto_uf        REAL,
    descripcion     TEXT NOT NULL,
    pdf_url         TEXT,
    track_id        TEXT,
    sii_estado      TEXT NOT NULL DEFAULT 'pendiente',
    sii_glosa       TEXT,
    anulado_por     TEXT,
    emitido_at      TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_docs_hotel   ON documentos_tributarios(hotel_id, emitido_at);
  CREATE INDEX IF NOT EXISTS idx_docs_reserva ON documentos_tributarios(reserva_id);

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

  CREATE TABLE IF NOT EXISTS housekeeping (
    room_id    TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    estado     TEXT NOT NULL DEFAULT 'limpia',
    notas      TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_housekeeping_hotel ON housekeeping(hotel_id);

  CREATE TABLE IF NOT EXISTS reglas_rendimiento (
    id         TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    nombre     TEXT NOT NULL,
    ambito     TEXT NOT NULL,
    ambito_id  TEXT,
    umbral     INTEGER NOT NULL,
    activa     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reglas_hotel ON reglas_rendimiento(hotel_id);

  CREATE TABLE IF NOT EXISTS tarifas_dia (
    hotel_id   TEXT NOT NULL,
    ambito     TEXT NOT NULL,
    ambito_id  TEXT NOT NULL,
    fecha      DATE NOT NULL,
    precio_uf  REAL NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (hotel_id, ambito, ambito_id, fecha)
  );
  CREATE INDEX IF NOT EXISTS idx_tarifas_dia_hotel ON tarifas_dia(hotel_id, fecha);

  CREATE TABLE IF NOT EXISTS encuestas_enviadas (
    reserva_id TEXT PRIMARY KEY,
    hotel_id   TEXT NOT NULL,
    enviado_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checkin_previo (
    id              TEXT PRIMARY KEY,
    reserva_id      TEXT NOT NULL UNIQUE,
    hotel_id        TEXT NOT NULL,
    doc_tipo        TEXT NOT NULL,
    doc_numero      TEXT NOT NULL,
    telefono        TEXT,
    nombres_adicionales TEXT,
    acepta_tyc      INTEGER NOT NULL DEFAULT 0,
    firma_base64    TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_checkin_previo_hotel ON checkin_previo(hotel_id);

  CREATE TABLE IF NOT EXISTS servicios_hotel (
    id          TEXT PRIMARY KEY,
    hotel_id    TEXT NOT NULL,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    precio_clp  INTEGER,
    tipo        TEXT NOT NULL DEFAULT 'servicio',
    activo      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_servicios_hotel ON servicios_hotel(hotel_id);

  CREATE TABLE IF NOT EXISTS trial_solicitudes (
    id              TEXT PRIMARY KEY,
    hotel_nombre    TEXT NOT NULL,
    rut             TEXT NOT NULL,
    razon_social    TEXT,
    giro            TEXT,
    giro_verificado INTEGER NOT NULL DEFAULT 0,
    email           TEXT NOT NULL,
    nombre_contacto TEXT NOT NULL,
    telefono        TEXT,
    status          TEXT NOT NULL DEFAULT 'pendiente',
    motivo_rechazo  TEXT,
    hotel_id        TEXT,
    usuario_id      TEXT,
    created_at      TEXT NOT NULL,
    resuelto_at     TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_trial_status ON trial_solicitudes(status);
`);

// ── MIGRACIONES: columnas agregadas a tablas ya existentes ───────────────────
// CREATE TABLE IF NOT EXISTS no altera tablas que ya existían antes de este campo.
try { db.exec('ALTER TABLE tarifas ADD COLUMN categoria_id TEXT'); } catch { /* ya existe */ }
try { db.exec('ALTER TABLE tarifas ADD COLUMN derivada_de_id TEXT'); } catch { /* ya existe */ }
try { db.exec("ALTER TABLE tarifas ADD COLUMN derivada_modo TEXT"); } catch { /* ya existe */ }
try { db.exec('ALTER TABLE tarifas ADD COLUMN derivada_valor REAL'); } catch { /* ya existe */ }
try { db.exec('ALTER TABLE tarifas ADD COLUMN dias_semana TEXT'); } catch { /* ya existe — NULL = todos los días, o CSV de 0(domingo)-6(sábado) */ }
try { db.exec('ALTER TABLE booking_config ADD COLUMN link_resenas TEXT'); } catch { /* ya existe */ }

console.log('[db] SQLite listo:', DB_PATH);
module.exports = db;
