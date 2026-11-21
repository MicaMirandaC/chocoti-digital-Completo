/**
 * @file routes/productosRoutes.js
 * @description Rutas para catálogo, sugerencias y administración de productos.
 * ChocoTi-Digital | Capa 1: Enrutamiento REST
 */

'use strict';

const express = require('express');
const router = express.Router();
const ProductosController = require('../controllers/productosController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// Rutas públicas
router.get('/', ProductosController.listar);
router.get('/sugerencias', ProductosController.sugerencias);
router.get('/:id', ProductosController.obtenerPorId);

// Rutas protegidas (Solo Administrador)
router.post('/', verificarToken, soloAdmin, ProductosController.crear);
router.put('/:id', verificarToken, soloAdmin, ProductosController.actualizar);
router.delete('/:id', verificarToken, soloAdmin, ProductosController.eliminar);

module.exports = router;
