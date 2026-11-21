/**
 * @file routes/pedidosRoutes.js
 * @description Rutas REST para creación de pedidos en checkout y consultas.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento
 */

'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PedidosController = require('../controllers/pedidosController');
const { verificarToken, validarTransicionEstado } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'chocoti_secret_sucre_bolivia_2026';

/** Middleware que extrae usuario si hay token, pero no bloquea si es invitado */
function authOpcional(req, _res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const partes = authHeader.trim().split(' ');
    if (partes.length === 2 && partes[0].toLowerCase() === 'bearer') {
      try {
        const payload = jwt.verify(partes[1], JWT_SECRET);
        req.usuario = payload;
      } catch (_e) {
        // Token inválido, continuar como invitado
      }
    }
  }
  next();
}

// Crear nuevo pedido (Checkout)
router.post('/', authOpcional, PedidosController.crear);

// Consulta pública por código de pedido (ej. para notas de venta o seguimiento)
router.get('/codigo/:codigo', PedidosController.obtenerPorCodigo);

// Listar pedidos protegidos por RBAC (Admin, Operador, Cliente)
router.get('/', verificarToken, PedidosController.listar);

// Detalle de pedido protegido por ID
router.get('/:id', verificarToken, PedidosController.obtenerPorId);

// Transición de estado de pedido protegida por RBAC y matriz de transiciones
router.patch('/:id/estado', verificarToken, validarTransicionEstado, PedidosController.cambiarEstado);
router.put('/:id/estado', verificarToken, validarTransicionEstado, PedidosController.cambiarEstado);
router.patch('/:id/transicion', verificarToken, validarTransicionEstado, PedidosController.cambiarEstado);
router.put('/:id/transicion', verificarToken, validarTransicionEstado, PedidosController.cambiarEstado);

// Fase 7A: Preparación y Checklist FEFO (Rol PREPARADOR_PEDIDOS y ADMINISTRADOR)
router.get('/:id/preparacion', verificarToken, PedidosController.obtenerPreparacion);
router.post('/:id/preparacion', verificarToken, PedidosController.guardarPreparacion);
router.put('/:id/preparacion', verificarToken, PedidosController.guardarPreparacion);
router.get('/:id/checklist', verificarToken, PedidosController.obtenerPreparacion);
router.post('/:id/checklist', verificarToken, PedidosController.guardarPreparacion);

// Fase 7B / Empaque y Checklist Térmico (Rol EMPACADOR y ADMINISTRADOR)
router.get('/:id/empaque', verificarToken, PedidosController.obtenerEmpaque);
router.post('/:id/empaque', verificarToken, PedidosController.guardarEmpaque);
router.put('/:id/empaque', verificarToken, PedidosController.guardarEmpaque);

module.exports = router;
