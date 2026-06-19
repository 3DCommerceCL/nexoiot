'use strict';
// backend/verificacion-rut.js — Validación de RUT chileno y verificación de giro
// para el registro self-serve del trial de PMS.
//
// Sin RUT_VERIFICATION_API_KEY el módulo funciona en modo simulación: valida el
// formato del RUT (gratis, instantáneo) pero no confirma el giro real contra el
// SII — mismo patrón que voz.js/channel-manager.js. El proveedor real (SimpleAPI,
// BaseAPI u otro, todavía sin elegir) se conecta cambiando solo consultarGiro().

const RUT_API_URL = process.env.RUT_VERIFICATION_API_URL;
const RUT_API_KEY = process.env.RUT_VERIFICATION_API_KEY;

function limpiarRUT(rut) {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

// Módulo 11 — algoritmo estándar de validación de RUT chileno.
function validarRUT(rut) {
  const limpio = limpiarRUT(rut);
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv     = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === dvEsperado;
}

// Coincide contra la descripción de texto del giro (el que devuelva la API de
// verificación, o el autodeclarado en modo simulación) — no contra un código
// ACTECO específico, porque ese formato depende de qué proveedor se termine
// eligiendo (ver comparación hecha con el usuario antes de este módulo).
const PALABRAS_GIRO_HOTELERO = [
  'hotel', 'hostal', 'hosteria', 'cabana', 'resort', 'motel',
  'alojamiento', 'hospedaje', 'apart hotel', 'aparthotel',
  'camping', 'lodge', 'posada', 'turismo', 'turistico', 'turistica',
];

function sinTildes(s) {
  const DIAC = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');
  return (s || '').toLowerCase().normalize('NFD').replace(DIAC, '');
}

function esGiroHotelero(giroTexto) {
  const t = sinTildes(giroTexto);
  return PALABRAS_GIRO_HOTELERO.some(p => t.includes(p));
}

// ── CONSULTA DE GIRO CONTRA UN PROVEEDOR EXTERNO ──────────────────────────────
async function consultarGiro(rut) {
  if (!RUT_API_KEY) {
    console.log('[verificacion-rut] SIMULADO — sin RUT_VERIFICATION_API_KEY configurada, no se consulta el SII de verdad');
    return { verificado: false, giro: null, razonSocial: null };
  }

  const res = await fetch(`${RUT_API_URL}/${limpiarRUT(rut)}`, {
    headers: { Authorization: `Bearer ${RUT_API_KEY}` },
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Verificación de RUT respondió ${res.status}: ${detalle}`);
  }
  const data = await res.json();
  // COMPLETAR: ajustar nombres de campo según la respuesta real del proveedor
  // elegido (SimpleAPI / BaseAPI / otro) — todavía no se ha confirmado cuál.
  return {
    verificado:  true,
    giro:        data.giro || data.actividad || null,
    razonSocial: data.razonSocial || data.razon_social || null,
  };
}

module.exports = { validarRUT, limpiarRUT, esGiroHotelero, consultarGiro };
