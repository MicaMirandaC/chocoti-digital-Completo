// backend/src/adapters/paypalAdapter.js
/**
 * @file PayPal Adapter
 * @description Adaptador para la API PayPal Orders v2 (Sandbox/Live).
 * Implementa createOrder, captureOrder y getOrderStatus.
 * Las credenciales se leen dinámicamente de process.env en cada llamada
 * para garantizar que se toman del .env cargado por app.js.
 * Fase 5B — ChocoTi-Digital | Capa de Adaptadores
 */
'use strict';

const { URLSearchParams } = require('url');

const fetchFn = typeof globalThis.fetch === 'function'
  ? globalThis.fetch
  : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/** Lee configuración PayPal en tiempo de ejecución (no en módulo load) */
function getPayPalConfig() {
  const env    = (process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  const id     = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET;
  const base   = (env === 'live' || env === 'production')
    ? 'https://api-m.paypal.com'
    : (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com');

  if (!id || !secret) {
    throw new Error(
      'Credenciales PayPal no configuradas. ' +
      'Define PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en el archivo .env.'
    );
  }
  return { id, secret, base };
}

class PayPalAdapter {
  /** Obtiene un token OAuth2 de PayPal */
  static async _getAccessToken() {
    const { id, secret, base } = getPayPalConfig();
    const auth = Buffer.from(`${id}:${secret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    const response = await fetchFn(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`PayPal token request failed: ${response.status} ${txt}`);
    }
    const data = await response.json();
    return { token: data.access_token, base };
  }

  /** Crea una orden PayPal con intent CAPTURE */
  static async createOrder({ amountUSD, returnUrl, cancelUrl }) {
    const { token, base } = await this._getAccessToken();
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: Number(amountUSD).toFixed(2),
          },
          description: 'Chocolates Para Ti — ChocoTi Digital',
        },
      ],
      application_context: {
        brand_name: 'Chocolates Para Ti',
        landing_page: 'LOGIN',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };
    const res = await fetchFn(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`PayPal create order failed: ${res.status} ${txt}`);
    }
    const data = await res.json();
    const approvalLink = (data.links || []).find(l => l.rel === 'approve');
    return {
      orderId: data.id,
      approvalUrl: approvalLink ? approvalLink.href : null,
    };
  }

  /** Captura una orden previamente aprobada por el comprador */
  static async captureOrder(orderId) {
    const { token, base } = await this._getAccessToken();
    const res = await fetchFn(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`PayPal capture failed: ${res.status} ${txt}`);
    }
    return await res.json();
  }

  /** Consulta el estado actual de una orden en PayPal */
  static async getOrderStatus(orderId) {
    const { token, base } = await this._getAccessToken();
    const res = await fetchFn(`${base}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`PayPal get status failed: ${res.status} ${txt}`);
    }
    return await res.json();
  }
}

module.exports = PayPalAdapter;

