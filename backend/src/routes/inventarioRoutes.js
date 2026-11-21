/**
 * @file routes/inventarioRoutes.js
 * @description Rutas protegidas para gestión operativa de inventario, kardex y lotes.
 * ChocoTi-Digital | Capa 1: Enrutamiento REST
 */

'use strict';

const express = require('express');
const router = express.Router();
const InventarioController = require('../controllers/inventarioController');
const { verificarToken, rolAutorizado } = require('../middleware/authMiddleware');

// Consultas de inventario y lotes FEFO permitidas para Admin, Operador y Preparador
router.get('/', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS']), InventarioController.consultarStock);
router.get('/alertas', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS']), InventarioController.consultarAlertas);
router.get('/kardex', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN']), InventarioController.consultarKardex);
router.get('/lotes', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS']), InventarioController.consultarLotes);

// Operaciones de mutación de stock restringidas a Admin y Operador
router.post('/entradas', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN']), InventarioController.registrarEntrada);
router.post('/ajustes', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN']), InventarioController.registrarAjuste);
router.post('/traspasos', verificarToken, rolAutorizado(['ADMINISTRADOR', 'OPERADOR_ALMACEN']), InventarioController.registrarTraspaso);

module.exports = router;
