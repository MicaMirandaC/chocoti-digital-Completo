/**
 * @file controllers/deseosController.js
 * @description Controlador HTTP para gestión de lista de deseos (favoritos).
 * ChocoTi-Digital | Capa 1: Presentación / API REST
 */

'use strict';

const ListaDeseos = require('../models/ListaDeseos');

class DeseosController {
  /**
   * GET /api/deseos
   * Obtiene la lista de favoritos del usuario autenticado.
   */
  static async listar(req, res) {
    try {
      const items = ListaDeseos.obtenerPorUsuario(req.usuario.id);
      return res.status(200).json({
        total: items.length,
        data: items
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Error al obtener la lista de deseos.'
      });
    }
  }

  /**
   * POST /api/deseos
   * Agrega un producto a la lista de deseos.
   */
  static async agregar(req, res) {
    try {
      const { producto_id } = req.body;
      if (!producto_id) {
        return res.status(400).json({ error: 'producto_id es obligatorio.' });
      }

      ListaDeseos.agregar(req.usuario.id, Number(producto_id));
      return res.status(201).json({
        mensaje: 'Producto agregado a la lista de deseos.',
        producto_id: Number(producto_id)
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Error al agregar producto a deseos.'
      });
    }
  }

  /**
   * DELETE /api/deseos/:producto_id
   * Elimina un producto de la lista de deseos.
   */
  static async eliminar(req, res) {
    try {
      const { producto_id } = req.params;
      ListaDeseos.eliminar(req.usuario.id, Number(producto_id));
      return res.status(200).json({
        mensaje: 'Producto removido de la lista de deseos.',
        producto_id: Number(producto_id)
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Error al eliminar producto de deseos.'
      });
    }
  }

  /**
   * POST /api/deseos/sincronizar
   * Sincroniza y fusiona la lista de deseos guardada localmente por el visitante.
   */
  static async sincronizar(req, res) {
    try {
      const { productos } = req.body;
      const ids = Array.isArray(productos) ? productos : [];
      const insertados = ListaDeseos.sincronizar(req.usuario.id, ids);

      const listaActualizada = ListaDeseos.obtenerPorUsuario(req.usuario.id);
      return res.status(200).json({
        mensaje: `Se sincronizaron ${insertados} productos nuevos a su lista de deseos.`,
        total: listaActualizada.length,
        data: listaActualizada
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Error al sincronizar la lista de deseos.'
      });
    }
  }
}

module.exports = DeseosController;
