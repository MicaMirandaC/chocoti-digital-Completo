/**
 * @file controllers/inventarioController.js
 * @description Controlador HTTP para gestión de existencias, kardex, lotes FEFO y alertas.
 * ChocoTi-Digital | Capa 1: Presentación / API REST
 */

'use strict';

const InventarioService = require('../services/inventarioService');

class InventarioController {
  /**
   * GET /api/inventario
   * Consulta existencias por almacén o consolidado.
   */
  static async consultarStock(req, res) {
    try {
      const stock = await InventarioService.consultarStock({
        almacen_id: req.query.almacen_id,
        usuario: req.usuario
      });
      return res.status(200).json(stock);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al consultar inventario.'
      });
    }
  }

  /**
   * GET /api/inventario/alertas
   * Alertas de stock crítico y vencimiento de lotes.
   */
  static async consultarAlertas(req, res) {
    try {
      const alertas = await InventarioService.consultarAlertas({
        almacen_id: req.query.almacen_id,
        usuario: req.usuario
      });
      return res.status(200).json(alertas);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al obtener alertas de inventario.'
      });
    }
  }

  /**
   * POST /api/inventario/entradas
   * Entrada de mercadería / registro de nuevo lote.
   */
  static async registrarEntrada(req, res) {
    try {
      // Si es operador, forzar su almacén
      const almacen_id = req.usuario.rol_id === 2 ? req.usuario.almacen_id : req.body.almacen_id;

      const resultado = await InventarioService.registrarEntrada({
        ...req.body,
        almacen_id,
        usuario_id: req.usuario.id
      });
      return res.status(201).json(resultado);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al registrar entrada de inventario.'
      });
    }
  }

  /**
   * POST /api/inventario/ajustes
   * Ajuste de existencias (merma, corrección).
   */
  static async registrarAjuste(req, res) {
    try {
      const almacen_id = req.usuario.rol_id === 2 ? req.usuario.almacen_id : req.body.almacen_id;

      const resultado = await InventarioService.registrarAjuste({
        ...req.body,
        almacen_id,
        usuario_id: req.usuario.id
      });
      return res.status(200).json(resultado);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al registrar ajuste de inventario.'
      });
    }
  }

  /**
   * POST /api/inventario/traspasos
   * Traspaso de existencias entre dos almacenes.
   */
  static async registrarTraspaso(req, res) {
    try {
      const almacen_origen_id = req.usuario.rol_id === 2 ? req.usuario.almacen_id : req.body.almacen_origen_id;

      const resultado = await InventarioService.registrarTraspaso({
        ...req.body,
        almacen_origen_id,
        usuario_id: req.usuario.id
      });
      return res.status(200).json(resultado);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al registrar traspaso.'
      });
    }
  }

  /**
   * GET /api/inventario/kardex
   * Auditoría de movimientos históricos.
   */
  static async consultarKardex(req, res) {
    try {
      const movimientos = await InventarioService.consultarKardex({
        producto_id: req.query.producto_id,
        almacen_id: req.query.almacen_id,
        tipo_movimiento: req.query.tipo_movimiento,
        limite: req.query.limite,
        offset: req.query.offset,
        usuario: req.usuario
      });
      return res.status(200).json({
        total: movimientos.length,
        data: movimientos
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al consultar kardex.'
      });
    }
  }

  /**
   * GET /api/inventario/lotes
   * Consulta de lotes vigentes o por almacén.
   */
  static async consultarLotes(req, res) {
    try {
      const lotes = await InventarioService.consultarLotes({
        producto_id: req.query.producto_id,
        almacen_id: req.query.almacen_id,
        estado: req.query.estado,
        usuario: req.usuario
      });
      return res.status(200).json({
        total: lotes.length,
        data: lotes
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al consultar lotes.'
      });
    }
  }
}

module.exports = InventarioController;
