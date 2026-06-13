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

// ── FÁBRICA DE TRADUCTOR ──────────────────────────────────────────────────────
// dict: { es: {...}, en: {...}, pt: {...} }  ·  getLang: () => idioma actual
function makeTranslator(dict, getLang, fallbackLang = 'es') {
  return function (key, vars) {
    const table = dict[getLang()] || dict[fallbackLang];
    let s = table[key] ?? dict[fallbackLang][key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
}

// Etiqueta de dispositivo traducida (con fallback al label del backend)
function makeDevLabel(dict, getLang, fallbackLang = 'es') {
  return function (key, cfg) {
    const table = dict[getLang()] || dict[fallbackLang];
    return table.devices?.[key] || cfg.label;
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
// baseUrl: ej. API_URL  ·  getHeaders: () => headers extra (ej. X-Admin-Key)
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
