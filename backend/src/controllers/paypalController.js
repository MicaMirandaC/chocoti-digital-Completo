/**
 * @file controllers/paypalController.js
 * @description Controlador para el flujo de pago con PayPal (Orders API v2 Sandbox).
 * Fase 5B — ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 *
 * Flujo:
 *   1. POST /api/pagos/paypal/create   → crea la orden en PayPal y registra el intento
 *   2. GET  /api/pagos/paypal/capture  → captura la orden tras la aprobación del comprador
 *   3. GET  /api/pagos/paypal/status/:orderId → consulta el estado actual en PayPal
 */
'use strict';

const PayPalAdapter  = require('../adapters/paypalAdapter');
const PedidosService = require('../services/pedidosService');
const PagosService   = require('../services/pagosService');

module.exports = {
  /**
   * POST /api/pagos/paypal/create
   * Body: { pedidoId }
   * Protegido con JWT (verificarToken aplicado en la ruta).
   * Calcula el monto en USD en el servidor; nunca confía en el monto enviado por el cliente.
   */
  crearOrden: async (req, res) => {
    try {
      const { pedidoId } = req.body;

      if (!pedidoId) {
        return res.status(400).json({ ok: false, mensaje: 'Se requiere pedidoId.' });
      }

      // 1. Obtener el pedido desde la base de datos (monto autorizado por el servidor)
      const pedido = PedidosService.obtenerPedidoPorId(pedidoId);
      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado.' });
      }

      if (pedido.estado_pedido === 'PAGADO' || pedido.estado_pedido === 'FINALIZADO') {
        return res.status(409).json({ ok: false, mensaje: 'Este pedido ya ha sido pagado.' });
      }

      if (pedido.estado_pedido === 'EXPIRADO' || pedido.estado_pedido === 'CANCELADO') {
        return res.status(400).json({
          ok: false,
          mensaje: 'El plazo de reserva para este pedido ha expirado. Realice un nuevo pedido.',
        });
      }

      // 2. Calcular monto en USD en el servidor (nunca desde el frontend)
      const tipoCambio = Number(process.env.TIPO_CAMBIO_USD || 6.96);
      const montoUSD   = Number((pedido.total / tipoCambio).toFixed(2));

      // 3. Construir URLs de retorno desde variables de entorno (nunca desde el cliente)
      const baseUrl   = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      const returnUrl = `${baseUrl}/api/pagos/paypal/capture?pedidoId=${pedidoId}`;
      const cancelUrl = `${baseUrl}/paypal-cancelado.html?pedidoId=${pedidoId}`;

      // 4. Crear la orden en PayPal
      const { orderId, approvalUrl } = await PayPalAdapter.createOrder({
        amountUSD: montoUSD,
        returnUrl,
        cancelUrl,
      });

      // 5. Registrar el intento de pago en la BD (idempotente)
      PagosService.registrarIntentoPago({
        pedido_id:          Number(pedidoId),
        referencia_externa: orderId,
        monto_usd:          montoUSD,
        monto_bob:          pedido.total,
        datos_proveedor_json: JSON.stringify({ approvalUrl, tipoCambio }),
      });

      return res.status(201).json({
        ok: true,
        orderId,
        approvalUrl,
        montoUSD,
        monto_bob: pedido.total,
        tipo_cambio: tipoCambio,
      });
    } catch (err) {
      console.error('[PayPal] Error al crear orden:', err.message);
      return res.status(500).json({ ok: false, mensaje: err.message });
    }
  },

  /**
   * GET /api/pagos/paypal/capture?orderId=xxx&pedidoId=yyy
   * PayPal redirige a esta URL tras la aprobación del comprador.
   * Captura la orden, confirma el pago en BD y redirige al frontend.
   */
  capturarOrden: async (req, res) => {
    try {
      const { orderId, token, pedidoId } = req.query;
      // PayPal puede enviar el orderId como "token" o como "orderId"
      const paypalOrderId = orderId || token;

      if (!paypalOrderId || !pedidoId) {
        return res.status(400).send('Parámetros insuficientes: se requiere orderId/token y pedidoId.');
      }

      // 1. Capturar la orden en PayPal (verificación real en servidor)
      const captureData = await PayPalAdapter.captureOrder(paypalOrderId);

      if (captureData.status !== 'COMPLETED') {
        const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
        return res.redirect(`${baseUrl}/paypal-cancelado.html?pedidoId=${pedidoId}&status=${captureData.status}`);
      }

      // 2. Confirmar el pago en el sistema con validación de monto
      PagosService.confirmarPagoPayPal({
        pedidoId: Number(pedidoId),
        orderId:  paypalOrderId,
        captureData,
      });

      // 3. Redirigir al frontend de éxito
      const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      return res.redirect(`${baseUrl}/paypal-exitoso.html?pedidoId=${pedidoId}&orderId=${paypalOrderId}`);
    } catch (err) {
      console.error('[PayPal] Error al capturar orden:', err.message);
      const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      const pedidoId = req.query.pedidoId || '';
      return res.redirect(
        `${baseUrl}/paypal-cancelado.html?pedidoId=${pedidoId}&error=${encodeURIComponent(err.message)}`
      );
    }
  },

  /**
   * GET /api/pagos/paypal/status/:orderId
   * Consulta el estado actual de una orden en PayPal (para polling si fuera necesario).
   */
  obtenerEstado: async (req, res) => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ ok: false, mensaje: 'Se requiere orderId.' });
      }
      const data = await PayPalAdapter.getOrderStatus(orderId);
      return res.status(200).json({ ok: true, data });
    } catch (err) {
      console.error('[PayPal] Error al consultar estado:', err.message);
      return res.status(500).json({ ok: false, mensaje: err.message });
    }
  },
};

