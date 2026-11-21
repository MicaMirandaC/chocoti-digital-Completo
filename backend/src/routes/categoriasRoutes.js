/**
 * @file routes/categoriasRoutes.js
 * @description Rutas públicas para consulta de categorías.
 * ChocoTi-Digital | Capa 1: Enrutamiento REST
 */

'use strict';

const express = require('express');
const router = express.Router();
const ProductosController = require('../controllers/productosController');

router.get('/', ProductosController.listarCategorias);

module.exports = router;
