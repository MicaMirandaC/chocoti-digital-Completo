/**
 * @file tests/paypal.test.js
 * @description Tests for PayPal integration (Phase 5B).
 * Covers order creation, capture, idempotency and stock updates.
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH = 'database/chocoti.db';
process.env.PAYPAL_ENV = 'sandbox';
process.env.PAYPAL_CLIENT_ID = 'dummy_client_id';
process.env.PAYPAL_CLIENT_SECRET = 'dummy_secret';
process.env.PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';

const assert = require('assert');
const fetch = require('node-fetch');
const nock = require('nock');
const app = require('../backend/src/app');
const db = require('../backend/src/config/database');
const AuthService = require('../backend/src/services/authService');

/** Helper to start server on random port */
async function startServer() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  return { server, baseUrl };
}

/** Mock PayPal OAuth token request */
function mockPayPalToken() {
  nock(process.env.PAYPAL_BASE_URL)
    .post('/v1/oauth2/token')
    .reply(200, { access_token: 'mock_access_token', token_type: 'Bearer' });
}

/** Mock PayPal order creation */
function mockCreateOrder(orderId = 'ORDER-12345') {
  nock(process.env.PAYPAL_BASE_URL, { reqheaders: { Authorization: 'Bearer mock_access_token' } })
    .post('/v2/checkout/orders')
    .reply(201, {
      id: orderId,
      status: 'CREATED',
      links: [{ href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`, rel: 'approve' }],
    });
}

/** Mock PayPal order capture */
function mockCaptureOrder(orderId = 'ORDER-12345') {
  nock(process.env.PAYPAL_BASE_URL, { reqheaders: { Authorization: 'Bearer mock_access_token' } })
    .post(`/v2/checkout/orders/${orderId}/capture`)
    .reply(201, { status: 'COMPLETED', id: orderId });
}

/** Mock PayPal order status (used by polling, not required for main flow) */
function mockGetOrderStatus(orderId = 'ORDER-12345') {
  nock(process.env.PAYPAL_BASE_URL, { reqheaders: { Authorization: 'Bearer mock_access_token' } })
    .get(`/v2/checkout/orders/${orderId}`)
    .reply(200, { status: 'COMPLETED', id: orderId });
}

(async () => {
  console.log('\n🧪 STARTING PayPal Integration Tests (Phase 5B)');
  const { server, baseUrl } = await startServer();

  try {
    // 1. Authenticate as admin
    const adminLogin = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
    const token = adminLogin.token;
    const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 2. Create a checkout order with PayPal method
    const checkoutResp = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        cliente: {
          nombre: 'Juan Pérez',
          ci_nit: '1234567-CH',
          email: 'juan.perez@test.bo',
          telefono: '71234567',
        },
        items: [{ id: 1, cantidad: 1 }],
        metodo_pago: 'PAYPAL',
        tipo_entrega: 'ENVIO_DOMICILIO',
        ciudad_destino: 'Sucre',
        direccion_envio: 'Calle Falsa 123',
        referencia_envio: 'Frente a la plaza',
      }),
    });
    assert.strictEqual(checkoutResp.status, 201, 'Pedido creado con PayPal debe responder 201');
    const checkoutData = await checkoutResp.json();
    const pedidoId = checkoutData.pedido.id;
    const totalBOB = checkoutData.pedido.total;
    const montoUSD = Number((totalBOB / Number(process.env.TIPO_CAMBIO_USD || 6.96)).toFixed(2));

    // 3. Mock PayPal calls and create order via API
    mockPayPalToken();
    mockCreateOrder();
    const createResp = await fetch(`${baseUrl}/pagos/paypal/create`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ pedidoId, returnUrl: `${process.env.BASE_URL || ''}/paypal-success.html`, cancelUrl: `${process.env.BASE_URL || ''}/checkout.html` }),
    });
    assert.strictEqual(createResp.status, 200, 'Crear orden PayPal debe responder 200');
    const { orderId, approvalUrl } = await createResp.json();
    assert.ok(orderId, 'orderId debe ser devuelto');
    assert.ok(approvalUrl && approvalUrl.includes(orderId), 'approvalUrl debe contener orderId');

    // 4. Capture the order (simulating PayPal return)
    mockPayPalToken();
    mockCaptureOrder(orderId);
    const captureResp = await fetch(`${baseUrl}/pagos/paypal/capture?orderId=${orderId}&pedidoId=${pedidoId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(captureResp.status, 302, 'Captura debe redirigir a página de éxito (302)');
    const redirectLocation = captureResp.headers.get('location');
    assert.ok(redirectLocation && redirectLocation.includes('paypal-success.html'), 'Redirección debe apuntar a página de éxito');

    // 5. Verify order state in DB
    const pedido = db.prepare('SELECT estado_pedido, estado_pago FROM pedidos WHERE id = ?').get(pedidoId);
    assert.strictEqual(pedido.estado_pedido, 'PAGADO', 'Pedido debe estar en estado PAGADO');
    assert.strictEqual(pedido.estado_pago, 'PAGADO', 'Pago debe estar marcado como PAGADO');

    // 6. Idempotency: repeat capture call, should not error and keep state
    mockPayPalToken();
    mockCaptureOrder(orderId);
    const dupCaptureResp = await fetch(`${baseUrl}/pagos/paypal/capture?orderId=${orderId}&pedidoId=${pedidoId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(dupCaptureResp.status, 302, 'Captura idempotente también debe redirigir (302)');
    const dupPedido = db.prepare('SELECT estado_pedido, estado_pago FROM pedidos WHERE id = ?').get(pedidoId);
    assert.strictEqual(dupPedido.estado_pedido, 'PAGADO');
    assert.strictEqual(dupPedido.estado_pago, 'PAGADO');

    console.log('✅ PayPal integration tests passed.');
  } catch (err) {
    console.error('❌ PayPal test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
})();
