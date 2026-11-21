/**
 * @file routes/puntosVentaRoutes.js
 * @description Rutas REST para consulta de puntos de venta y agencias de recojo.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento
 */

'use strict';

const express = require('express');
const router = express.Router();
const PuntosVentaController = require('../controllers/puntosVentaController');

// Agencias Propias (Tipo P) autorizadas para recojo de pedidos
router.get('/agencias-propias', PuntosVentaController.obtenerAgenciasPropias);

// Lista general de puntos de venta con filtros
router.get('/', PuntosVentaController.listar);

module.exports = router;
