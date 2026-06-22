'use strict';
const API = '/api';
const card = document.getElementById('encuesta-card');

function getToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}

function renderError(msg) {
  card.innerHTML = `<div class="encuesta-ico">⚠️</div><h1>No se pudo cargar la encuesta</h1><p class="encuesta-sub">${msg}</p>`;
}

function renderThanks() {
  card.innerHTML = `<div class="encuesta-ico">🙏</div><h1>¡Gracias por tu respuesta!</h1><p class="encuesta-sub">Tu opinión nos ayuda a mejorar.</p>`;
}

function renderForm(data) {
  const respuestas = {};
  const preguntasHtml = data.preguntas.map(p => {
    if (p.tipo === 'rating') {
      const botones = [1, 2, 3, 4, 5].map(n =>
        `<button type="button" class="pref-btn" data-pregunta="${p.id}" data-valor="${n}">${n}</button>`
      ).join('');
      return `<div class="encuesta-pregunta"><label>${p.texto}</label><div class="encuesta-rating">${botones}</div></div>`;
    }
    return `<div class="encuesta-pregunta"><label>${p.texto}</label><textarea class="report-other-textarea" data-pregunta="${p.id}" rows="3"></textarea></div>`;
  }).join('');

  card.innerHTML = `
    <h1>${data.hotelNombre || 'Encuesta de satisfacción'}</h1>
    <p class="encuesta-sub">${data.guestName ? `Hola ${data.guestName}, ` : ''}cuéntanos cómo fue tu estadía.</p>
    ${preguntasHtml}
    <button type="button" class="support-btn" id="encuesta-enviar" style="width:100%;justify-content:center">Enviar</button>
  `;

  card.querySelectorAll('.encuesta-rating .pref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pregunta = btn.dataset.pregunta;
      respuestas[pregunta] = Number(btn.dataset.valor);
      card.querySelectorAll(`.pref-btn[data-pregunta="${pregunta}"]`).forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('encuesta-enviar').addEventListener('click', async () => {
    card.querySelectorAll('textarea[data-pregunta]').forEach(t => {
      if (t.value.trim()) respuestas[t.dataset.pregunta] = t.value.trim();
    });
    try {
      const res = await fetch(`${API}/encuesta/${getToken()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al enviar');
      renderThanks();
    } catch (err) {
      showError(err.message);
    }
  });
}

function showError(msg) {
  const note = document.createElement('p');
  note.className = 'encuesta-sub';
  note.style.color = '#c0392b';
  note.textContent = msg;
  card.appendChild(note);
}

(async function init() {
  const token = getToken();
  if (!token) { renderError('Falta el código de la encuesta.'); return; }
  try {
    const res = await fetch(`${API}/encuesta/${token}`);
    if (res.status === 410) { renderThanks(); return; }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Encuesta no encontrada');
    const data = await res.json();
    renderForm(data);
  } catch (err) {
    renderError(err.message);
  }
})();
