'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// create-usuario.js — Crea un usuario directo en SQLite (sin pasar por HTTP).
// Único uso real: crear el primer superadmin (no se puede hacer desde la UI
// sin que ya exista uno). Después de eso, gestionar usuarios desde nexo-admin.html.
//
// Uso:
//   node backend/scripts/create-usuario.js --email=admin@nexo.cl --password=xxx --nombre="Admin Nexo" --rol=superadmin
//   node backend/scripts/create-usuario.js --email=duenio@hotel.cl --password=xxx --nombre="María" --rol=owner --hotel=pacifico-suites
// ─────────────────────────────────────────────────────────────────────────────

const auth = require('../auth');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=')];
  })
);

const { email, password, nombre, rol, hotel } = args;

if (!email || !password || !nombre || !rol) {
  console.error('Uso: node backend/scripts/create-usuario.js --email=... --password=... --nombre="..." --rol=superadmin|owner|recepcion [--hotel=hotelId]');
  process.exit(1);
}
if (!['superadmin', 'owner', 'recepcion'].includes(rol)) {
  console.error('rol debe ser: superadmin, owner o recepcion');
  process.exit(1);
}
if ((rol === 'owner' || rol === 'recepcion') && !hotel) {
  console.error(`rol "${rol}" requiere --hotel=<hotelId>`);
  process.exit(1);
}
if (auth.getUsuarioByEmail(email)) {
  console.error(`Ya existe un usuario con email ${email}`);
  process.exit(1);
}

const usuario = auth.createUsuario(rol === 'superadmin' ? null : hotel, email, password, nombre, rol);
console.log('Usuario creado:');
console.log({ id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, hotel_id: usuario.hotel_id });
