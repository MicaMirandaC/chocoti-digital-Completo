/**
 * @file models/Producto.js
 * @description Modelo de datos y DAO para la tabla 'productos' y su inventario consolidado.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Producto {
  /**
   * Normaliza una cadena de texto quitando tildes y mayúsculas.
   * @param {string} str
   * @returns {string}
   */
  static normalizarTexto(str) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
  }

  /**
   * Lista productos con filtros de búsqueda, categoría y cálculo de disponibilidad.
   *
   * @param {object} filtros
   * @param {string} [filtros.busqueda] - Término de búsqueda (ignora acentos y mayúsculas)
   * @param {number} [filtros.categoria_id] - Filtro por categoría
   * @param {number} [filtros.almacen_id] - Filtro de stock por almacén específico
   * @param {boolean} [filtros.solo_activos=true] - Excluir productos dados de baja
   * @param {number} [filtros.limite=50]
   * @param {number} [filtros.offset=0]
   * @returns {Array<object>}
   */
  static findAll(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.solo_activos !== false) {
      condiciones.push('p.activo = 1');
    }

    if (filtros.categoria_id) {
      condiciones.push('p.categoria_id = ?');
      params.push(Number(filtros.categoria_id));
    }

    if (filtros.busqueda && filtros.busqueda.trim()) {
      const q = `%${Producto.normalizarTexto(filtros.busqueda)}%`;
      condiciones.push(`(
        quitar_tildes(p.nombre) LIKE ? OR
        quitar_tildes(p.sku) LIKE ? OR
        quitar_tildes(p.descripcion) LIKE ? OR
        quitar_tildes(c.nombre) LIKE ?
      )`);
      params.push(q, q, q, q);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    // Si se especifica un almacén, calcular disponibilidad para esa sucursal; sino, el total general
    let subqueryStock;
    const now = "datetime('now')";
    if (filtros.almacen_id) {
      subqueryStock = `
        SELECT
          i.producto_id,
          COALESCE(SUM(i.stock_actual),0) AS stock_total,
          COALESCE(SUM(i.stock_reservado),0) AS stock_reservado
        FROM inventario i
        JOIN lotes l ON i.producto_id = l.producto_id
                     AND i.almacen_id = l.almacen_id
        WHERE i.almacen_id = ${Number(filtros.almacen_id)}
          AND l.estado = 'VIGENTE'
          AND date(l.fecha_vencimiento) >= date(${now})
        GROUP BY i.producto_id
      `;
    } else {
      subqueryStock = `
        SELECT
          producto_id,
          COALESCE(SUM(stock_actual), 0) AS stock_total,
          COALESCE(SUM(stock_reservado), 0) AS stock_reservado
        FROM inventario
        GROUP BY producto_id
      `;
    }

    const query = `
      SELECT
        p.id,
        p.sku,
        p.nombre,
        p.descripcion,
        p.precio,
        p.categoria_id,
        c.nombre AS categoria_nombre,
        p.imagen_url,
        p.stock_minimo,
        p.activo,
        p.fecha_creacion,
        COALESCE(inv.stock_total, 0) AS stock_total,
        COALESCE(inv.stock_reservado, 0) AS stock_reservado,
        (COALESCE(inv.stock_total, 0) - COALESCE(inv.stock_reservado, 0)) AS stock_disponible,
        CASE
          WHEN (COALESCE(inv.stock_total, 0) - COALESCE(inv.stock_reservado, 0)) <= 0 THEN 'Agotado'
          WHEN (COALESCE(inv.stock_total, 0) - COALESCE(inv.stock_reservado, 0)) <= p.stock_minimo THEN 'Pocas unidades'
          ELSE 'Disponible'
        END AS estado_stock
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN (${subqueryStock}) inv ON p.id = inv.producto_id
      ${where}
      ORDER BY p.id ASC
    `;

    return db.prepare(query).all(...params);
  }

  /**
   * Obtiene sugerencias de búsqueda rápidas para autocompletar.
   * @param {string} termino
   * @param {number} [limite=6]
   * @returns {Array<{ id: number, nombre: string, sku: string, precio: number, categoria_nombre: string }>}
   */
  static obtenerSugerencias(termino, limite = 6) {
    if (!termino || !termino.trim()) return [];
    const q = `%${Producto.normalizarTexto(termino)}%`;

    return db
      .prepare(`
        SELECT
          p.id, p.sku, p.nombre, p.precio, c.nombre AS categoria_nombre
        FROM productos p
        JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1 AND (
          quitar_tildes(p.nombre) LIKE ? OR
          quitar_tildes(p.sku) LIKE ? OR
          quitar_tildes(c.nombre) LIKE ?
        )
        LIMIT ?
      `)
      .all(q, q, q, limite);
  }

  /**
   * Obtiene un producto por ID con su disponibilidad de inventario.
   * @param {number} id
   * @param {number} [almacenId]
   * @returns {object|undefined}
   */
  static findById(id, almacenId = null) {
    let subqueryStock;
    if (almacenId) {
      subqueryStock = `
        SELECT
          producto_id,
          COALESCE(stock_actual, 0) AS stock_total,
          COALESCE(stock_reservado, 0) AS stock_reservado
        FROM inventario
        WHERE almacen_id = ${Number(almacenId)}
      `;
    } else {
      subqueryStock = `
        SELECT
          producto_id,
          COALESCE(SUM(stock_actual), 0) AS stock_total,
          COALESCE(SUM(stock_reservado), 0) AS stock_reservado
        FROM inventario
        GROUP BY producto_id
      `;
    }

    const query = `
      SELECT
        p.id,
        p.sku,
        p.nombre,
        p.descripcion,
        p.precio,
        p.categoria_id,
        c.nombre AS categoria_nombre,
        p.imagen_url,
        p.stock_minimo,
        p.activo,
        p.fecha_creacion,
        COALESCE(inv.stock_total, 0) AS stock_total,
        COALESCE(inv.stock_reservado, 0) AS stock_reservado,
        (COALESCE(inv.stock_total, 0) - COALESCE(inv.stock_reservado, 0)) AS stock_disponible,
        CASE
          WHEN (COALESCE(inv.stock_total, 0) - COALESCE(inv.stock_reservado, 0)) <= 0 THEN 'Agotado'
          WHEN (COALESCE(inv.stock_total, 0) - COALESCE(inv.stock_reservado, 0)) <= p.stock_minimo THEN 'Pocas unidades'
          ELSE 'Disponible'
        END AS estado_stock
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN (${subqueryStock}) inv ON p.id = inv.producto_id
      WHERE p.id = ?
    `;

    return db.prepare(query).get(id);
  }

  /**
   * Busca un producto por su SKU oficial.
   * @param {string} sku
   * @returns {object|undefined}
   */
  static findBySku(sku) {
    return db
      .prepare(`
        SELECT p.*, c.nombre AS categoria_nombre
        FROM productos p
        JOIN categorias c ON p.categoria_id = c.id
        WHERE p.sku = ?
      `)
      .get(sku.trim().toUpperCase());
  }

  /**
   * Crea un nuevo SKU/Producto e inicializa sus existencias en los 4 almacenes.
   * @param {object} datos
   * @returns {object} Producto creado
   */
  static create(datos) {
    const stmt = db.prepare(`
      INSERT INTO productos
        (sku, nombre, descripcion, precio, categoria_id, imagen_url, stock_minimo, activo)
      VALUES
        (@sku, @nombre, @descripcion, @precio, @categoria_id, @imagen_url, @stock_minimo, 1)
    `);

    const info = stmt.run({
      sku: datos.sku.trim().toUpperCase(),
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion ? datos.descripcion.trim() : null,
      precio: Number(datos.precio),
      categoria_id: Number(datos.categoria_id),
      imagen_url: datos.imagen_url ? datos.imagen_url.trim() : null,
      stock_minimo: datos.stock_minimo !== undefined ? Number(datos.stock_minimo) : 10,
    });

    const productoId = info.lastInsertRowid;

    // Inicializar inventario en 0 para todos los almacenes existentes
    const almacenes = db.prepare('SELECT id FROM almacenes').all();
    const insertInv = db.prepare(`
      INSERT OR IGNORE INTO inventario (producto_id, almacen_id, stock_actual, stock_reservado)
      VALUES (?, ?, 0, 0)
    `);

    for (const alm of almacenes) {
      insertInv.run(productoId, alm.id);
    }

    return Producto.findById(productoId);
  }

  /**
   * Actualiza los datos de un SKU/Producto.
   * @param {number} id
   * @param {object} datos
   * @returns {object|undefined}
   */
  static update(id, datos) {
    const camposPermitidos = ['sku', 'nombre', 'descripcion', 'precio', 'categoria_id', 'imagen_url', 'stock_minimo', 'activo'];
    const sets = [];
    const params = [];

    for (const campo of camposPermitidos) {
      if (Object.prototype.hasOwnProperty.call(datos, campo) && datos[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        let val = datos[campo];
        if (campo === 'sku') val = String(val).trim().toUpperCase();
        if (campo === 'precio' || campo === 'categoria_id' || campo === 'stock_minimo' || campo === 'activo') val = Number(val);
        params.push(val);
      }
    }

    if (sets.length === 0) return Producto.findById(id);

    params.push(id);
    db.prepare(`UPDATE productos SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return Producto.findById(id);
  }

  /**
   * Da de baja lógica a un producto (activo = 0).
   * @param {number} id
   * @returns {boolean}
   */
  static delete(id) {
    const info = db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

module.exports = Producto;
