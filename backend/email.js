'use strict';
// backend/email.js — Envío de correos transaccionales vía Resend (API REST, sin SDK)
//
// Sin RESEND_API_KEY el módulo funciona en modo simulación: registra en consola
// el correo que habría enviado, pero no llama a la API real. Al configurar la
// API key, el envío empieza a funcionar sin cambios de código.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.RESEND_FROM_EMAIL || 'NexoSuite <reservas@nexosuite.cl>';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[email] SIMULADO → to=${to} subject="${subject}" (configura RESEND_API_KEY para enviar de verdad)`);
    return { simulado: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Resend respondió ${res.status}: ${detalle}`);
  }
  return res.json();
}

function plantillaConfirmacionReserva(hotelNombre, reserva) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#009D71">${hotelNombre}</h2>
      <p>Hola ${reserva.guest_name},</p>
      <p>Tu reserva fue confirmada:</p>
      <ul>
        <li><strong>Check-in:</strong> ${reserva.checkin}</li>
        <li><strong>Check-out:</strong> ${reserva.checkout}</li>
        <li><strong>Código de reserva:</strong> ${reserva.id}</li>
      </ul>
      <p>Te esperamos.</p>
    </div>
  `;
}

async function enviarConfirmacionReserva(hotelNombre, reserva) {
  if (!reserva.guest_email) return { omitido: 'sin email del huésped' };
  return sendEmail({
    to: reserva.guest_email,
    subject: `Confirmación de reserva — ${hotelNombre}`,
    html: plantillaConfirmacionReserva(hotelNombre, reserva),
  });
}

module.exports = { sendEmail, enviarConfirmacionReserva };
