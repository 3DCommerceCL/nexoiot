'use strict';
// backend/pagos.js — Integración con Transbank Webpay Plus y Mercado Pago
//
// Webpay funciona en sandbox sin credenciales reales (Environment.Integration usa
// códigos públicos de prueba de Transbank). Mercado Pago SÍ requiere
// MERCADO_PAGO_ACCESS_TOKEN — sin él, crearLinkMP lanza error claro.

const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = require('transbank-sdk');
const crypto = require('crypto');

// ── TRANSBANK ─────────────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production' && process.env.TRANSBANK_COMMERCE_CODE;

const txOptions = isProduction
  ? new Options(process.env.TRANSBANK_COMMERCE_CODE, process.env.TRANSBANK_API_KEY, Environment.Production)
  : new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration);

const tx = new WebpayPlus.Transaction(txOptions);

// ── MERCADO PAGO (carga perezosa — solo si hay access token configurado) ─────
let mpClient = null;
function getMpClient() {
  if (mpClient) return mpClient;
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN no configurada. Obtener en mercadopago.cl/developers');
  }
  const { MercadoPagoConfig } = require('mercadopago');
  mpClient = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
  return mpClient;
}

// Genera una buy_order única para Transbank (máx 26 caracteres alfanuméricos)
function genBuyOrder() {
  return 'NX' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ── INICIAR PAGO WEBPAY ───────────────────────────────────────────────────────
async function iniciarWebpay(montoCLP, returnUrl) {
  const buyOrder  = genBuyOrder();
  const sessionId = crypto.randomBytes(8).toString('hex');
  const response  = await tx.create(buyOrder, sessionId, montoCLP, returnUrl);
  return { token: response.token, url: response.url, buyOrder, sessionId };
}

// ── CONFIRMAR PAGO WEBPAY (llamado desde el return_url) ──────────────────────
async function confirmarWebpay(tokenWs) {
  return tx.commit(tokenWs); // response.response_code === 0 → aprobado
}

// ── CREAR LINK DE PAGO MERCADO PAGO ──────────────────────────────────────────
async function crearLinkMP(montoCLP, descripcion, guestEmail, externalRef) {
  const client = getMpClient();
  const { Preference } = require('mercadopago');
  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: [{ title: descripcion, unit_price: montoCLP, quantity: 1, currency_id: 'CLP' }],
      payer: { email: guestEmail || undefined },
      back_urls: {
        success: `${process.env.HOTEL_URL}/api/pagos/mp-callback?status=success&reserva=${externalRef}`,
        failure: `${process.env.HOTEL_URL}/api/pagos/mp-callback?status=failure&reserva=${externalRef}`,
      },
      auto_return: 'approved',
      external_reference: externalRef,
    },
  });
  return { preferenceId: result.id, linkPago: result.init_point };
}

// ── CONSULTAR PAGO MERCADO PAGO (desde el webhook) ────────────────────────────
async function consultarPagoMP(paymentId) {
  const client = getMpClient();
  const { Payment } = require('mercadopago');
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

module.exports = { iniciarWebpay, confirmarWebpay, crearLinkMP, consultarPagoMP, genBuyOrder };
