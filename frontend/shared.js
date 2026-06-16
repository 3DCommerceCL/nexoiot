'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// smartrooms — Utilidades compartidas (sin build step)
// Usado por app.js (app del huésped), dashboard.js (panel del hotel)
// y nexo-admin.js (panel general multi-hotel).
// ─────────────────────────────────────────────────────────────────────────────

// ── IDIOMAS Y LOCALES ─────────────────────────────────────────────────────────
const LOCALES = { es: 'es-CL', en: 'en-US', pt: 'pt-BR' };

// ── NIVELES Y ETIQUETAS DE PLAN ───────────────────────────────────────────────
const PLAN_TIERS  = { base: 0, premium: 1, max_comfort: 2 };
const PLAN_LABELS = { base: 'Base', premium: 'Premium', max_comfort: 'Max Comfort' };
const planLevel   = plan => PLAN_TIERS[plan] ?? 0;

// ── DICCIONARIO COMPARTIDO ────────────────────────────────────────────────────
// Claves de i18n con el mismo texto en app.js (huésped) y dashboard.js (panel):
// estados on/off, controles de cortina, dispositivos, secciones de clima, etc.
const SHARED_I18N = {
  es: {
    a11yNone: 'Ninguna',
    a11yVision: 'Baja visión',
    onF: 'Encendida',
    offF: 'Apagada',
    onM: 'Encendido',
    offM: 'Apagado',
    manualMode: 'Modo manual',
    unlockMotor: 'Desbloquear motor (manual)',
    allowManualUnlock: 'Permitir modo manual',
    allowManualUnlockNote: 'Si está activado, el huésped puede desbloquear el motor de la cortina para moverla a mano desde la app.',
    intensity: 'Intensidad',
    volume: 'Volumen',
    warm: 'Cálido',
    neutral: 'Neutro',
    cold: 'Frío',
    curtainClosed: 'Cerrada',
    curtainOpened: 'Abierta',
    curtainPct: '{p}% abierta',
    manualShort: 'Manual',
    tvCable: 'TV Cable',
    tvStreaming: 'Streaming',
    tvHdmi: 'HDMI',
    voiceTitle: 'Control por Voz',
    ledIndicator: 'LED indicador',
    bathTitle: 'Baño Inteligente',
    presenceSensor: 'Sensor de presencia',
    presenceYes: 'Detectada',
    presenceNo: 'Sin presencia',
    bathAuto: 'Encendido automático con presencia',
    lightOn: 'Luz encendida',
    lightOff: 'Luz apagada',
    bidetTitle: 'Baño Japonés',
    heatedSeat: 'Asiento calefaccionado',
    wash: '💧 Lavado',
    dry: '🌬 Secado',
    rugTitle: 'Alfombra Calefaccionable',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    acTitle: 'Aire Acondicionado',
    windowTitle: 'Sensor de Ventana',
    windowOpen: 'Ventana abierta',
    windowClosed: 'Ventana cerrada',
    simulateOpen: 'Simular apertura',
    simulateClose: 'Simular cierre',
    autoOffTitle: 'Apagar AC al abrir la ventana',
    autoOffDesc: 'Si está activo, el AC se apaga automáticamente y se notifica a recepción cuando se detecta una ventana abierta.',
    climateAlertMsg: 'Aire acondicionado encendido con la ventana abierta — se está desperdiciando energía',
    devices: {
      led_cama: 'LED Bajo Cama', luz_techo: 'Luz Techo', luz_velador1: 'Luz Velador 1',
      luz_velador2: 'Luz Velador 2', cortina: 'Cortina', enchufe: 'Enchufe USB', puerta: 'Puerta',
    },
  },
  en: {
    a11yNone: 'None',
    a11yVision: 'Low vision',
    onF: 'On',
    offF: 'Off',
    onM: 'On',
    offM: 'Off',
    manualMode: 'Manual mode',
    unlockMotor: 'Unlock motor (manual)',
    allowManualUnlock: 'Allow manual mode',
    allowManualUnlockNote: 'If enabled, the guest can unlock the curtain motor to move it by hand from the app.',
    intensity: 'Brightness',
    volume: 'Volume',
    warm: 'Warm',
    neutral: 'Neutral',
    cold: 'Cool',
    curtainClosed: 'Closed',
    curtainOpened: 'Open',
    curtainPct: '{p}% open',
    manualShort: 'Manual',
    tvCable: 'Cable TV',
    tvStreaming: 'Streaming',
    tvHdmi: 'HDMI',
    voiceTitle: 'Voice Control',
    ledIndicator: 'Indicator LED',
    bathTitle: 'Smart Bathroom',
    presenceSensor: 'Presence sensor',
    presenceYes: 'Detected',
    presenceNo: 'No presence',
    bathAuto: 'Auto-on with presence',
    lightOn: 'Light on',
    lightOff: 'Light off',
    bidetTitle: 'Japanese Toilet',
    heatedSeat: 'Heated seat',
    wash: '💧 Wash',
    dry: '🌬 Dry',
    rugTitle: 'Heated Rug',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    acTitle: 'Air Conditioning',
    windowTitle: 'Window Sensor',
    windowOpen: 'Window open',
    windowClosed: 'Window closed',
    simulateOpen: 'Simulate opening',
    simulateClose: 'Simulate closing',
    autoOffTitle: 'Turn AC off when the window opens',
    autoOffDesc: 'When active, the AC turns off automatically and the front desk is notified whenever an open window is detected.',
    climateAlertMsg: 'Air conditioning is on with the window open — energy is being wasted',
    devices: {
      led_cama: 'Under-bed LED', luz_techo: 'Ceiling Light', luz_velador1: 'Bedside Lamp 1',
      luz_velador2: 'Bedside Lamp 2', cortina: 'Curtain', enchufe: 'USB Outlet', puerta: 'Door',
    },
  },
  pt: {
    a11yNone: 'Nenhuma',
    a11yVision: 'Baixa visão',
    onF: 'Ligada',
    offF: 'Desligada',
    onM: 'Ligado',
    offM: 'Desligado',
    manualMode: 'Modo manual',
    unlockMotor: 'Destravar motor (manual)',
    allowManualUnlock: 'Permitir modo manual',
    allowManualUnlockNote: 'Se ativado, o hóspede pode destravar o motor da cortina para movê-la com a mão pelo app.',
    intensity: 'Intensidade',
    volume: 'Volume',
    warm: 'Quente',
    neutral: 'Neutro',
    cold: 'Frio',
    curtainClosed: 'Fechada',
    curtainOpened: 'Aberta',
    curtainPct: '{p}% aberta',
    manualShort: 'Manual',
    tvCable: 'TV a Cabo',
    tvStreaming: 'Streaming',
    tvHdmi: 'HDMI',
    voiceTitle: 'Controle por Voz',
    ledIndicator: 'LED indicador',
    bathTitle: 'Banheiro Inteligente',
    presenceSensor: 'Sensor de presença',
    presenceYes: 'Detectada',
    presenceNo: 'Sem presença',
    bathAuto: 'Ligar automaticamente com presença',
    lightOn: 'Luz acesa',
    lightOff: 'Luz apagada',
    bidetTitle: 'Vaso Japonês',
    heatedSeat: 'Assento aquecido',
    wash: '💧 Lavagem',
    dry: '🌬 Secagem',
    rugTitle: 'Tapete Aquecido',
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    acTitle: 'Ar-Condicionado',
    windowTitle: 'Sensor de Janela',
    windowOpen: 'Janela aberta',
    windowClosed: 'Janela fechada',
    simulateOpen: 'Simular abertura',
    simulateClose: 'Simular fechamento',
    autoOffTitle: 'Desligar o AC ao abrir a janela',
    autoOffDesc: 'Quando ativo, o AC desliga automaticamente e a recepção é notificada ao detectar uma janela aberta.',
    climateAlertMsg: 'Ar-condicionado ligado com a janela aberta — há desperdício de energia',
    devices: {
      led_cama: 'LED Sob a Cama', luz_techo: 'Luz do Teto', luz_velador1: 'Abajur 1',
      luz_velador2: 'Abajur 2', cortina: 'Cortina', enchufe: 'Tomada USB', puerta: 'Porta',
    },
  },
};

// ── FÁBRICA DE TRADUCTOR ──────────────────────────────────────────────────────
// dict: { es: {...}, en: {...}, pt: {...} }  ·  getLang: () => idioma actual
// Resuelve primero en dict (propio del archivo) y si no está, en SHARED_I18N.
function makeTranslator(dict, getLang, fallbackLang = 'es') {
  return function (key, vars) {
    const lang  = getLang();
    const own   = dict[lang] || dict[fallbackLang];
    const ownFb = dict[fallbackLang];
    const sh    = SHARED_I18N[lang] || SHARED_I18N[fallbackLang];
    const shFb  = SHARED_I18N[fallbackLang];
    let s = own[key] ?? sh[key] ?? ownFb[key] ?? shFb[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
}

// Etiqueta de dispositivo traducida (con fallback al label del backend)
function makeDevLabel(dict, getLang, fallbackLang = 'es') {
  return function (key, cfg) {
    const lang = getLang();
    const own = dict[lang] || dict[fallbackLang];
    const sh  = SHARED_I18N[lang] || SHARED_I18N[fallbackLang];
    return own.devices?.[key] || sh.devices?.[key] || cfg.label;
  };
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
// Cada archivo define su propio showToast(msg, type) que llama a renderToast
// con las opciones (eje de animación, duración, etc.) que le correspondan.
function renderToast(msg, { type = '', containerId = 'toast-container', duration = 3000, axis = 'x' } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`.trim();
  el.textContent = msg;
  container.appendChild(el);
  const offTransform = axis === 'y' ? 'translateY(8px)' : 'translateX(20px)';
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = offTransform;
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── FÁBRICA DE apiFetch ───────────────────────────────────────────────────────
// baseUrl: ej. API_URL  ·  getHeaders: () => headers extra (ej. Authorization: Bearer <token>)
function createApiFetch(baseUrl, getHeaders) {
  return async function apiFetch(path, opts = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(),
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error HTTP ${res.status}`);
    }
    return res.json();
  };
}
