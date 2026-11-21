/**
 * @file routes/deseosRoutes.js
 * @description Rutas para la gestión de lista de deseos de usuarios autenticados.
 * ChocoTi-Digital | Capa 1: Enrutamiento REST
 */

'use strict';

const express = require('express');
const router = express.Router();
const DeseosController = require('../controllers/deseosController');
const { verificarToken } = require('../middleware/authMiddleware');

router.use(verificarToken);

router.get('/', DeseosController.listar);
router.post('/', DeseosController.agregar);
router.delete('/:producto_id', DeseosController.eliminar);
router.post('/sincronizar', DeseosController.sincronizar);

module.exports = router;
