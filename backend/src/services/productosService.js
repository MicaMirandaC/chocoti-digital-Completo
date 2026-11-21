/**
 * @file services/productosService.js
 * @description Lógica de negocio para catálogo, buscador, categorías y gestión de SKUs.
 * ChocoTi-Digital | Capa 2: Lógica de Negocio
 */

'use strict';

const Producto = require('../models/Producto');
const Categoria = require('../models/Categoria');

class ProductosService {
  /**
   * Obtiene lista de productos con filtros y buscador.
   */
  static async listarProductos(filtros = {}) {
    return Producto.findAll(filtros);
  }

  /**
   * Obtiene sugerencias rápidas de búsqueda.
   */
  static async obtenerSugerencias(query, limite = 6) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return [];
    }
    return Producto.obtenerSugerencias(query.trim(), Number(limite) || 6);
  }

  /**
   * Obtiene el detalle de un producto por ID.
   */
  static async obtenerPorId(id, almacenId = null) {
    const numId = Number(id);
    if (!numId || isNaN(numId)) {
      const error = new Error('Identificador de producto inválido.');
      error.statusCode = 400;
      throw error;
    }

    const producto = Producto.findById(numId, almacenId);
    if (!producto) {
      const error = new Error('Producto no encontrado.');
      error.statusCode = 404;
      throw error;
    }
    return producto;
  }

  /**
   * Obtiene todas las categorías activas.
   */
  static async listarCategorias() {
    return Categoria.findAll();
  }

  /**
   * Crea un nuevo producto (SKU) con validaciones.
   */
  static async crearProducto(datos) {
    const { sku, nombre, precio, categoria_id } = datos;

    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      const error = new Error('El código SKU es obligatorio.');
      error.statusCode = 400;
      throw error;
    }

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      const error = new Error('El nombre del producto es obligatorio.');
      error.statusCode = 400;
      throw error;
    }

    if (precio === undefined || isNaN(Number(precio)) || Number(precio) < 0) {
      const error = new Error('El precio debe ser un número mayor o igual a 0.');
      error.statusCode = 400;
      throw error;
    }

    if (!categoria_id || isNaN(Number(categoria_id))) {
      const error = new Error('La categoría seleccionada es inválida.');
      error.statusCode = 400;
      throw error;
    }

    const categoriaExistente = Categoria.findById(Number(categoria_id));
    if (!categoriaExistente) {
      const error = new Error('La categoría especificada no existe.');
      error.statusCode = 404;
      throw error;
    }

    const skuLimpio = sku.trim().toUpperCase();
    const productoExistente = Producto.findBySku(skuLimpio);
    if (productoExistente) {
      const error = new Error(`El SKU "${skuLimpio}" ya se encuentra registrado.`);
      error.statusCode = 409;
      throw error;
    }

    return Producto.create({
      sku: skuLimpio,
      nombre: nombre.trim(),
      descripcion: datos.descripcion ? datos.descripcion.trim() : null,
      precio: Number(precio),
      categoria_id: Number(categoria_id),
      imagen_url: datos.imagen_url ? datos.imagen_url.trim() : null,
      stock_minimo: datos.stock_minimo !== undefined ? Number(datos.stock_minimo) : 10
    });
  }

  /**
   * Actualiza un producto existente.
   */
  static async actualizarProducto(id, datos) {
    const numId = Number(id);
    const productoActual = Producto.findById(numId);
    if (!productoActual) {
      const error = new Error('Producto no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    if (datos.sku) {
      const nuevoSku = datos.sku.trim().toUpperCase();
      if (nuevoSku !== productoActual.sku) {
        const existente = Producto.findBySku(nuevoSku);
        if (existente && existente.id !== numId) {
          const error = new Error(`El SKU "${nuevoSku}" ya está asignado a otro producto.`);
          error.statusCode = 409;
          throw error;
        }
      }
    }

    if (datos.precio !== undefined && (isNaN(Number(datos.precio)) || Number(datos.precio) < 0)) {
      const error = new Error('El precio debe ser un número mayor o igual a 0.');
      error.statusCode = 400;
      throw error;
    }

    if (datos.categoria_id !== undefined) {
      const cat = Categoria.findById(Number(datos.categoria_id));
      if (!cat) {
        const error = new Error('La categoría especificada no existe.');
        error.statusCode = 404;
        throw error;
      }
    }

    return Producto.update(numId, datos);
  }

  /**
   * Da de baja lógica a un SKU.
   */
  static async darDeBaja(id) {
    const numId = Number(id);
    const productoActual = Producto.findById(numId);
    if (!productoActual) {
      const error = new Error('Producto no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    const exito = Producto.delete(numId);
    if (!exito) {
      const error = new Error('No se pudo desactivar el producto.');
      error.statusCode = 500;
      throw error;
    }

    return { mensaje: 'Producto dado de baja exitosamente.', id: numId };
  }
}

module.exports = ProductosService;
