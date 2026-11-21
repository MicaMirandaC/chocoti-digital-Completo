/**
 * @file models/ListaDeseos.js
 * @description Modelo de datos y DAO para la tabla 'lista_deseos' (favoritos de clientes).
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class ListaDeseos {
  /**
   * Obtiene todos los productos guardados en favoritos por un usuario.
   * @param {number} usuarioId
   * @returns {Array<object>}
   */
  static obtenerPorUsuario(usuarioId) {
    const query = `
      SELECT
        ld.id AS deseo_id,
        ld.usuario_id,
        ld.created_at AS fecha_guardado,
        p.id AS producto_id,
        p.sku,
        p.nombre,
        p.descripcion,
        p.precio,
        p.imagen_url,
        c.nombre AS categoria_nombre,
        COALESCE(SUM(inv.stock_actual), 0) - COALESCE(SUM(inv.stock_reservado), 0) AS stock_disponible,
        CASE
          WHEN (COALESCE(SUM(inv.stock_actual), 0) - COALESCE(SUM(inv.stock_reservado), 0)) <= 0 THEN 'Agotado'
          WHEN (COALESCE(SUM(inv.stock_actual), 0) - COALESCE(SUM(inv.stock_reservado), 0)) <= p.stock_minimo THEN 'Pocas unidades'
          ELSE 'Disponible'
        END AS estado_stock
      FROM lista_deseos ld
      JOIN productos p ON ld.producto_id = p.id
      JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario inv ON p.id = inv.producto_id
      WHERE ld.usuario_id = ? AND p.activo = 1
      GROUP BY ld.id, p.id
      ORDER BY ld.created_at DESC
    `;
    return db.prepare(query).all(usuarioId);
  }

  /**
   * Agrega un producto a la lista de deseos del usuario.
   * @param {number} usuarioId
   * @param {number} productoId
   * @returns {boolean}
   */
  static agregar(usuarioId, productoId) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO lista_deseos (usuario_id, producto_id)
      VALUES (?, ?)
    `);
    const info = stmt.run(usuarioId, productoId);
    return info.changes > 0;
  }

  /**
   * Remueve un producto de la lista de deseos.
   * @param {number} usuarioId
   * @param {number} productoId
   * @returns {boolean}
   */
  static eliminar(usuarioId, productoId) {
    const info = db
      .prepare('DELETE FROM lista_deseos WHERE usuario_id = ? AND producto_id = ?')
      .run(usuarioId, productoId);
    return info.changes > 0;
  }

  /**
   * Fusiona los productos favoritos locales (del navegador) al iniciar sesión.
   * @param {number} usuarioId
   * @param {Array<number>} productoIds
   * @returns {number} Cantidad de productos insertados
   */
  static sincronizar(usuarioId, productoIds = []) {
    if (!Array.isArray(productoIds) || productoIds.length === 0) return 0;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO lista_deseos (usuario_id, producto_id)
      VALUES (?, ?)
    `);

    let insertados = 0;
    const transaccion = db.transaction((ids) => {
      for (const pid of ids) {
        const info = stmt.run(usuarioId, Number(pid));
        if (info.changes > 0) insertados++;
      }
    });

    transaccion(productoIds);
    return insertados;
  }
}

module.exports = ListaDeseos;
