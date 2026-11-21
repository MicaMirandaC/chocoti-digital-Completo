/**
 * @file routes/preparacionRoutes.js
 * @description Rutas REST para el módulo de preparación (picking) y checklist FEFO por almacén.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento (Fase 7A)
 */

'use strict';

const express = require('express');
const router = express.Router();
const PedidosController = require('../controllers/pedidosController');
const { verificarToken, rolAutorizado, soloAlmacenAsignado } = require('../middleware/authMiddleware');

// Solo Administrador y Preparador de Pedidos pueden gestionar preparación de pedidos
router.use(verificarToken, rolAutorizado(['ADMINISTRADOR', 'PREPARADOR_PEDIDOS']), soloAlmacenAsignado);

// Consulta de orden de preparación con sugerencias FEFO
router.get('/:pedido_id', PedidosController.obtenerPreparacion);

// Registro de checklist de preparación e incidencias de stock
router.post('/:pedido_id', PedidosController.guardarPreparacion);
router.put('/:pedido_id', PedidosController.guardarPreparacion);

module.exports = router;
