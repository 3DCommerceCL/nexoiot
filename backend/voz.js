'use strict';
// backend/voz.js — Control por voz: transcribe audio y lo interpreta como comando de
// dispositivo. Pensado primero para accesibilidad (huéspedes no videntes) — push-to-talk
// en vez de un parlante siempre escuchando — y ofrecible además como add-on general.
//
// Sin OPENAI_API_KEY el módulo funciona en modo simulación: no transcribe de verdad,
// devuelve null para que el caller lo informe con claridad, igual patrón que email.js
// y channel-manager.js con sus respectivas API keys.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function transcribir(audioBuffer, mimeType) {
  if (!OPENAI_API_KEY) {
    console.log('[voz] SIMULADO — sin OPENAI_API_KEY configurada, no se transcribe de verdad');
    return null;
  }
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'es');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Whisper respondió ${res.status}: ${detalle}`);
  }
  const data = await res.json();
  return data.text || '';
}

// Construido con códigos de carácter explícitos (no literales Unicode en el fuente)
// para que el rango de marcas diacríticas combinantes no dependa de la codificación del archivo.
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');
function sinTildes(s) {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

// ── INTÉRPRETE DE COMANDOS EN ESPAÑOL ─────────────────────────────────────────
// Mapea texto transcrito a { device, command, descripcion } usando solo los
// dispositivos que existen de verdad en la habitación — nunca inventa uno.
function interpretar(texto, devices) {
  const t = sinTildes(texto || '');
  const tiene = key => !!devices[key];
  const encender = /\b(enciende|encender|prende|prender|encienda|prenda|activa|activar)\b/.test(t);
  const apagar   = /\b(apaga|apagar|apague|desactiva|desactivar)\b/.test(t);

  if (/cortina/.test(t) && tiene('cortina')) {
    if (/\b(abre|abrir|abra)\b/.test(t))      return { device: 'cortina', command: { control: 'open' },  descripcion: 'Abriendo la cortina' };
    if (/\b(cierra|cerrar|cierre)\b/.test(t)) return { device: 'cortina', command: { control: 'close' }, descripcion: 'Cerrando la cortina' };
    if (/\b(para|detente|deten|stop|alto)\b/.test(t)) return { device: 'cortina', command: { control: 'stop' }, descripcion: 'Deteniendo la cortina' };
  }

  // Estufa/calefactor — vía el canal 1 del enchufe inteligente (ver FAQ del sitio sobre
  // para qué sirve el enchufe). No hay un tipo de dispositivo "estufa" propio todavía.
  if (/(estufa|calefactor|calefaccion)/.test(t) && tiene('enchufe')) {
    if (encender) return { device: 'enchufe', command: { ch1: true },  descripcion: 'Encendiendo la estufa' };
    if (apagar)   return { device: 'enchufe', command: { ch1: false }, descripcion: 'Apagando la estufa' };
  }

  // Aire acondicionado — todavía no existe como tipo de dispositivo en los datos reales
  // (es feature de plan Premium en el roadmap); se deja listo para cuando exista la clave "aire".
  if (/(aire acondicionado|climatizador|\bclima\b)/.test(t) && tiene('aire')) {
    if (encender) return { device: 'aire', command: { on: true },  descripcion: 'Encendiendo el aire acondicionado' };
    if (apagar)   return { device: 'aire', command: { on: false }, descripcion: 'Apagando el aire acondicionado' };
  }

  // Luces — "velador 1/2", "bajo la cama", o genérico (techo por defecto)
  if (/luz|luces|led/.test(t) && (encender || apagar)) {
    let target = null;
    if (/velador\s*(1|uno)\b|primer velador/.test(t) && tiene('luz_velador1')) target = 'luz_velador1';
    else if (/velador\s*(2|dos)\b|segundo velador/.test(t) && tiene('luz_velador2')) target = 'luz_velador2';
    else if (/(a?bajo (de )?la cama|debajo de la cama)/.test(t) && tiene('led_cama')) target = 'led_cama';
    else if (tiene('luz_techo')) target = 'luz_techo';

    if (target) {
      const etiqueta = devices[target]?.label?.toLowerCase() || 'la luz';
      if (encender) return { device: target, command: { on: true },  descripcion: `Encendiendo ${etiqueta}` };
      if (apagar)   return { device: target, command: { on: false }, descripcion: `Apagando ${etiqueta}` };
    }
  }

  return null;
}

module.exports = { transcribir, interpretar };
