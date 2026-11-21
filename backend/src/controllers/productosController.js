/**
 * @file controllers/productosController.js
 * @description Controlador HTTP para catálogo de productos, sugerencias y CRUD de SKUs.
 * ChocoTi-Digital | Capa 1: Presentación / API REST
 */

'use strict';

const ProductosService = require('../services/productosService');

class ProductosController {
  // Existing methods...

  /**
   * POST /api/carrito
   * Agrega producto al carrito reservando stock de forma atómica.
   */
  static async agregarAlCarrito(req, res) {
    try {
      const { producto_id, cantidad, almacen_id } = req.body;
      if (!producto_id || !cantidad || !almacen_id) {
        return res.status(400).json({ error: 'producto_id, cantidad y almacen_id son requeridos.' });
      }
      const Inventario = require('../models/Inventario');
      const stockInfo = Inventario.obtenerStockPorAlmacen(Number(almacen_id)).find(s => s.producto_id === Number(producto_id));
      if (!stockInfo) {
        return res.status(404).json({ error: 'Producto no encontrado en el almacén.' });
      }
      if (stockInfo.stock_disponible < Number(cantidad)) {
        return res.status(400).json({ error: 'Cantidad excede stock disponible.' });
      }
      // Reserva atomícamente
      const db = require('../config/database');
      const reservar = db.transaction(() => {
        // Incrementar reserva en inventario
        Inventario.reservar(producto_id, almacen_id, Number(cantidad));
        // Insertar registro de reserva (pedido_id provisional 0, expira en 15 min)
        const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        db.prepare(`INSERT INTO reservas_stock (pedido_id, producto_id, almacen_id, cantidad, expira_en, estado)
          VALUES (0, ?, ?, ?, ?, 'ACTIVA')`).run(producto_id, almacen_id, Number(cantidad), expira);
      });
      reservar();
      return res.status(200).json({ mensaje: 'Producto reservado en carrito.', stock_disponible: stockInfo.stock_disponible - Number(cantidad) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || 'Error al agregar al carrito.' });
    }
  }

  /**
   * GET /api/productos
   * Búsqueda y listado público de productos con disponibilidad.
   */
  static async listar(req, res) {
    try {
      const { q, busqueda, categoria_id, almacen_id, solo_activos } = req.query;
      const productos = await ProductosService.listarProductos({
        busqueda: q || busqueda,
        categoria_id,
        almacen_id,
        solo_activos: solo_activos === 'false' ? false : true
      });

      return res.status(200).json({
        total: productos.length,
        data: productos
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al listar productos.'
      });
    }
  }

  /**
   * GET /api/productos/sugerencias
   * Sugerencias de autocompletado en vivo.
   */
  static async sugerencias(req, res) {
    try {
      const { q } = req.query;
      const sugerencias = await ProductosService.obtenerSugerencias(q);
      return res.status(200).json(sugerencias);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al obtener sugerencias.'
      });
    }
  }

  /**
   * GET /api/productos/:id
   * Detalle individual de un producto.
   */
  static async obtenerPorId(req, res) {
    try {
      const { id } = req.params;
      const { almacen_id } = req.query;
      const producto = await ProductosService.obtenerPorId(id, almacen_id);
      return res.status(200).json(producto);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al obtener producto.'
      });
    }
  }

  /**
   * POST /api/productos
   * Alta de nuevo SKU (Solo Administrador).
   */
  static async crear(req, res) {
    try {
      const producto = await ProductosService.crearProducto(req.body);
      return res.status(201).json({
        mensaje: 'Producto creado exitosamente.',
        data: producto
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al crear producto.'
      });
    }
  }

  /**
   * PUT /api/productos/:id
   * Modificación de SKU (Solo Administrador).
   */
  static async actualizar(req, res) {
    try {
      const { id } = req.params;
      const producto = await ProductosService.actualizarProducto(id, req.body);
      return res.status(200).json({
        mensaje: 'Producto actualizado exitosamente.',
        data: producto
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al actualizar producto.'
      });
    }
  }

  /**
   * DELETE /api/productos/:id
   * Baja lógica de SKU (Solo Administrador).
   */
  static async eliminar(req, res) {
    try {
      const { id } = req.params;
      const resultado = await ProductosService.darDeBaja(id);
      return res.status(200).json(resultado);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al dar de baja el producto.'
      });
    }
  }

  /**
   * GET /api/categorias
   * Listado público de categorías.
   */
  static async listarCategorias(req, res) {
    try {
      const categorias = await ProductosService.listarCategorias();
      return res.status(200).json(categorias);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Error al obtener categorías.'
      });
    }
  }
}

module.exports = ProductosController;
