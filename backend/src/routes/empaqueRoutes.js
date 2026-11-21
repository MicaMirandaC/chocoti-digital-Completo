/**
 * @file routes/empaqueRoutes.js
 * @description Rutas REST para el módulo de empaque, rotulado y empaque térmico.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento (Fases 7A y 7B)
 */

'use strict';

const express = require('express');
const router = express.Router();
const PedidosController = require('../controllers/pedidosController');
const { verificarToken, rolAutorizado, soloAlmacenAsignado } = require('../middleware/authMiddleware');

// Solo Administrador y Empacador pueden acceder a empaque
router.use(verificarToken, rolAutorizado(['ADMINISTRADOR', 'EMPACADOR']), soloAlmacenAsignado);

// Consulta de orden de empaque
router.get('/:pedido_id', PedidosController.obtenerEmpaque);

// Registro de checklist de empaque y embalaje térmico
router.post('/:pedido_id', PedidosController.guardarEmpaque);
router.put('/:pedido_id', PedidosController.guardarEmpaque);

module.exports = router;
