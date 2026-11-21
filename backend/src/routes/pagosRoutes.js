/**
 * @file routes/pagosRoutes.js
 * @description Rutas REST para pasarelas de pago, verificación y webhook demo.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento
 */

'use strict';

const express = require('express');
const router = express.Router();
const PagosController = require('../controllers/pagosController');
const { verificarToken, rolAutorizado } = require('../middleware/authMiddleware');

// Consulta de estado en tiempo real (Polling QR y Transferencias)
router.get('/estado/:referencia', PagosController.consultarEstado);
// ── Fase 5B: Rutas PayPal ────────────────────────────────────────────────────
// POST /create: cualquier usuario (autenticado o invitado con pedido) puede iniciar el pago.
// El controlador valida que el pedido exista y no esté expirado.
// Se acepta token opcional (intentOptionalAuth) para enriquecer logs, pero NO es obligatorio.
router.post('/paypal/create', require('../controllers/paypalController').crearOrden);

// GET /capture: PayPal redirige a esta URL tras la aprobación; NO lleva JWT.
// La seguridad se garantiza verificando el orderId real contra PayPal en el servidor.
router.get('/paypal/capture', require('../controllers/paypalController').capturarOrden);

// GET /status/:orderId: consulta de estado (sin auth requerida, solo lectura)
router.get('/paypal/status/:orderId', require('../controllers/paypalController').obtenerEstado);

// Carga de comprobante de depósito bancario (público / cliente)
router.post('/subir-comprobante', PagosController.subirComprobante);

// Verificación y aprobación/rechazo de comprobante bancario (Admin u Operador de Almacén)
router.post(
  '/verificar-deposito',
  verificarToken,
  rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN']),
  PagosController.verificarDeposito
);

// Cobro en efectivo en mostrador de agencia propia (Admin u Operador de Almacén)
router.post(
  '/cobro-efectivo-tienda',
  verificarToken,
  rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN']),
  PagosController.cobroEfectivoTienda
);

// Webhook simulador bancario para QR Simple (Entorno académico / demo)
router.post('/demo-banco-notificar', PagosController.notificarBancoDemo);

module.exports = router;
