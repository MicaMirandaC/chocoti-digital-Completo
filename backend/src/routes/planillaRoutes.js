/**
 * @file routes/planillaRoutes.js
 * @description Módulo 7 — Rutas REST para Planillas de Venta y Comprobantes.
 * Protegidas por JWT; visibilidad filtrada por RBAC en el controlador.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento
 */

'use strict';

const express = require('express');
const router  = express.Router();
const PlanillaController = require('../controllers/planillaController');
const { verificarToken } = require('../middleware/authMiddleware');

// GET /api/planilla          → Listado (JSON) con filtros y paginación
// GET /api/planilla?formato=csv → Exportar CSV
router.get('/', verificarToken, PlanillaController.listar);

// GET /api/planilla/:id/comprobante → Nota de venta imprimible de un pedido
router.get('/:id/comprobante', verificarToken, PlanillaController.comprobante);

module.exports = router;
